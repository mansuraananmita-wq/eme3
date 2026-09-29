/**
 * Fetch Pixabay product photos for the 150 demo products, store locally,
 * upload to Supabase Storage (product-images/demo/products-real/), and
 * emit seed_demo_images_real.sql + real-image-report.txt.
 *
 * Run: node supabase/scripts/fetch-real-product-images.mjs
 *
 * Reads PIXABAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Never logs secret values. Service role is local-only — never used in web/.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const mapPath = path.join(__dirname, "demo-product-image-map.txt");
const outDir = path.join(root, "web/assets/demo-products-real");
const statePath = path.join(__dirname, "real-image-state.json");
const reportPath = path.join(__dirname, "real-image-report.txt");
const sqlPath = path.join(root, "supabase/seed_demo_images_real.sql");
const envPath = path.join(root, ".env.local");

const BUCKET = "product-images";
const STORAGE_PREFIX = "demo/products-real";
const API = "https://pixabay.com/api/";
/** Stay under 100 requests / 60s (Pixabay free tier). */
const MIN_GAP_MS = 700;
const MAX_RETRIES = 4;

/** Curated English queries by map slug (better Pixabay hits than raw titles). */
const QUERY_BY_SLUG = {
  panjabi: "kurta shirt white",
  jeans: "blue jeans denim",
  shirt: "oxford shirt mens",
  sandals: "leather sandals men",
  sneakers: "canvas sneakers white",
  belt: "leather belt men",
  hoodie: "hoodie sweatshirt",
  shorts: "sports shorts men",
  loafers: "loafer shoes leather",
  undershirt: "undershirt white cotton",
  trackpants: "track pants athletic",
  cap: "baseball cap",
  socks: "ankle socks pack",
  blazer: "casual blazer jacket",
  salwar: "salwar kameez",
  kurti: "kurti indian dress",
  heels: "high heel sandals",
  hijab: "hijab scarf muslim",
  saree: "saree silk indian",
  dress: "maxi dress women",
  flats: "ballet flats shoes",
  denim: "denim jacket women",
  handbag: "leather handbag women",
  leggings: "leggings black",
  earrings: "pearl earrings stud",
  palazzo: "palazzo pants women",
  wedges: "wedge sandals women",
  abaya: "abaya black dress",
  scarf: "silk scarf fashion",
  phone: "smartphone mobile phone",
  featurephone: "feature phone mobile keypad",
  laptop: "laptop notebook computer",
  gaminglaptop: "gaming laptop rgb",
  speaker: "bluetooth speaker portable",
  smartwatch: "smartwatch wearable",
  earbuds: "wireless earbuds case",
  tablet: "tablet computer device",
  usbhub: "usb hub ports",
  webcam: "webcam camera desk",
  keyboard: "mechanical keyboard",
  monitor: "computer monitor screen",
  ssd: "external ssd hard drive",
  router: "wifi router wireless",
  charger: "usb charger adapter",
  powerbank: "power bank battery",
  phonecase: "phone case silicone",
  glass: "tempered glass screen protector",
  carmount: "car phone mount magnetic",
  cable: "usb c cable braided",
  ringlight: "ring light led",
  tripod: "phone tripod stand",
  wirelesspad: "wireless charger pad",
  earphones: "wired earphones earbuds",
  otg: "usb otg adapter",
  selfiestick: "selfie stick phone",
  lenskit: "phone camera lens clip",
  cablebox: "cable organizer box desk",
  table: "study desk wooden table",
  chair: "folding chair metal",
  frypan: "nonstick frying pan",
  cooker: "pressure cooker pot",
  spicejars: "spice jars set kitchen",
  wallclock: "wall clock modern",
  cushion: "cushion pillow cover",
  lamp: "table lamp desk",
  shoerack: "shoe rack organizer",
  bottle: "steel water bottle",
  plates: "dinner plates set",
  knives: "kitchen knife set",
  floormat: "floor mat rug",
  storagebox: "storage box plastic",
  kettle: "electric kettle",
  serum: "vitamin c serum bottle skincare",
  facewash: "face wash bottle skincare",
  sunscreen: "sunscreen lotion bottle",
  lipstick: "lipstick makeup",
  kajal: "eyeliner kajal makeup",
  powder: "compact powder makeup",
  hairoil: "hair oil bottle coconut",
  shampoo: "shampoo bottle",
  hairserum: "hair serum bottle",
  cream: "night cream jar skincare",
  lotion: "body lotion bottle",
  nailpolish: "nail polish bottles",
  facemask: "face mask sheet skincare",
  brow: "eyebrow pencil makeup",
  hairclips: "hair clips accessories",
  tea: "tea leaves pack",
  oil: "mustard oil bottle cooking",
  rice: "basmati rice bag",
  spices: "spice powder masala",
  honey: "honey jar",
  biscuits: "biscuits cookies pack",
  noodles: "instant noodles pack",
  lentils: "lentils dal bowl",
  pickle: "pickle jar food",
  coffee: "coffee jar beans",
  dates: "dates dried fruit",
  ghee: "ghee jar clarified butter",
  chanachur: "savory snacks mix",
  salt: "salt package iodized",
  greentea: "green tea bags",
  novel: "stack of novels books",
  storybook: "storybook children",
  notebook: "notebook a5 stationery",
  pens: "gel pens set",
  geometry: "geometry compass set school",
  colorpencils: "colored pencils pack",
  guide: "textbook study guide",
  dictionary: "dictionary book",
  stickynotes: "sticky notes pad",
  fountainpen: "fountain pen writing",
  sketchpad: "sketch pad drawing",
  markers: "marker pens set",
  alphabet: "alphabet book children",
  planner: "planner notebook diary",
  exampad: "exam pad paper",
  yogamat: "yoga mat rolled",
  dumbbell: "dumbbell weights gym",
  football: "football soccer ball",
  cricketbat: "cricket bat",
  skippingrope: "jump rope skipping",
  jersey: "sports jersey shirt",
  runningshoes: "running shoes sneakers",
  resistance: "resistance bands fitness",
  sportsbottle: "sports water bottle",
  gymgloves: "gym gloves workout",
  badminton: "badminton racket",
  shuttlecock: "shuttlecock badminton",
  compression: "compression tights sports",
  foamroller: "foam roller fitness",
  sportscap: "sports cap hat",
  teddy: "teddy bear soft toy",
  blocks: "building blocks toys",
  remotecar: "remote control car toy",
  puzzle: "jigsaw puzzle map",
  colouring: "coloring book crayons kids",
  kidsfootball: "kids soccer ball",
  doll: "doll toy children",
  stacking: "stacking rings toy",
  scooter: "kids scooter",
  flashcards: "flashcards education kids",
  bathtoys: "bath toys rubber",
  lcdboard: "drawing tablet kids lcd",
  bubblegun: "bubble gun toy",
  elephant: "plush elephant toy",
  boardgame: "board game family",
};

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "for", "with", "pack", "set", "pair",
  "size", "inch", "cm", "kg", "g", "l", "ml", "w", "usb", "c", "hd", "spf50",
  "128gb", "64gb", "1tb", "5l", "24cm", "20000mah", "20w", "14", "10", "5kg",
  "500g", "1l", "200g", "1kg", "2026", "ssc", "bd", "rtx", "i5", "basic",
  "premium", "assorted", "large", "mini", "kids", "family", "combo", "mix",
]);

