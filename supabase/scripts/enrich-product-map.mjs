import fs from "fs";

const sql = fs.readFileSync("supabase/seed_demo.sql", "utf8");
const map = fs
  .readFileSync("supabase/scripts/demo-product-image-map.txt", "utf8")
  .trim()
  .split(/\r?\n/);

const titles = {};
const re =
  /'d2222222-d222-4222-8222-00000000(\d{4})'::uuid,\s*'d111[^']+'::uuid,\s*'([^']+)',\s*'([^']+)'/g;
let m;
while ((m = re.exec(sql))) {
  titles[m[1]] = { cat: m[2], title: m[3] };
}

const lines = map.map((line) => {
  const parts = line.split(" | ");
  // Skip if already enriched (has 6 columns)
  if (parts.length >= 6) return line;
  const n = String(parseInt(parts[0], 10)).padStart(4, "0");
  const t = titles[n];
  if (!t) return line;
  return `${parts[0]} | ${parts[1]} | ${t.title} | ${t.cat} | ${parts[2]} | ${parts[3]}`;
});

fs.writeFileSync(
  "supabase/scripts/demo-product-image-map.txt",
  lines.join("\n") + "\n"
);
console.log(lines[0]);
console.log(lines[30]);
console.log("mapped", Object.keys(titles).length, lines.length);
