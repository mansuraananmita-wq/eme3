import fs from "fs";

const path = "supabase/seed_demo.sql";
let sql = fs.readFileSync(path, "utf8");
const videos = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
  "https://www.w3schools.com/html/movie.mp4",
  "https://filesamples.com/samples/video/mp4/sample_640x360.mp4",
  "https://download.samplelib.com/mp4/sample-5s.mp4",
  "https://download.samplelib.com/mp4/sample-10s.mp4",
  "https://download.samplelib.com/mp4/sample-15s.mp4",
  "https://download.samplelib.com/mp4/sample-20s.mp4",
  "https://download.samplelib.com/mp4/sample-30s.mp4",
];

let i = 0;
sql = sql.replace(
  /https:\/\/commondatastorage\.googleapis\.com\/gtv-videos-bucket\/sample\/[A-Za-z0-9_.]+\.mp4/g,
  () => videos[i++ % videos.length],
);

sql = sql.replace(
  /-- Reels \(30 published\)\. video_path values are public sample MP4 placeholders\r?\n-- to be replaced by real Storage uploads later\./,
  "-- Reels (30 published). video_path uses working public sample MP4s.\n-- Refresh with supabase/seed_demo_reels_fix.sql for product thumbnails + captions.",
);

fs.writeFileSync(path, sql);
console.log("replaced", i, "dead left", (sql.match(/commondatastorage\.googleapis/g) || []).length);
