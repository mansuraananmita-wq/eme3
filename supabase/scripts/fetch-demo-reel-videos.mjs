/**
 * Fetch Pixabay demo reel videos, upload to Supabase Storage
 * (reel-videos/demo/{n}.mp4 + reel-thumbnails/demo/{n}.jpg),
 * verify public HEAD 200, and emit seed_demo_reels_real.sql.
 *
 * Run: node supabase/scripts/fetch-demo-reel-videos.mjs
 *
 * Reads PIXABAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Never logs secret values. Service role is local-only — never used in web/.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const envPath = path.join(root, ".env.local");
const statePath = path.join(__dirname, "reel-video-state.json");
const sqlPath = path.join(root, "supabase/seed_demo_reels_real.sql");
const cacheDir = path.join(__dirname, ".reel-video-cache");

const VIDEO_BUCKET = "reel-videos";
const THUMB_BUCKET = "reel-thumbnails";
const STORAGE_PREFIX = "demo";
const VIDEO_API = "https://pixabay.com/api/videos/";
const TARGET_CLIPS = 12;
const MAX_BYTES = 8 * 1024 * 1024;
const MIN_WIDTH = 360;
const MIN_GAP_MS = 800;
const MAX_RETRIES = 4;

/** Fashion / commerce style queries for distinct clips. */
const QUERIES = [
  "fashion runway clothing",
  "shoes sneakers closeup",
  "electronics smartphone unboxing",
  "home decor interior",
  "jewelry gold necklace",
  "cosmetics makeup beauty",
  "shopping mall fashion",
  "handbag leather fashion",
  "kitchen cooking home",
  "watch luxury closeup",
  "perfume beauty product",
  "street style fashion",
  "textile fabric fashion",
  "laptop gadget desk",
];

const env = loadEnv(envPath);
const PIXABAY_API_KEY = required(env, "PIXABAY_API_KEY");
const SUPABASE_URL = required(env, "SUPABASE_URL").replace(/\/$/, "");
const SERVICE_ROLE = required(env, "SUPABASE_SERVICE_ROLE_KEY");

fs.mkdirSync(cacheDir, { recursive: true });

/** @type {Record<string, object>} */
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { clips: {}, updatedAt: null };

if (!state.clips || typeof state.clips !== "object") state.clips = {};

const usedVideoIds = new Set(
  Object.values(state.clips)
    .filter((c) => c?.status === "ok" && c.pixabayId != null)
    .map((c) => Number(c.pixabayId)),
);

let lastApiAt = 0;
let uploaded = 0;
let skipped = 0;
let failed = 0;
/** @type {string[]} */
const failures = [];

console.log("Ensuring Storage buckets are public…");
await ensurePublicBucket(VIDEO_BUCKET, {
  fileSizeLimit: 52_428_800,
  allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
});
await ensurePublicBucket(THUMB_BUCKET, {
  fileSizeLimit: 2_097_152,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
});

/** Collect candidate hits until we have enough unique ok clips. */
const needed = TARGET_CLIPS;
let nextIndex = nextClipIndex(state.clips);