/** @type {Map<string, string>} */
const env = loadEnv(envPath);
const PIXABAY_API_KEY = required(env, "PIXABAY_API_KEY");
const SUPABASE_URL = required(env, "SUPABASE_URL").replace(/\/$/, "");
const SERVICE_ROLE = required(env, "SUPABASE_SERVICE_ROLE_KEY");

let sharp = null;
try {
  sharp = (await import("sharp")).default;
  console.log("sharp: enabled (800x800 jpg)");
} catch {
  console.log("sharp: not installed — keeping original downloads");
}

fs.mkdirSync(outDir, { recursive: true });

const products = parseMap(mapPath);
/** @type {Record<string, object>} */
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : {};

const usedPhotoIds = new Set(
  Object.values(state)
    .filter((r) => r?.pixabayId != null && r.status === "ok")
    .map((r) => Number(r.pixabayId))
);

let lastApiAt = 0;
let okCount = 0;
let failCount = 0;
let skipCount = 0;

for (const product of products) {
  const fileName = `${product.index}-${product.slug}.jpg`;
  const localPath = path.join(outDir, fileName);
  const storagePath = `${STORAGE_PREFIX}/${fileName}`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  const query = buildQuery(product);

  if (fs.existsSync(localPath) && state[product.id]?.status === "ok") {
    const prev = state[product.id];
    if (prev.pixabayId != null) usedPhotoIds.add(Number(prev.pixabayId));
    // Ensure storage object exists (re-upload if missing is expensive; upsert always is safer on first skip).
    skipCount += 1;
    okCount += 1;
    console.log(`[skip] ${product.index} ${product.title}`);
    continue;
  }

  if (fs.existsSync(localPath) && !state[product.id]) {
    // Local file from partial run without state — still need metadata; re-search then skip download.
  }

  const hit = await searchPixabay(query, product);
  if (!hit) {
    failCount += 1;
    state[product.id] = {
      status: "fail",
      index: product.index,
      title: product.title,
      category: product.category,
      slug: product.slug,
      query,
      file: fileName,
      reason: "no unused matching photo",
    };
    saveState(state);
    console.log(`[fail] ${product.index} ${product.title} q="${query}"`);
    continue;
  }

  usedPhotoIds.add(hit.id);

  if (!fs.existsSync(localPath)) {
    const raw = await downloadBytes(hit.largeImageURL);
    const jpg = await toSquareJpeg(raw);
    fs.writeFileSync(localPath, jpg);
  }

  await uploadToStorage(localPath, storagePath);

  state[product.id] = {
    status: "ok",
    index: product.index,
    title: product.title,
    category: product.category,
    slug: product.slug,
    query,
    file: fileName,
    storagePath,
    publicUrl,
    pixabayId: hit.id,
    pageURL: hit.pageURL,
    user: hit.user,
    tags: hit.tags,
  };
  saveState(state);
  okCount += 1;
  console.log(`[ok] ${product.index} ${product.title} → ${fileName} (@${hit.user})`);
}

