/**
 * Patches seed_demo.sql to use matching SVG Storage URLs (shops, images, reels).
 * Run after generate-demo-images.mjs.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const seedPath = path.join(root, "supabase/seed_demo.sql");
const imagesPath = path.join(root, "supabase/seed_demo_images.sql");
const SUPABASE = "https://uqlqgkwaqsikydckydau.supabase.co";
const pub = (key) =>
  `${SUPABASE}/storage/v1/object/public/product-images/demo/${key}`;

let sql = fs.readFileSync(seedPath, "utf8");
const imagesSql = fs.readFileSync(imagesPath, "utf8");

// Header note
sql = sql.replace(
  /--   images:   d3333333-d333-4333-8333-000000000001 \.\. ~0525/,
  "--   images:   d3333333-d333-4333-8333-000000000001 .. 0150 (1 primary SVG each)"
);

// Shop logos / banners
const shops = [
  ["purush-lane", "000000000001"],
  ["nari-atelier", "000000000002"],
  ["gadget-bazar", "000000000003"],
  ["case-corner", "000000000004"],
  ["ghor-o-ranna", "000000000005"],
  ["rupchaya-beauty", "000000000006"],
  ["bazaar-basket", "000000000007"],
  ["boighar", "000000000008"],
  ["khelaghar", "000000000009"],
  ["choto-bondhu", "000000000010"],
];

for (const [slug] of shops) {
  const logoRe = new RegExp(
    `https://picsum\\.photos/seed/demo-${slug.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}-logo/200/200`,
    "g"
  );
  const bannerRe = new RegExp(
    `https://picsum\\.photos/seed/demo-${slug.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}-banner/1200/400`,
    "g"
  );
  sql = sql.replace(logoRe, pub(`shops/${slug}-logo.svg`));
  sql = sql.replace(bannerRe, pub(`shops/${slug}-banner.svg`));
}

// Extract product image VALUES from seed_demo_images.sql (between values and on conflict)
const valuesMatch = imagesSql.match(
  /insert into public\.product_images[\s\S]*?values\n([\s\S]*?)\non conflict/
);
if (!valuesMatch) throw new Error("Could not parse product_images from seed_demo_images.sql");

const newImagesBlock = `-- Product images (1 matching SVG primary each; upload demo/ to product-images bucket)
insert into public.product_images (id, product_id, storage_path, sort_order, is_primary)
select seed.id, seed.product_id, seed.storage_path, seed.sort_order, seed.is_primary
from (values
${valuesMatch[1].trimEnd()}
) as seed (id, product_id, storage_path, sort_order, is_primary)
where exists (select 1 from public.products as p where p.id = seed.product_id)
on conflict (id) do update set
  product_id = excluded.product_id,
  storage_path = excluded.storage_path,
  sort_order = excluded.sort_order,
  is_primary = excluded.is_primary;`;

const imagesBlockRe =
  /-- Product images[\s\S]*?on conflict \(id\) do nothing;/;
if (!imagesBlockRe.test(sql)) throw new Error("Could not find product images block in seed_demo.sql");
sql = sql.replace(imagesBlockRe, newImagesBlock);

// Reel thumbnails
const reelSlugs = [
  ["purush-lane", 1, 3],
  ["nari-atelier", 4, 6],
  ["gadget-bazar", 7, 9],
  ["case-corner", 10, 12],
  ["ghor-o-ranna", 13, 15],
  ["rupchaya-beauty", 16, 18],
  ["bazaar-basket", 19, 21],
  ["boighar", 22, 24],
  ["khelaghar", 25, 27],
  ["choto-bondhu", 28, 30],
];

for (const [slug, start, end] of reelSlugs) {
  for (let i = start; i <= end; i++) {
    const look = ((i - start) % 3) + 1;
    const old = `https://picsum.photos/seed/demo-${slug}-reel-${look}/720/1280`;
    const neu = pub(`reels/${slug}-reel-${look}.svg`);
    if (!sql.includes(old)) {
      console.warn("missing reel url", old);
    }
    sql = sql.split(old).join(neu);
  }
}

fs.writeFileSync(seedPath, sql);
console.log("patched", seedPath);
console.log("picsum left:", (sql.match(/picsum\.photos\/seed\/demo-/g) || []).length);