for (const query of QUERIES) {
  if (countOk(state.clips) >= needed) break;

  let hits = [];
  try {
    hits = await searchVideos(query);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[search fail] q="${query}": ${msg}`);
    failures.push(`search:${query}: ${msg}`);
    continue;
  }

  for (const hit of hits) {
    if (countOk(state.clips) >= needed) break;
    if (usedVideoIds.has(hit.id)) continue;

    const rendition = pickRendition(hit);
    if (!rendition) {
      console.log(`[skip hit] pixabay=${hit.id} — no rendition ≥${MIN_WIDTH}p under 8 MB`);
      continue;
    }

    const n = nextIndex;
    const key = String(n);
    const videoStoragePath = `${STORAGE_PREFIX}/${n}.mp4`;
    const thumbStoragePath = `${STORAGE_PREFIX}/${n}.jpg`;
    const videoPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/${VIDEO_BUCKET}/${videoStoragePath}`;
    const thumbPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/${THUMB_BUCKET}/${thumbStoragePath}`;
    const localVideo = path.join(cacheDir, `${n}.mp4`);
    const localThumb = path.join(cacheDir, `${n}.jpg`);

    if (state.clips[key]?.status === "ok" && state.clips[key].verified) {
      usedVideoIds.add(Number(state.clips[key].pixabayId));
      skipped += 1;
      console.log(`[skip] demo/${n}.mp4 already done`);
      nextIndex += 1;
      continue;
    }

    try {
      if (!fs.existsSync(localVideo)) {
        console.log(`[download] #${n} pixabay=${hit.id} ${rendition.label} ${Math.round(rendition.size / 1024)}KB`);
        const bytes = await downloadBytes(rendition.url);
        if (bytes.length > MAX_BYTES) {
          throw new Error(`Downloaded ${bytes.length} bytes exceeds 8 MB`);
        }
        fs.writeFileSync(localVideo, bytes);
      }

      const thumbUrl = thumbnailUrl(hit, rendition);
      if (!fs.existsSync(localThumb)) {
        const thumbBytes = await downloadBytes(thumbUrl);
        fs.writeFileSync(localThumb, thumbBytes);
      }

      await uploadBytes(localVideo, VIDEO_BUCKET, videoStoragePath, "video/mp4");
      await uploadBytes(localThumb, THUMB_BUCKET, thumbStoragePath, "image/jpeg");

      const ok = await verifyVideoPublic(videoPublicUrl);
      if (!ok) {
        throw new Error(`Public HEAD failed for ${videoPublicUrl}`);
      }

      usedVideoIds.add(hit.id);
      state.clips[key] = {
        status: "ok",
        n,
        pixabayId: hit.id,
        query,
        tags: hit.tags,
        user: hit.user,
        pageURL: hit.pageURL,
        duration: hit.duration,
        rendition: rendition.label,
        width: rendition.width,
        height: rendition.height,
        size: rendition.size,
        videoStoragePath,
        thumbStoragePath,
        videoPublicUrl,
        thumbPublicUrl,
        verified: true,
      };
      state.updatedAt = new Date().toISOString();
      saveState(state);
      uploaded += 1;
      console.log(`[ok] demo/${n}.mp4 ← pixabay ${hit.id} (${rendition.label})`);
      nextIndex += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      failed += 1;
      failures.push(`clip:${n}: ${msg}`);
      state.clips[key] = {
        status: "fail",
        n,
        pixabayId: hit.id,
        query,
        reason: msg,
      };
      saveState(state);
      console.error(`[fail] demo/${n}: ${msg}`);
      // Reuse the same slot index for the next candidate.
    }
  }
}

const okClips = Object.values(state.clips)
  .filter((c) => c?.status === "ok" && c.verified)
  .sort((a, b) => a.n - b.n);

if (okClips.length < TARGET_CLIPS) {
  console.error(
    `\nWARNING: only ${okClips.length}/${TARGET_CLIPS} verified clips. SQL will still be generated from what we have.`,
  );
}

writeSql(okClips);