writeReport(products, state);
writeSql(products, state);

console.log(
  `\nDone. ok=${okCount} fail=${failCount} skipped_existing=${skipCount} total=${products.length}`
);
console.log(`report: ${path.relative(root, reportPath)}`);
console.log(`sql:    ${path.relative(root, sqlPath)}`);

// ---------------------------------------------------------------------------

/**
 * @param {string} file
 * @returns {Map<string, string>}
 */
function loadEnv(file) {
  const map = new Map();
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${path.relative(root, file)}. Add PIXABAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.`);
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

/**
 * @param {string} file
 */
function parseMap(file) {
  return fs
    .readFileSync(file, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(" | ").map((p) => p.trim());
      const [index, id, title, category, svgFile] = parts;
      const slug = path.basename(svgFile, ".svg");
      return { index, id, title, category, slug };
    });
}

/**
 * @param {{ title: string, category: string, slug: string }} product
 */
function buildQuery(product) {
  if (QUERY_BY_SLUG[product.slug]) return QUERY_BY_SLUG[product.slug];

  const english = product.title.split("/")[0].trim();
  const cleaned = english
    .replace(/["""]/g, "")
    .replace(/\d+(\.\d+)?\s*(gb|tb|kg|g|l|ml|cm|inch|"|w|mah|spf)?/gi, " ")
    .replace(/[^a-zA-Z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

  if (words.length >= 2) return words.slice(0, 4).join(" ");
  if (words.length === 1) {
    const cat = product.category.replace(/-/g, " ");
    return `${words[0]} ${cat}`.trim();
  }
  return product.category.replace(/-/g, " ");
}

/**
 * @param {string} query
 * @param {{ title: string, slug: string }} product
 */
async function searchPixabay(query, product) {
  const words = queryWords(query, product);
  const params = new URLSearchParams({
    key: PIXABAY_API_KEY,
    q: query,
    image_type: "photo",
    orientation: "all",
    safesearch: "true",
    per_page: "10",
    min_width: "640",
  });

  const data = await pixabayGet(`${API}?${params}`);
  const hits = Array.isArray(data?.hits) ? data.hits : [];
  if (!hits.length) return null;

  const ranked = hits
    .filter((h) => h.largeImageURL && !usedPhotoIds.has(h.id))
    .map((h) => ({ hit: h, score: scoreHit(h, words) }))
    .sort((a, b) => b.score - a.score || b.hit.imageWidth - a.hit.imageWidth);

  if (!ranked.length) return null;
  // Require at least a weak tag/title overlap when possible; still accept top if all zero.
  return ranked[0].hit;
}

/**
 * @param {string} query
 * @param {{ title: string, slug: string }} product
 */
function queryWords(query, product) {
  const fromTitle = product.title
    .split("/")[0]
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  const fromQuery = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set([...fromQuery, ...fromTitle, product.slug])];
}

/**
 * @param {{ tags?: string }} hit
 * @param {string[]} words
 */
function scoreHit(hit, words) {
  const tags = String(hit.tags || "").toLowerCase();
  let score = 0;
  for (const w of words) {
    if (tags.includes(w)) score += 3;
    else if (tags.split(/,\s*/).some((t) => t.includes(w) || w.includes(t))) score += 1;
  }
  return score;
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
    if (!res.ok) throw new Error(`Download failed ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("Download rate limited");
}

/**
 * @param {Buffer} buf
 */
async function toSquareJpeg(buf) {
  if (!sharp) return buf;
  return sharp(buf)
    .rotate()
    .resize(800, 800, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

/**
 * @param {string} localPath
 * @param {string} storagePath
 */
async function uploadToStorage(localPath, storagePath) {
  const bytes = fs.readFileSync(localPath);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) {
    // Try PUT upsert path used by some Storage versions
    const put = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!put.ok) {
      const t = await put.text().catch(() => "");
      throw new Error(`Storage upload failed ${put.status}: ${t.slice(0, 200)}`);
    }
  }
}

/**
 * @param {Record<string, object>} state
 */
function saveState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
}

/**
 * @param {Array<object>} products
 * @param {Record<string, object>} state
 */
function writeReport(products, state) {
  const lines = [
    "real-image-report.txt — Pixabay demo product photos",
    `generated: ${new Date().toISOString()}`,
    "",
  ];
  let ok = 0;
  let fail = 0;
  for (const p of products) {
    const r = state[p.id];
    if (!r || r.status !== "ok") {
      fail += 1;
      lines.push(
        `${p.index} | FAIL | ${p.title} | query=${r?.query || buildQuery(p)} | reason=${r?.reason || "missing"}`
      );
      continue;
    }
    ok += 1;
    lines.push(
      `${p.index} | OK | ${r.title} | query=${r.query} | page=${r.pageURL} | user=${r.user} | file=${r.file}`
    );
  }
  lines.push("");
  lines.push(`SUMMARY ok=${ok} fail=${fail} total=${products.length}`);
  fs.writeFileSync(reportPath, lines.join("\n") + "\n");
}

/**
 * @param {Array<object>} products
 * @param {Record<string, object>} state
 */
function writeSql(products, state) {
  const rows = [];
  for (const p of products) {
    const r = state[p.id];
    if (!r || r.status !== "ok" || !r.publicUrl) continue;
    const n = Number(p.index);
    const imgId = `d3333333-d333-4333-8333-${String(n).padStart(12, "0")}`;
    rows.push(
      `  ('${imgId}'::uuid, '${p.id}'::uuid, '${r.publicUrl.replace(/'/g, "''")}', 0, true)`
    );
  }

  const sql = `-- seed_demo_images_real.sql
-- Safe re-run: deletes demo product_images for the 150 demo products, then
-- inserts one primary Pixabay photo URL per product that was fetched successfully.
-- Generated by: node supabase/scripts/fetch-real-product-images.mjs
-- Requires files in Storage bucket product-images under demo/products-real/.

begin;

delete from public.product_images
where product_id between 'd2222222-d222-4222-8222-000000000001' and 'd2222222-d222-4222-8222-000000000150'
   or id between 'd3333333-d333-4333-8333-000000000001' and 'd3333333-d333-4333-8333-000000000525';

${
  rows.length
    ? `insert into public.product_images (id, product_id, storage_path, sort_order, is_primary)
values
${rows.join(",\n")}
on conflict (id) do update set
  product_id = excluded.product_id,
  storage_path = excluded.storage_path,
  sort_order = excluded.sort_order,
  is_primary = excluded.is_primary;`
    : "-- No successful images yet. Re-run fetch-real-product-images.mjs."
}

commit;
`;
  fs.writeFileSync(sqlPath, sql);
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