console.log("\n--- summary ---");
console.log(`verified clips: ${okClips.length}`);
console.log(`uploaded this run: ${uploaded}`);
console.log(`skipped existing: ${skipped}`);
console.log(`failed: ${failed}`);
if (failures.length) {
  console.log("failures:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log(`state: ${path.relative(root, statePath)}`);
console.log(`sql:   ${path.relative(root, sqlPath)}`);

if (okClips.length < 1) {
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------

/**
 * @param {Record<string, object>} clips
 */
function countOk(clips) {
  return Object.values(clips).filter((c) => c?.status === "ok" && c.verified).length;
}

/**
 * @param {Record<string, object>} clips
 */
function nextClipIndex(clips) {
  const nums = Object.values(clips)
    .map((c) => Number(c?.n))
    .filter((n) => Number.isFinite(n) && n >= 1);
  if (!nums.length) return 1;
  // Prefer filling missing slots 1..TARGET first, else max+1.
  for (let i = 1; i <= TARGET_CLIPS + 8; i++) {
    const existing = clips[String(i)];
    if (!existing || existing.status !== "ok" || !existing.verified) return i;
  }
  return Math.max(...nums) + 1;
}

/**
 * @param {string} query
 */
async function searchVideos(query) {
  const params = new URLSearchParams({
    key: PIXABAY_API_KEY,
    q: query,
    safesearch: "true",
    per_page: "20",
    video_type: "film",
  });
  const data = await pixabayGet(`${VIDEO_API}?${params}`);
  return Array.isArray(data?.hits) ? data.hits : [];
}

/**
 * Prefer tiny then small; must be ≥360 wide and size ≤ 8 MB.
 * @param {object} hit
 */
function pickRendition(hit) {
  const videos = hit?.videos || {};
  const order = ["tiny", "small", "medium", "large"];
  for (const label of order) {
    const r = videos[label];
    if (!r?.url) continue;
    const width = Number(r.width) || 0;
    const size = Number(r.size) || 0;
    if (width < MIN_WIDTH) continue;
    if (size > 0 && size > MAX_BYTES) continue;
    return {
      label,
      url: r.url,
      width,
      height: Number(r.height) || 0,
      size,
      thumbnail: r.thumbnail || null,
    };
  }
  return null;
}

/**
 * Thumbnail from the chosen rendition, then any videos.*.thumbnail, then picture_id (legacy).
 * @param {object} hit
 * @param {object | null} rendition
 */
function thumbnailUrl(hit, rendition) {
  if (rendition?.thumbnail) return rendition.thumbnail;
  const videos = hit?.videos || {};
  for (const label of ["tiny", "small", "medium", "large"]) {
    if (videos[label]?.thumbnail) return videos[label].thumbnail;
  }
  const pictureId = hit?.picture_id;
  if (pictureId) {
    return `https://i.vimeocdn.com/video/${pictureId}_640x360.jpg`;
  }
  throw new Error(`No thumbnail for pixabay video ${hit?.id}`);
}

/**
 * @param {string} url
 */
async function pixabayGet(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await throttle();
    const res = await fetch(url);
    if (res.status === 429) {
      const wait = 15_000 * (attempt + 1);
      console.log(`rate limited (429), waiting ${wait}ms…`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Pixabay HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }
  throw new Error("Pixabay rate limit exceeded after retries");
}

async function throttle() {
  const now = Date.now();
  const wait = MIN_GAP_MS - (now - lastApiAt);
  if (wait > 0) await sleep(wait);
  lastApiAt = Date.now();
}

/**
 * @param {string} url
 */
async function downloadBytes(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await sleep(10_000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Download failed ${res.status} for ${url.slice(0, 80)}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("Download rate limited");
}

/**
 * @param {string} localPath
 * @param {string} bucket
 * @param {string} storagePath
 * @param {string} contentType
 */
async function uploadBytes(localPath, bucket, storagePath, contentType) {
  const bytes = fs.readFileSync(localPath);
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`;
  const headers = {
    Authorization: `Bearer ${SERVICE_ROLE}`,
    apikey: SERVICE_ROLE,
    "Content-Type": contentType,
    "x-upsert": "true",
  };

  let res = await fetch(url, { method: "POST", headers, body: bytes });
  if (!res.ok) {
    res = await fetch(url, { method: "PUT", headers, body: bytes });
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Storage upload ${bucket}/${storagePath} failed ${res.status}: ${t.slice(0, 200)}`);
  }
}

/**
 * HEAD public URL; must be 200 and content-type contain "video". Retry once.
 * @param {string} publicUrl
 */
async function verifyVideoPublic(publicUrl) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(publicUrl, { method: "HEAD" });
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (res.ok && ct.includes("video")) return true;
      // Some CDNs omit content-type on HEAD — fall back to GET range.
      if (res.ok && !ct) {
        const get = await fetch(publicUrl, {
          method: "GET",
          headers: { Range: "bytes=0-15" },
        });
        const getCt = (get.headers.get("content-type") || "").toLowerCase();
        if ((get.ok || get.status === 206) && getCt.includes("video")) return true;
      }
      console.error(
        `verify attempt ${attempt + 1}: HTTP ${res.status} content-type=${ct || "(empty)"}`,
      );
    } catch (error) {
      console.error(
        `verify attempt ${attempt + 1}:`,
        error instanceof Error ? error.message : error,
      );
    }
    await sleep(1000);
  }
  return false;
}

/**
 * @param {string} id
 * @param {{ fileSizeLimit: number, allowedMimeTypes: string[] }} opts
 */
async function ensurePublicBucket(id, opts) {
  const listUrl = `${SUPABASE_URL}/storage/v1/bucket/${id}`;
  const headers = {
    Authorization: `Bearer ${SERVICE_ROLE}`,
    apikey: SERVICE_ROLE,
    "Content-Type": "application/json",
  };

  const existing = await fetch(listUrl, { headers });
  if (existing.ok) {
    const patch = await fetch(listUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        public: true,
        file_size_limit: opts.fileSizeLimit,
        allowed_mime_types: opts.allowedMimeTypes,
      }),
    });
    if (!patch.ok) {
      // Older API: update via POST /bucket
      const alt = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          id,
          name: id,
          public: true,
          file_size_limit: opts.fileSizeLimit,
          allowed_mime_types: opts.allowedMimeTypes,
        }),
      });
      if (!alt.ok) {
        const t = await alt.text().catch(() => "");
        console.error(`bucket update ${id}: ${alt.status} ${t.slice(0, 160)}`);
      } else {
        console.log(`bucket ${id}: public=true (updated)`);
      }
    } else {
      console.log(`bucket ${id}: public=true (updated)`);
    }
    return;
  }

  const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id,
      name: id,
      public: true,
      file_size_limit: opts.fileSizeLimit,
      allowed_mime_types: opts.allowedMimeTypes,
    }),
  });
  if (!create.ok) {
    const t = await create.text().catch(() => "");
    throw new Error(`Create bucket ${id} failed ${create.status}: ${t.slice(0, 200)}`);
  }
  console.log(`bucket ${id}: created public=true`);
}

/**
 * @param {Array<object>} okClips
 */
function writeSql(okClips) {
  if (!okClips.length) {
    fs.writeFileSync(
      sqlPath,
      `-- seed_demo_reels_real.sql
-- No verified clips yet. Re-run: node supabase/scripts/fetch-demo-reel-videos.mjs
`,
    );
    return;
  }

  const videoCases = okClips
    .map((c, i) => `    when ${i} then '${escSql(c.videoPublicUrl)}'`)
    .join("\n");
  const thumbCases = okClips
    .map((c, i) => `    when ${i} then '${escSql(c.thumbPublicUrl)}'`)
    .join("\n");
  const mod = okClips.length;

  const sql = `-- seed_demo_reels_real.sql
-- Idempotent: points every published reel at Storage-hosted demo MP4s / thumbnails
-- uploaded by fetch-demo-reel-videos.mjs (bucket reel-videos + reel-thumbnails under demo/).
-- Does not change captions or product tags. Assigns videos round-robin by created_at.
-- reel_status has no 'archived'; RLS test reel (caption = 'RLS reel') is set to 'removed'.
-- Generated: ${new Date().toISOString()}
-- Clips: ${okClips.length}

begin;

with numbered as (
  select
    id,
    (row_number() over (order by created_at asc, id asc) - 1) % ${mod} as slot
  from public.reels
  where status = 'published'
)
update public.reels as r
set
  video_path = case n.slot
${videoCases}
  end,
  thumbnail_path = case n.slot
${thumbCases}
  end
from numbered as n
where r.id = n.id;

-- Real enum value for soft-remove (no 'archived' in reel_status).
update public.reels
set status = 'removed'
where caption = 'RLS reel'
  and status is distinct from 'removed';

commit;

-- Verification: published reels still missing a video_path
select id, caption, video_path, thumbnail_path, status, created_at
from public.reels
where status = 'published'
  and (video_path is null or btrim(video_path) = '')
order by created_at;
`;

  fs.writeFileSync(sqlPath, sql);
}

/** @param {string} s */
function escSql(s) {
  return String(s).replace(/'/g, "''");
}

function saveState(s) {
  fs.writeFileSync(statePath, JSON.stringify(s, null, 2) + "\n");
}

/**
 * @param {string} file
 * @returns {Map<string, string>}
 */
function loadEnv(file) {
  const map = new Map();
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing ${path.relative(root, file)}. Add PIXABAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.`,
    );
  }
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

/**
 * @param {Map<string, string>} map
 * @param {string} key
 */
function required(map, key) {
  const v = map.get(key);
  if (!v) throw new Error(`Missing ${key} in .env.local`);
  return v;
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
