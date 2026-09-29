/**
 * Generates demo SVG product / shop / reel art and the SQL that wires them.
 * Run: node supabase/scripts/generate-demo-images.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const productDir = path.join(root, "web/assets/demo-products");
const shopDir = path.join(root, "web/assets/demo-shops");
const reelDir = path.join(root, "web/assets/demo-reels");
const SUPABASE = "https://uqlqgkwaqsikydckydau.supabase.co";
const pub = (key) =>
  `${SUPABASE}/storage/v1/object/public/product-images/demo/${key}`;

fs.mkdirSync(productDir, { recursive: true });
fs.mkdirSync(shopDir, { recursive: true });
fs.mkdirSync(reelDir, { recursive: true });

/** @type {Record<string, { bg: string, accent: string, label: string, draw: (c: string) => string }>} */
const TYPES = {
  panjabi: { bg: "#ecfdf5", accent: "#0f766e", label: "Panjabi", draw: (a) => `<rect x="280" y="160" width="240" height="480" rx="20" fill="${a}"/><rect x="300" y="200" width="200" height="40" fill="#fff" opacity=".3"/>` },
  jeans: { bg: "#eff6ff", accent: "#1d4ed8", label: "Jeans", draw: (a) => `<path d="M300 180h80l20 440h-60l-20-200-20 200h-60l20-440h40z" fill="${a}"/>` },
  shirt: { bg: "#f0f9ff", accent: "#0369a1", label: "Shirt", draw: (a) => `<path d="M250 200l150-40 150 40v40l-80-20v360h-140V220l-80 20z" fill="${a}"/>` },
  sandals: { bg: "#fff7ed", accent: "#c2410c", label: "Sandals", draw: (a) => `<ellipse cx="400" cy="520" rx="220" ry="60" fill="${a}" opacity=".3"/><path d="M200 480c80-80 320-80 400 0v40c-100-60-300-60-400 0z" fill="${a}"/>` },
  sneakers: { bg: "#f8fafc", accent: "#334155", label: "Sneakers", draw: (a) => `<path d="M180 420c40-80 200-120 360-40 40 20 60 60 40 90H200c-40 0-40-30-20-50z" fill="${a}"/><ellipse cx="280" cy="470" rx="30" ry="18" fill="#fff"/><ellipse cx="380" cy="470" rx="30" ry="18" fill="#fff"/>` },
  belt: { bg: "#fef3c7", accent: "#92400e", label: "Belt", draw: (a) => `<rect x="140" y="360" width="520" height="60" rx="8" fill="${a}"/><rect x="160" y="370" width="50" height="40" rx="4" fill="#fbbf24"/>` },
  hoodie: { bg: "#fdf2f8", accent: "#9d174d", label: "Hoodie", draw: (a) => `<path d="M280 220c0-60 240-60 240 0v40c40 0 80 20 100 40v300H180V300c20-20 60-40 100-40z" fill="${a}"/><circle cx="400" cy="200" r="70" fill="${a}"/>` },
  shorts: { bg: "#ecfeff", accent: "#0e7490", label: "Shorts", draw: (a) => `<path d="M260 280h280l40 260H420l-20-120-20 120H220z" fill="${a}"/>` },
  loafers: { bg: "#f5f5f4", accent: "#44403c", label: "Loafers", draw: (a) => `<path d="M200 440c60-100 280-100 380 20v50H220z" fill="${a}"/>` },
  undershirt: { bg: "#f1f5f9", accent: "#64748b", label: "Vest", draw: (a) => `<path d="M300 200l100-30 100 30v400H300z" fill="${a}"/>` },
  trackpants: { bg: "#eef2ff", accent: "#4338ca", label: "Track pants", draw: (a) => `<path d="M290 180h90l30 460h-70l-25-220-25 220h-70l30-460h45z" fill="${a}"/>` },
  cap: { bg: "#fefce8", accent: "#ca8a04", label: "Cap", draw: (a) => `<ellipse cx="400" cy="360" rx="160" ry="50" fill="${a}"/><path d="M260 360c20-100 260-100 280 0" fill="${a}"/><path d="M520 360h120c20 20 20 40 0 50H520z" fill="${a}"/>` },
  socks: { bg: "#faf5ff", accent: "#7e22ce", label: "Socks", draw: (a) => `<path d="M340 200h80v280c40 40 40 100 0 120h-80c-40-20-40-80 0-120z" fill="${a}"/>` },
  blazer: { bg: "#f8fafc", accent: "#1e293b", label: "Blazer", draw: (a) => `<path d="M240 220l160-50 160 50v40l-70-20v360H310V240l-70 20z" fill="${a}"/><path d="M400 180v420" stroke="#fff" stroke-width="8"/>` },
  salwar: { bg: "#fdf4ff", accent: "#a21caf", label: "Salwar", draw: (a) => `<path d="M300 160h200v120l80 360H220z" fill="${a}"/><path d="M280 280h240" stroke="#fff" stroke-width="10"/>` },
  kurti: { bg: "#fff1f2", accent: "#e11d48", label: "Kurti", draw: (a) => `<path d="M280 180l120-40 120 40v40l-60-15v360H340V205l-60 15z" fill="${a}"/>` },
  heels: { bg: "#fce7f3", accent: "#db2777", label: "Heels", draw: (a) => `<path d="M220 400c80-60 260-40 340 40v30H260z" fill="${a}"/><rect x="520" y="440" width="24" height="80" fill="${a}"/>` },
  hijab: { bg: "#f0fdfa", accent: "#0f766e", label: "Hijab", draw: (a) => `<ellipse cx="400" cy="320" rx="140" ry="160" fill="${a}"/><path d="M260 360c40 120 240 120 280 0" fill="${a}"/>` },
  saree: { bg: "#fff7ed", accent: "#ea580c", label: "Saree", draw: (a) => `<path d="M260 160h120v480H260z" fill="${a}"/><path d="M380 200c80 40 160 200 120 400H380z" fill="${a}" opacity=".85"/>` },
  dress: { bg: "#fdf2f8", accent: "#be185d", label: "Dress", draw: (a) => `<path d="M320 180l80-30 80 30v60l60 20v40l-60-10 40 340H280l40-340-60 10v-40l60-20z" fill="${a}"/>` },
  flats: { bg: "#fafafa", accent: "#525252", label: "Flats", draw: (a) => `<path d="M200 450c70-70 280-70 380 10v40H230z" fill="${a}"/>` },
  denim: { bg: "#eff6ff", accent: "#1e40af", label: "Jacket", draw: (a) => `<path d="M240 220l160-40 160 40v40l-70-15v300H310V245l-70 15z" fill="${a}"/>` },
  handbag: { bg: "#fff1f2", accent: "#9f1239", label: "Bag", draw: (a) => `<rect x="260" y="300" width="280" height="220" rx="20" fill="${a}"/><path d="M320 300c0-80 160-80 160 0" fill="none" stroke="${a}" stroke-width="24"/>` },
  leggings: { bg: "#f5f3ff", accent: "#6d28d9", label: "Leggings", draw: (a) => `<path d="M310 180h80l25 460h-55l-20-200-20 200h-55z" fill="${a}"/>` },
  earrings: { bg: "#fefce8", accent: "#a16207", label: "Earrings", draw: (a) => `<circle cx="340" cy="280" r="28" fill="${a}"/><circle cx="340" cy="380" r="50" fill="${a}" opacity=".8"/><circle cx="460" cy="280" r="28" fill="${a}"/><circle cx="460" cy="380" r="50" fill="${a}" opacity=".8"/>` },
  palazzo: { bg: "#fdf4ff", accent: "#86198f", label: "Palazzo", draw: (a) => `<path d="M300 200h200l60 420H240z" fill="${a}"/>` },
  wedges: { bg: "#fce7f3", accent: "#c026d3", label: "Wedges", draw: (a) => `<path d="M220 400c90-70 280-50 360 30v40H250z" fill="${a}"/><path d="M500 470l40 90H280l20-40z" fill="${a}"/>` },
  abaya: { bg: "#f8fafc", accent: "#0f172a", label: "Abaya", draw: (a) => `<path d="M280 180l120-40 120 40v480H280z" fill="${a}"/>` },
  scarf: { bg: "#ecfdf5", accent: "#047857", label: "Scarf", draw: (a) => `<path d="M250 250c100-80 300-80 300 40 0 100-80 160-150 160S260 380 250 250z" fill="${a}"/>` },
  phone: { bg: "#e0f2fe", accent: "#0284c7", label: "Phone", draw: (a) => `<rect x="310" y="140" width="180" height="360" rx="28" fill="${a}"/><rect x="330" y="180" width="140" height="260" rx="8" fill="#0c4a6e"/><circle cx="400" cy="470" r="12" fill="#7dd3fc"/>` },
  featurephone: { bg: "#f1f5f9", accent: "#475569", label: "Feature phone", draw: (a) => `<rect x="300" y="160" width="200" height="400" rx="16" fill="${a}"/><rect x="320" y="180" width="160" height="120" fill="#1e293b"/><g fill="#cbd5e1">${[0,1,2,3].map((r)=>[0,1,2].map((c)=>`<rect x="${340+c*40}" y="${330+r*40}" width="28" height="28" rx="4"/>`).join("")).join("")}</g>` },
  laptop: { bg: "#eef2ff", accent: "#4338ca", label: "Laptop", draw: (a) => `<rect x="200" y="200" width="400" height="260" rx="12" fill="${a}"/><rect x="220" y="220" width="360" height="200" fill="#1e1b4b"/><rect x="160" y="460" width="480" height="24" rx="6" fill="${a}"/>` },
  gaminglaptop: { bg: "#0f172a", accent: "#22c55e", label: "Gaming PC", draw: (a) => `<rect x="180" y="200" width="440" height="280" rx="12" fill="#1e293b"/><rect x="200" y="220" width="400" height="220" fill="#020617"/><rect x="160" y="480" width="480" height="28" rx="6" fill="${a}"/>` },
  speaker: { bg: "#fff7ed", accent: "#ea580c", label: "Speaker", draw: (a) => `<rect x="280" y="200" width="240" height="320" rx="40" fill="${a}"/><circle cx="400" cy="320" r="70" fill="#7c2d12"/><circle cx="400" cy="440" r="40" fill="#7c2d12"/>` },
  smartwatch: { bg: "#ecfeff", accent: "#0891b2", label: "Watch", draw: (a) => `<rect x="360" y="160" width="80" height="100" rx="10" fill="${a}"/><rect x="340" y="260" width="120" height="140" rx="28" fill="${a}"/><rect x="360" y="400" width="80" height="100" rx="10" fill="${a}"/><rect x="355" y="275" width="90" height="90" rx="16" fill="#164e63"/>` },
  earbuds: { bg: "#f0fdfa", accent: "#0d9488", label: "Earbuds", draw: (a) => `<rect x="300" y="280" width="200" height="220" rx="40" fill="${a}"/><circle cx="350" cy="360" r="36" fill="#115e59"/><circle cx="450" cy="360" r="36" fill="#115e59"/>` },
  tablet: { bg: "#e0e7ff", accent: "#4f46e5", label: "Tablet", draw: (a) => `<rect x="220" y="160" width="360" height="480" rx="24" fill="${a}"/><rect x="245" y="190" width="310" height="400" rx="8" fill="#312e81"/>` },
  usbhub: { bg: "#f8fafc", accent: "#64748b", label: "USB Hub", draw: (a) => `<rect x="220" y="340" width="360" height="100" rx="16" fill="${a}"/><rect x="250" y="365" width="40" height="50" rx="4" fill="#1e293b"/><rect x="320" y="365" width="40" height="50" rx="4" fill="#1e293b"/><rect x="390" y="365" width="40" height="50" rx="4" fill="#1e293b"/><rect x="460" y="365" width="40" height="50" rx="4" fill="#1e293b"/>` },
  webcam: { bg: "#f1f5f9", accent: "#334155", label: "Webcam", draw: (a) => `<circle cx="400" cy="340" r="110" fill="${a}"/><circle cx="400" cy="340" r="60" fill="#0f172a"/><rect x="370" y="450" width="60" height="80" fill="${a}"/>` },
  keyboard: { bg: "#f8fafc", accent: "#1e293b", label: "Keyboard", draw: (a) => `<rect x="140" y="300" width="520" height="180" rx="16" fill="${a}"/>${[0,1,2,3].map((r)=>[0,1,2,3,4,5,6,7,8,9].map((c)=>`<rect x="${170+c*48}" y="${325+r*35}" width="40" height="26" rx="4" fill="#94a3b8"/>`).join("")).join("")}` },
  monitor: { bg: "#e2e8f0", accent: "#0f172a", label: "Monitor", draw: (a) => `<rect x="160" y="160" width="480" height="320" rx="12" fill="${a}"/><rect x="180" y="180" width="440" height="260" fill="#020617"/><rect x="360" y="480" width="80" height="60" fill="${a}"/><rect x="280" y="540" width="240" height="20" rx="6" fill="${a}"/>` },
  ssd: { bg: "#ecfdf5", accent: "#059669", label: "SSD", draw: (a) => `<rect x="240" y="300" width="320" height="160" rx="16" fill="${a}"/><rect x="270" y="340" width="180" height="20" rx="4" fill="#fff" opacity=".5"/>` },
  router: { bg: "#eff6ff", accent: "#2563eb", label: "Router", draw: (a) => `<rect x="220" y="340" width="360" height="140" rx="16" fill="${a}"/><rect x="300" y="200" width="16" height="150" fill="${a}"/><rect x="484" y="200" width="16" height="150" fill="${a}"/>` },
  charger: { bg: "#fef3c7", accent: "#d97706", label: "Charger", draw: (a) => `<rect x="300" y="260" width="200" height="200" rx="24" fill="${a}"/><rect x="360" y="200" width="80" height="70" rx="8" fill="${a}"/><circle cx="400" cy="360" r="40" fill="#78350f"/>` },
  powerbank: { bg: "#e0f2fe", accent: "#0369a1", label: "Power bank", draw: (a) => `<rect x="280" y="220" width="240" height="360" rx="28" fill="${a}"/><rect x="320" y="280" width="160" height="20" rx="6" fill="#fff" opacity=".4"/>` },
  phonecase: { bg: "#fce7f3", accent: "#db2777", label: "Case", draw: (a) => `<rect x="300" y="160" width="200" height="400" rx="36" fill="${a}" opacity=".5"/><rect x="320" y="190" width="160" height="320" rx="20" fill="none" stroke="${a}" stroke-width="16"/>` },
  glass: { bg: "#f0f9ff", accent: "#0284c7", label: "Glass", draw: (a) => `<rect x="280" y="200" width="240" height="400" rx="20" fill="${a}" opacity=".25"/><path d="M300 240h200" stroke="${a}" stroke-width="8"/>` },
  carmount: { bg: "#fff7ed", accent: "#c2410c", label: "Mount", draw: (a) => `<circle cx="400" cy="300" r="90" fill="${a}"/><rect x="370" y="390" width="60" height="140" rx="10" fill="${a}"/>` },
  cable: { bg: "#f1f5f9", accent: "#475569", label: "Cable", draw: (a) => `<path d="M180 400c80-120 200 120 280 0s180 100 260-20" fill="none" stroke="${a}" stroke-width="28" stroke-linecap="round"/><rect x="150" y="370" width="50" height="60" rx="8" fill="${a}"/><rect x="600" y="350" width="50" height="60" rx="8" fill="${a}"/>` },
  ringlight: { bg: "#fafafa", accent: "#a3a3a3", label: "Ring light", draw: (a) => `<circle cx="400" cy="340" r="160" fill="none" stroke="${a}" stroke-width="40"/><circle cx="400" cy="340" r="70" fill="#e5e5e5"/>` },
  tripod: { bg: "#f8fafc", accent: "#334155", label: "Tripod", draw: (a) => `<circle cx="400" cy="220" r="50" fill="${a}"/><path d="M400 270L280 560M400 270L520 560M400 270V480" stroke="${a}" stroke-width="20" stroke-linecap="round"/>` },
  wirelesspad: { bg: "#ecfeff", accent: "#0891b2", label: "Pad", draw: (a) => `<circle cx="400" cy="400" r="160" fill="${a}"/><circle cx="400" cy="400" r="80" fill="none" stroke="#fff" stroke-width="12"/>` },
  earphones: { bg: "#fdf2f8", accent: "#be185d", label: "Earphones", draw: (a) => `<circle cx="300" cy="280" r="50" fill="${a}"/><circle cx="500" cy="280" r="50" fill="${a}"/><path d="M300 330c0 120 200 120 200 0" fill="none" stroke="${a}" stroke-width="16"/>` },
  otg: { bg: "#f1f5f9", accent: "#64748b", label: "OTG", draw: (a) => `<rect x="300" y="300" width="200" height="80" rx="12" fill="${a}"/><rect x="340" y="250" width="40" height="60" fill="${a}"/><rect x="420" y="250" width="40" height="60" fill="${a}"/>` },
  selfiestick: { bg: "#eff6ff", accent: "#3b82f6", label: "Selfie", draw: (a) => `<rect x="380" y="160" width="40" height="420" rx="12" fill="${a}"/><rect x="340" y="140" width="120" height="50" rx="10" fill="${a}"/>` },
  lenskit: { bg: "#f8fafc", accent: "#0f172a", label: "Lens", draw: (a) => `<circle cx="400" cy="360" r="140" fill="${a}"/><circle cx="400" cy="360" r="80" fill="#334155"/><circle cx="400" cy="360" r="40" fill="#94a3b8"/>` },
  cablebox: { bg: "#fef3c7", accent: "#b45309", label: "Organiser", draw: (a) => `<rect x="220" y="280" width="360" height="220" rx="16" fill="${a}"/><rect x="250" y="320" width="300" height="20" rx="4" fill="#fff" opacity=".4"/>` },
  table: { bg: "#fffbeb", accent: "#b45309", label: "Table", draw: (a) => `<rect x="160" y="300" width="480" height="40" rx="6" fill="${a}"/><rect x="200" y="340" width="30" height="200" fill="${a}"/><rect x="570" y="340" width="30" height="200" fill="${a}"/>` },
  chair: { bg: "#f5f5f4", accent: "#57534e", label: "Chair", draw: (a) => `<rect x="280" y="220" width="240" height="40" rx="6" fill="${a}"/><rect x="300" y="260" width="200" height="160" rx="8" fill="${a}"/><rect x="320" y="420" width="30" height="140" fill="${a}"/><rect x="450" y="420" width="30" height="140" fill="${a}"/>` },
  frypan: { bg: "#1c1917", accent: "#78716c", label: "Fry pan", draw: (a) => `<circle cx="360" cy="380" r="160" fill="${a}"/><rect x="500" y="360" width="160" height="40" rx="12" fill="#a8a29e"/>` },
  cooker: { bg: "#f8fafc", accent: "#64748b", label: "Cooker", draw: (a) => `<ellipse cx="400" cy="280" rx="140" ry="40" fill="${a}"/><rect x="260" y="280" width="280" height="260" rx="20" fill="${a}"/><ellipse cx="400" cy="540" rx="140" ry="30" fill="${a}"/>` },
  spicejars: { bg: "#fff7ed", accent: "#ea580c", label: "Spices", draw: (a) => `<rect x="220" y="320" width="80" height="160" rx="8" fill="${a}"/><rect x="320" y="300" width="80" height="180" rx="8" fill="#c2410c"/><rect x="420" y="320" width="80" height="160" rx="8" fill="#fdba74"/><rect x="520" y="310" width="80" height="170" rx="8" fill="${a}"/>` },
  wallclock: { bg: "#fafafa", accent: "#171717", label: "Clock", draw: (a) => `<circle cx="400" cy="360" r="180" fill="#fff" stroke="${a}" stroke-width="20"/><path d="M400 360V220M400 360L500 400" stroke="${a}" stroke-width="12" stroke-linecap="round"/>` },
  cushion: { bg: "#fdf2f8", accent: "#db2777", label: "Cushion", draw: (a) => `<rect x="220" y="240" width="360" height="300" rx="40" fill="${a}"/><circle cx="400" cy="390" r="60" fill="#fff" opacity=".3"/>` },
  lamp: { bg: "#fffbeb", accent: "#d97706", label: "Lamp", draw: (a) => `<path d="M280 280h240l-40 120H320z" fill="${a}"/><rect x="380" y="400" width="40" height="160" fill="#92400e"/><ellipse cx="400" cy="560" rx="80" ry="20" fill="#92400e"/>` },
  shoerack: { bg: "#f5f5f4", accent: "#78716c", label: "Shoe rack", draw: (a) => `<rect x="200" y="200" width="400" height="20" fill="${a}"/><rect x="200" y="320" width="400" height="20" fill="${a}"/><rect x="200" y="440" width="400" height="20" fill="${a}"/><rect x="200" y="200" width="20" height="360" fill="${a}"/><rect x="580" y="200" width="20" height="360" fill="${a}"/>` },
  bottle: { bg: "#ecfeff", accent: "#0891b2", label: "Bottle", draw: (a) => `<rect x="340" y="200" width="120" height="360" rx="40" fill="${a}"/><rect x="360" y="160" width="80" height="50" rx="10" fill="${a}"/>` },
  plates: { bg: "#fafafa", accent: "#a3a3a3", label: "Plates", draw: (a) => `<circle cx="340" cy="360" r="140" fill="${a}"/><circle cx="460" cy="380" r="140" fill="#d4d4d4"/>` },
  knives: { bg: "#f8fafc", accent: "#475569", label: "Knives", draw: (a) => `<path d="M220 500L480 200l40 30-260 300z" fill="${a}"/><rect x="200" y="480" width="80" height="30" rx="6" fill="#92400e"/>` },
  floormat: { bg: "#ecfdf5", accent: "#059669", label: "Mat", draw: (a) => `<rect x="160" y="280" width="480" height="240" rx="16" fill="${a}"/><path d="M200 320h400M200 380h400M200 440h400" stroke="#fff" stroke-width="8" opacity=".4"/>` },
  storagebox: { bg: "#eff6ff", accent: "#3b82f6", label: "Box", draw: (a) => `<rect x="220" y="280" width="360" height="220" rx="12" fill="${a}"/><rect x="220" y="250" width="360" height="40" rx="8" fill="#1d4ed8"/>` },
  kettle: { bg: "#f1f5f9", accent: "#64748b", label: "Kettle", draw: (a) => `<path d="M280 300h240l20 220H260z" fill="${a}"/><path d="M520 340c60 0 60 120 0 120" fill="none" stroke="${a}" stroke-width="24"/><rect x="360" y="240" width="80" height="60" rx="8" fill="${a}"/>` },
  serum: { bg: "#fdf4ff", accent: "#c026d3", label: "Serum", draw: (a) => `<rect x="350" y="240" width="100" height="280" rx="16" fill="${a}"/><rect x="370" y="180" width="60" height="70" rx="8" fill="${a}"/><circle cx="400" cy="160" r="20" fill="#86198f"/>` },
  facewash: { bg: "#ecfdf5", accent: "#10b981", label: "Face wash", draw: (a) => `<rect x="320" y="240" width="160" height="300" rx="24" fill="${a}"/><rect x="360" y="200" width="80" height="50" rx="10" fill="#047857"/>` },
  sunscreen: { bg: "#fffbeb", accent: "#f59e0b", label: "SPF", draw: (a) => `<rect x="330" y="220" width="140" height="340" rx="20" fill="${a}"/><rect x="360" y="180" width="80" height="50" fill="#b45309"/>` },
  lipstick: { bg: "#fff1f2", accent: "#e11d48", label: "Lipstick", draw: (a) => `<rect x="370" y="360" width="60" height="200" rx="8" fill="${a}"/><path d="M370 360l30-120 30 120z" fill="#be123c"/>` },
  kajal: { bg: "#18181b", accent: "#a1a1aa", label: "Kajal", draw: (a) => `<rect x="360" y="200" width="80" height="360" rx="10" fill="${a}"/><rect x="360" y="200" width="80" height="80" fill="#3f3f46"/>` },
  powder: { bg: "#fdf2f8", accent: "#ec4899", label: "Powder", draw: (a) => `<circle cx="400" cy="380" r="150" fill="${a}"/><circle cx="400" cy="380" r="100" fill="#fbcfe8"/>` },
  hairoil: { bg: "#fff7ed", accent: "#ea580c", label: "Hair oil", draw: (a) => `<rect x="340" y="260" width="120" height="280" rx="16" fill="${a}"/><rect x="370" y="200" width="60" height="70" fill="#c2410c"/>` },
  shampoo: { bg: "#e0f2fe", accent: "#0284c7", label: "Shampoo", draw: (a) => `<path d="M330 260h140l20 320H310z" fill="${a}"/><rect x="360" y="200" width="80" height="70" rx="12" fill="#0369a1"/>` },
  hairserum: { bg: "#faf5ff", accent: "#9333ea", label: "Serum", draw: (a) => `<rect x="355" y="250" width="90" height="300" rx="14" fill="${a}"/><rect x="375" y="200" width="50" height="60" fill="#6b21a8"/>` },
  cream: { bg: "#fdf2f8", accent: "#f472b6", label: "Cream", draw: (a) => `<rect x="280" y="320" width="240" height="180" rx="20" fill="${a}"/><ellipse cx="400" cy="320" rx="120" ry="40" fill="#fb7185"/>` },
  lotion: { bg: "#ecfdf5", accent: "#14b8a6", label: "Lotion", draw: (a) => `<rect x="330" y="240" width="140" height="320" rx="24" fill="${a}"/><rect x="360" y="190" width="80" height="60" rx="10" fill="#0f766e"/>` },
  nailpolish: { bg: "#fdf2f8", accent: "#db2777", label: "Nail", draw: (a) => `<rect x="360" y="300" width="80" height="200" rx="10" fill="${a}"/><rect x="375" y="220" width="50" height="90" fill="#9d174d"/>` },
  facemask: { bg: "#f0fdfa", accent: "#0d9488", label: "Mask", draw: (a) => `<rect x="260" y="240" width="280" height="320" rx="24" fill="${a}"/><circle cx="400" cy="360" r="60" fill="#fff" opacity=".4"/>` },
  brow: { bg: "#f5f5f4", accent: "#78716c", label: "Brow", draw: (a) => `<rect x="300" y="360" width="200" height="30" rx="8" fill="${a}"/><polygon points="500,360 560,340 560,410 500,390" fill="${a}"/>` },
  hairclips: { bg: "#fce7f3", accent: "#ec4899", label: "Clips", draw: (a) => `<rect x="260" y="360" width="120" height="40" rx="12" fill="${a}"/><rect x="420" y="360" width="120" height="40" rx="12" fill="#f9a8d4"/>` },
  tea: { bg: "#ecfdf5", accent: "#166534", label: "Tea", draw: (a) => `<rect x="280" y="240" width="240" height="300" rx="16" fill="${a}"/><rect x="310" y="280" width="180" height="120" fill="#14532d"/>` },
  oil: { bg: "#fffbeb", accent: "#ca8a04", label: "Oil", draw: (a) => `<path d="M340 240h120l40 320H300z" fill="${a}"/><rect x="370" y="200" width="60" height="50" fill="#a16207"/>` },
  rice: { bg: "#fefce8", accent: "#a16207", label: "Rice", draw: (a) => `<rect x="260" y="220" width="280" height="360" rx="20" fill="${a}"/><text x="400" y="420" text-anchor="middle" fill="#fff" font-size="48" font-family="Arial" font-weight="700">Rice</text>` },
  spices: { bg: "#fff7ed", accent: "#ea580c", label: "Masala", draw: (a) => `<circle cx="320" cy="360" r="70" fill="${a}"/><circle cx="400" cy="300" r="70" fill="#c2410c"/><circle cx="480" cy="360" r="70" fill="#fdba74"/>` },
  honey: { bg: "#fffbeb", accent: "#d97706", label: "Honey", draw: (a) => `<rect x="320" y="260" width="160" height="280" rx="16" fill="${a}"/><ellipse cx="400" cy="260" rx="80" ry="30" fill="#fbbf24"/>` },
  biscuits: { bg: "#fef3c7", accent: "#b45309", label: "Biscuits", draw: (a) => `<rect x="240" y="280" width="320" height="220" rx="16" fill="${a}"/><circle cx="320" cy="390" r="40" fill="#92400e"/><circle cx="400" cy="390" r="40" fill="#92400e"/><circle cx="480" cy="390" r="40" fill="#92400e"/>` },
  noodles: { bg: "#fff7ed", accent: "#f97316", label: "Noodles", draw: (a) => `<rect x="260" y="260" width="280" height="280" rx="20" fill="${a}"/><path d="M300 340c40 40 160 40 200 0M300 400c40 40 160 40 200 0M300 460c40 40 160 40 200 0" stroke="#fff" stroke-width="14" fill="none"/>` },
  lentils: { bg: "#fff7ed", accent: "#c2410c", label: "Dal", draw: (a) => `<rect x="270" y="240" width="260" height="320" rx="16" fill="${a}"/>` },
  pickle: { bg: "#fef2f2", accent: "#dc2626", label: "Pickle", draw: (a) => `<rect x="320" y="260" width="160" height="280" rx="16" fill="${a}"/><ellipse cx="400" cy="260" rx="80" ry="28" fill="#991b1b"/>` },
  coffee: { bg: "#44403c", accent: "#a8a29e", label: "Coffee", draw: (a) => `<rect x="300" y="240" width="200" height="300" rx="16" fill="${a}"/><rect x="340" y="200" width="120" height="50" fill="#292524"/>` },
  dates: { bg: "#78350f", accent: "#fbbf24", label: "Dates", draw: (a) => `<ellipse cx="340" cy="360" rx="50" ry="90" fill="${a}"/><ellipse cx="420" cy="380" rx="50" ry="90" fill="#92400e"/><ellipse cx="480" cy="350" rx="45" ry="80" fill="${a}"/>` },
  ghee: { bg: "#fefce8", accent: "#eab308", label: "Ghee", draw: (a) => `<rect x="300" y="280" width="200" height="240" rx="16" fill="${a}"/><ellipse cx="400" cy="280" rx="100" ry="36" fill="#facc15"/>` },
  chanachur: { bg: "#fff7ed", accent: "#ea580c", label: "Snack", draw: (a) => `<rect x="260" y="240" width="280" height="320" rx="20" fill="${a}"/>` },
  salt: { bg: "#f8fafc", accent: "#94a3b8", label: "Salt", draw: (a) => `<rect x="320" y="240" width="160" height="320" rx="12" fill="${a}"/>` },
  greentea: { bg: "#ecfdf5", accent: "#16a34a", label: "Green tea", draw: (a) => `<rect x="280" y="260" width="240" height="280" rx="16" fill="${a}"/><circle cx="400" cy="380" r="50" fill="#14532d"/>` },
  novel: { bg: "#eef2ff", accent: "#4f46e5", label: "Novel", draw: (a) => `<rect x="260" y="180" width="200" height="400" rx="8" fill="${a}"/><rect x="360" y="200" width="200" height="400" rx="8" fill="#6366f1"/>` },
  storybook: { bg: "#fce7f3", accent: "#db2777", label: "Story", draw: (a) => `<rect x="240" y="200" width="320" height="400" rx="12" fill="${a}"/><circle cx="400" cy="360" r="70" fill="#fff" opacity=".35"/>` },
  notebook: { bg: "#f8fafc", accent: "#334155", label: "Notebook", draw: (a) => `<rect x="260" y="180" width="280" height="400" rx="8" fill="${a}"/><path d="M300 240h200M300 300h200M300 360h200M300 420h200" stroke="#fff" stroke-width="6" opacity=".4"/>` },
  pens: { bg: "#ecfeff", accent: "#0891b2", label: "Pens", draw: (a) => `<rect x="280" y="200" width="30" height="360" rx="8" fill="${a}"/><rect x="340" y="180" width="30" height="380" rx="8" fill="#0e7490"/><rect x="400" y="210" width="30" height="350" rx="8" fill="#22d3ee"/><rect x="460" y="190" width="30" height="370" rx="8" fill="${a}"/>` },
  geometry: { bg: "#f1f5f9", accent: "#64748b", label: "Geometry", draw: (a) => `<rect x="240" y="260" width="320" height="220" rx="12" fill="${a}"/><circle cx="340" cy="370" r="40" fill="none" stroke="#fff" stroke-width="8"/><path d="M420 320l80 100H420z" fill="#fff" opacity=".5"/>` },
  colorpencils: { bg: "#fef3c7", accent: "#ea580c", label: "Colours", draw: (a) => `${["#ef4444","#f59e0b","#22c55e","#3b82f6","#a855f7"].map((c,i)=>`<rect x="${260+i*60}" y="220" width="40" height="320" rx="8" fill="${c}"/>`).join("")}` },
  guide: { bg: "#eff6ff", accent: "#2563eb", label: "Guide", draw: (a) => `<rect x="250" y="180" width="300" height="420" rx="10" fill="${a}"/><text x="400" y="400" text-anchor="middle" fill="#fff" font-size="42" font-family="Arial" font-weight="700">Math</text>` },
  dictionary: { bg: "#f5f5f4", accent: "#57534e", label: "Dict", draw: (a) => `<rect x="240" y="180" width="320" height="420" rx="10" fill="${a}"/>` },
  stickynotes: { bg: "#fefce8", accent: "#eab308", label: "Notes", draw: (a) => `<rect x="260" y="260" width="160" height="160" fill="${a}"/><rect x="360" y="300" width="160" height="160" fill="#fde047"/><rect x="300" y="340" width="160" height="160" fill="#facc15"/>` },
  fountainpen: { bg: "#eef2ff", accent: "#4338ca", label: "Pen", draw: (a) => `<rect x="360" y="180" width="80" height="360" rx="12" fill="${a}"/><polygon points="360,540 440,540 400,620" fill="#1e1b4b"/>` },
  sketchpad: { bg: "#fafafa", accent: "#a3a3a3", label: "Sketch", draw: (a) => `<rect x="220" y="160" width="360" height="480" rx="12" fill="${a}"/><path d="M280 400c40-80 200-40 240 40" fill="none" stroke="#525252" stroke-width="10"/>` },
  markers: { bg: "#fdf2f8", accent: "#db2777", label: "Markers", draw: (a) => `${["#ef4444","#22c55e","#3b82f6","#eab308"].map((c,i)=>`<rect x="${280+i*70}" y="200" width="50" height="360" rx="10" fill="${c}"/>`).join("")}` },
  alphabet: { bg: "#ecfdf5", accent: "#16a34a", label: "ABC", draw: (a) => `<rect x="240" y="200" width="320" height="400" rx="16" fill="${a}"/><text x="400" y="420" text-anchor="middle" fill="#fff" font-size="72" font-family="Arial" font-weight="800">অ A</text>` },
  planner: { bg: "#eef2ff", accent: "#6366f1", label: "Planner", draw: (a) => `<rect x="240" y="180" width="320" height="440" rx="12" fill="${a}"/><rect x="280" y="240" width="240" height="40" rx="6" fill="#fff" opacity=".3"/>` },
  exampad: { bg: "#f8fafc", accent: "#94a3b8", label: "Exam pad", draw: (a) => `<rect x="250" y="160" width="300" height="480" rx="8" fill="${a}"/><path d="M290 240h220M290 300h220M290 360h220" stroke="#64748b" stroke-width="4"/>` },
  yogamat: { bg: "#ecfdf5", accent: "#059669", label: "Yoga", draw: (a) => `<rect x="160" y="280" width="480" height="200" rx="20" fill="${a}"/>` },
  dumbbell: { bg: "#f1f5f9", accent: "#334155", label: "Dumbbell", draw: (a) => `<rect x="300" y="360" width="200" height="40" rx="8" fill="${a}"/><rect x="220" y="320" width="80" height="120" rx="12" fill="${a}"/><rect x="500" y="320" width="80" height="120" rx="12" fill="${a}"/>` },
  football: { bg: "#fff7ed", accent: "#ea580c", label: "Football", draw: (a) => `<circle cx="400" cy="380" r="160" fill="${a}"/><path d="M400 220l50 100h-100zM300 360l100 40 40-100M500 360l-100 40-40-100" fill="#fff" opacity=".3"/>` },
  cricketbat: { bg: "#fffbeb", accent: "#b45309", label: "Bat", draw: (a) => `<rect x="360" y="160" width="80" height="360" rx="20" fill="${a}"/><rect x="375" y="520" width="50" height="120" rx="8" fill="#78350f"/>` },
  skippingrope: { bg: "#eef2ff", accent: "#4f46e5", label: "Rope", draw: (a) => `<circle cx="240" cy="400" r="40" fill="${a}"/><circle cx="560" cy="400" r="40" fill="${a}"/><path d="M280 400c80-160 240-160 320 0" fill="none" stroke="${a}" stroke-width="16"/>` },
  jersey: { bg: "#eff6ff", accent: "#2563eb", label: "Jersey", draw: (a) => `<path d="M260 220l140-50 140 50v40l-70-20v320H330V240l-70 20z" fill="${a}"/><text x="400" y="400" text-anchor="middle" fill="#fff" font-size="64" font-family="Arial" font-weight="800">10</text>` },
  runningshoes: { bg: "#ecfeff", accent: "#0e7490", label: "Run", draw: (a) => `<path d="M180 420c50-100 240-120 400-20 30 20 40 60 20 90H200c-40 0-40-40-20-70z" fill="${a}"/>` },
  resistance: { bg: "#fdf2f8", accent: "#db2777", label: "Bands", draw: (a) => `<ellipse cx="400" cy="360" rx="200" ry="80" fill="none" stroke="${a}" stroke-width="28"/><ellipse cx="400" cy="360" rx="140" ry="50" fill="none" stroke="#f9a8d4" stroke-width="20"/>` },
  sportsbottle: { bg: "#e0f2fe", accent: "#0284c7", label: "Bottle", draw: (a) => `<rect x="340" y="220" width="120" height="340" rx="30" fill="${a}"/><rect x="365" y="170" width="70" height="60" rx="10" fill="#0369a1"/>` },
  gymgloves: { bg: "#f8fafc", accent: "#475569", label: "Gloves", draw: (a) => `<path d="M280 300c0-40 60-80 100-40v200H280z" fill="${a}"/><path d="M420 300c0-40 60-80 100-40v200H420z" fill="${a}"/>` },
  badminton: { bg: "#ecfdf5", accent: "#16a34a", label: "Racket", draw: (a) => `<ellipse cx="400" cy="280" rx="120" ry="150" fill="none" stroke="${a}" stroke-width="20"/><rect x="385" y="420" width="30" height="180" rx="8" fill="${a}"/>` },
  shuttlecock: { bg: "#f8fafc", accent: "#94a3b8", label: "Shuttle", draw: (a) => `<path d="M400 500l-80-260h160z" fill="${a}"/><circle cx="400" cy="500" r="40" fill="#64748b"/>` },
  compression: { bg: "#0f172a", accent: "#22d3ee", label: "Tights", draw: (a) => `<path d="M310 180h80l25 460h-55l-20-200-20 200h-55z" fill="${a}"/>` },
  foamroller: { bg: "#faf5ff", accent: "#9333ea", label: "Roller", draw: (a) => `<rect x="160" y="320" width="480" height="120" rx="60" fill="${a}"/>` },
  sportscap: { bg: "#eff6ff", accent: "#3b82f6", label: "Cap", draw: (a) => `<ellipse cx="400" cy="380" rx="150" ry="45" fill="${a}"/><path d="M270 380c20-90 240-90 260 0" fill="${a}"/>` },
  teddy: { bg: "#fff7ed", accent: "#c2410c", label: "Teddy", draw: (a) => `<circle cx="320" cy="260" r="50" fill="${a}"/><circle cx="480" cy="260" r="50" fill="${a}"/><circle cx="400" cy="340" r="100" fill="${a}"/><ellipse cx="400" cy="520" rx="120" ry="140" fill="${a}"/>` },
  blocks: { bg: "#fef3c7", accent: "#ea580c", label: "Blocks", draw: (a) => `<rect x="240" y="400" width="120" height="120" fill="#ef4444"/><rect x="360" y="400" width="120" height="120" fill="#22c55e"/><rect x="300" y="280" width="120" height="120" fill="#3b82f6"/>` },
  remotecar: { bg: "#fee2e2", accent: "#dc2626", label: "RC car", draw: (a) => `<rect x="200" y="340" width="400" height="100" rx="30" fill="${a}"/><circle cx="280" cy="450" r="40" fill="#111"/><circle cx="520" cy="450" r="40" fill="#111"/>` },
  puzzle: { bg: "#e0f2fe", accent: "#0284c7", label: "Puzzle", draw: (a) => `<rect x="240" y="240" width="150" height="150" fill="${a}"/><rect x="410" y="240" width="150" height="150" fill="#38bdf8"/><rect x="240" y="410" width="150" height="150" fill="#7dd3fc"/><rect x="410" y="410" width="150" height="150" fill="${a}"/>` },
  colouring: { bg: "#fdf2f8", accent: "#ec4899", label: "Colour", draw: (a) => `<rect x="240" y="200" width="320" height="400" rx="12" fill="${a}"/><rect x="280" y="260" width="40" height="200" fill="#ef4444"/><rect x="340" y="260" width="40" height="200" fill="#eab308"/><rect x="400" y="260" width="40" height="200" fill="#22c55e"/>` },
  kidsfootball: { bg: "#ecfdf5", accent: "#16a34a", label: "Mini ball", draw: (a) => `<circle cx="400" cy="380" r="140" fill="${a}"/>` },
  doll: { bg: "#fce7f3", accent: "#db2777", label: "Doll", draw: (a) => `<circle cx="400" cy="240" r="60" fill="#f9a8d4"/><path d="M320 320h160v240H320z" fill="${a}"/>` },
  stacking: { bg: "#fef3c7", accent: "#f59e0b", label: "Stack", draw: (a) => `<ellipse cx="400" cy="500" rx="160" ry="40" fill="#ef4444"/><ellipse cx="400" cy="430" rx="130" ry="35" fill="#f59e0b"/><ellipse cx="400" cy="360" rx="100" ry="30" fill="#eab308"/><ellipse cx="400" cy="300" rx="70" ry="25" fill="#22c55e"/><circle cx="400" cy="250" r="30" fill="#3b82f6"/>` },
  scooter: { bg: "#e0f2fe", accent: "#0284c7", label: "Scooter", draw: (a) => `<circle cx="280" cy="500" r="50" fill="#111"/><circle cx="520" cy="500" r="50" fill="#111"/><path d="M280 450h240l40-160H400" fill="none" stroke="${a}" stroke-width="24"/><rect x="380" y="220" width="60" height="80" rx="8" fill="${a}"/>` },
  flashcards: { bg: "#eef2ff", accent: "#6366f1", label: "Cards", draw: (a) => `<rect x="260" y="240" width="200" height="280" rx="12" fill="${a}"/><rect x="340" y="280" width="200" height="280" rx="12" fill="#818cf8"/>` },
  bathtoys: { bg: "#ecfeff", accent: "#06b6d4", label: "Bath", draw: (a) => `<ellipse cx="320" cy="400" rx="80" ry="50" fill="${a}"/><circle cx="480" cy="380" r="70" fill="#22d3ee"/><circle cx="400" cy="480" r="55" fill="#67e8f9"/>` },
  lcdboard: { bg: "#0f172a", accent: "#22c55e", label: "LCD", draw: (a) => `<rect x="200" y="200" width="400" height="360" rx="20" fill="#1e293b"/><rect x="230" y="230" width="340" height="260" fill="#020617"/><circle cx="400" cy="530" r="16" fill="${a}"/>` },
  bubblegun: { bg: "#f0fdfa", accent: "#14b8a6", label: "Bubbles", draw: (a) => `<rect x="240" y="340" width="280" height="80" rx="20" fill="${a}"/><circle cx="560" cy="300" r="40" fill="#99f6e4"/><circle cx="600" cy="360" r="28" fill="#5eead4"/>` },
  elephant: { bg: "#e0e7ff", accent: "#6366f1", label: "Elephant", draw: (a) => `<ellipse cx="400" cy="400" rx="160" ry="120" fill="${a}"/><circle cx="300" cy="320" r="70" fill="${a}"/><path d="M260 340c-40 60-40 140 20 160" fill="none" stroke="${a}" stroke-width="36"/>` },
  boardgame: { bg: "#fef3c7", accent: "#d97706", label: "Game", draw: (a) => `<rect x="200" y="200" width="400" height="400" rx="16" fill="${a}"/><path d="M200 400h400M400 200v400" stroke="#fff" stroke-width="8"/><circle cx="300" cy="300" r="30" fill="#ef4444"/><circle cx="500" cy="500" r="30" fill="#3b82f6"/>` },
};

function productSvg(key) {
  const t = TYPES[key];
  if (!t) throw new Error(`Unknown type ${key}`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img">
  <title>${t.label}</title>
  <rect width="800" height="800" fill="${t.bg}"/>
  <circle cx="650" cy="120" r="100" fill="${t.accent}" opacity=".12"/>
  <circle cx="120" cy="680" r="120" fill="${t.accent}" opacity=".1"/>
  ${t.draw(t.accent)}
  <text x="40" y="760" fill="${t.accent}" font-family="Segoe UI,Arial,sans-serif" font-size="28" font-weight="700">${t.label}</text>
</svg>
`;
}

function shopLogo(name, bg, accent) {
  const letter = name.replace(/[^A-Za-zঅ-হা]/u, "").slice(0, 1) || name.slice(0, 1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" rx="80" fill="${bg}"/>
  <circle cx="200" cy="200" r="120" fill="${accent}"/>
  <text x="200" y="220" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial,sans-serif" font-size="120" font-weight="800">${letter}</text>
</svg>
`;
}

function shopBanner(name, bg, accent) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${accent}"/></linearGradient></defs>
  <rect width="1200" height="400" fill="url(#g)"/>
  <circle cx="1000" cy="80" r="160" fill="#fff" opacity=".12"/>
  <text x="64" y="220" fill="#fff" font-family="Segoe UI,Arial,sans-serif" font-size="64" font-weight="800">${name}</text>
</svg>
`;
}

function reelThumb(name, bg, accent) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${accent}"/></linearGradient></defs>
  <rect width="720" height="1280" fill="url(#g)"/>
  <circle cx="360" cy="520" r="180" fill="#fff" opacity=".2"/>
  <text x="360" y="540" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial,sans-serif" font-size="48" font-weight="800">${name}</text>
  <text x="360" y="1100" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial,sans-serif" font-size="28" opacity=".9">EME Reel</text>
</svg>
`;
}

/** Product id suffix (1-150) -> type key */
const PRODUCT_TYPES = [
  // Purush 1-15
  "panjabi","jeans","shirt","sandals","sneakers","belt","hoodie","shorts","loafers","undershirt","shirt","trackpants","cap","socks","blazer",
  // Nari 16-30
  "salwar","kurti","heels","hijab","saree","dress","flats","denim","handbag","leggings","earrings","palazzo","wedges","abaya","scarf",
  // Gadget 31-45
  "phone","phone","featurephone","laptop","gaminglaptop","speaker","smartwatch","earbuds","tablet","usbhub","webcam","keyboard","monitor","ssd","router",
  // Case 46-60
  "charger","powerbank","phonecase","phonecase","glass","carmount","cable","ringlight","tripod","wirelesspad","earphones","otg","selfiestick","lenskit","cablebox",
  // Home 61-75
  "table","chair","frypan","cooker","spicejars","wallclock","cushion","lamp","shoerack","bottle","plates","knives","floormat","storagebox","kettle",
  // Beauty 76-90
  "serum","facewash","sunscreen","lipstick","kajal","powder","hairoil","shampoo","hairserum","cream","lotion","nailpolish","facemask","brow","hairclips",
  // Grocery 91-105
  "tea","oil","rice","spices","honey","biscuits","noodles","lentils","pickle","coffee","dates","ghee","chanachur","salt","greentea",
  // Books 106-120
  "novel","storybook","notebook","pens","geometry","colorpencils","guide","dictionary","stickynotes","fountainpen","sketchpad","markers","alphabet","planner","exampad",
  // Sports 121-135
  "yogamat","dumbbell","football","cricketbat","skippingrope","jersey","runningshoes","resistance","sportsbottle","gymgloves","badminton","shuttlecock","compression","foamroller","sportscap",
  // Toys 136-150
  "teddy","blocks","remotecar","puzzle","colouring","kidsfootball","doll","stacking","scooter","flashcards","bathtoys","lcdboard","bubblegun","elephant","boardgame",
];

const SHOPS = [
  { slug: "purush-lane", name: "Purush Lane", bg: "#0f766e", accent: "#115e59" },
  { slug: "nari-atelier", name: "Nari Atelier", bg: "#be185d", accent: "#9d174d" },
  { slug: "gadget-bazar", name: "Gadget Bazar", bg: "#1d4ed8", accent: "#1e3a8a" },
  { slug: "case-corner", name: "Case Corner", bg: "#ea580c", accent: "#c2410c" },
  { slug: "ghor-o-ranna", name: "Ghor O Ranna", bg: "#b45309", accent: "#92400e" },
  { slug: "rupchaya-beauty", name: "Rupchaya Beauty", bg: "#db2777", accent: "#9d174d" },
  { slug: "bazaar-basket", name: "Bazaar Basket", bg: "#16a34a", accent: "#166534" },
  { slug: "boighar", name: "Boighar", bg: "#4f46e5", accent: "#3730a3" },
  { slug: "khelaghar", name: "Khelaghar", bg: "#0891b2", accent: "#0e7490" },
  { slug: "choto-bondhu", name: "Choto Bondhu", bg: "#e11d48", accent: "#be123c" },
];

// Write unique product type SVGs
const used = new Set(PRODUCT_TYPES);
for (const key of used) {
  fs.writeFileSync(path.join(productDir, `${key}.svg`), productSvg(key), "utf8");
}

for (const shop of SHOPS) {
  fs.writeFileSync(path.join(shopDir, `${shop.slug}-logo.svg`), shopLogo(shop.name, shop.bg, shop.accent), "utf8");
  fs.writeFileSync(path.join(shopDir, `${shop.slug}-banner.svg`), shopBanner(shop.name, shop.bg, shop.accent), "utf8");
  for (let i = 1; i <= 3; i++) {
    fs.writeFileSync(
      path.join(reelDir, `${shop.slug}-reel-${i}.svg`),
      reelThumb(shop.name, shop.bg, shop.accent),
      "utf8",
    );
  }
}

// Build SQL update file
const pid = (n) => `d2222222-d222-4222-8222-${String(n).padStart(12, "0")}`;
const iid = (n) => `d3333333-d333-4333-8333-${String(n).padStart(12, "0")}`;
const shopId = (n) => `d1111111-d111-4111-8111-${String(n).padStart(12, "0")}`;
const reelId = (n) => `d5555555-d555-4555-8555-${String(n).padStart(12, "0")}`;

const imageRows = PRODUCT_TYPES.map((type, i) => {
  const n = i + 1;
  return `  ('${iid(n)}'::uuid, '${pid(n)}'::uuid, '${pub(`products/${type}.svg`)}', 0, true)`;
}).join(",\n");

const shopUpdates = SHOPS.map((shop, i) => {
  const id = shopId(i + 1);
  return `update public.vendor_profiles set
  logo_url = '${pub(`shops/${shop.slug}-logo.svg`)}',
  banner_url = '${pub(`shops/${shop.slug}-banner.svg`)}'
where profile_id = '${id}';`;
}).join("\n\n");

const reelUpdates = SHOPS.flatMap((shop, si) =>
  [1, 2, 3].map((ri) => {
    const n = si * 3 + ri;
    return `update public.reels set thumbnail_path = '${pub(`reels/${shop.slug}-reel-${ri}.svg`)}'
where id = '${reelId(n)}';`;
  }),
).join("\n");

const sql = `-- seed_demo_images.sql
-- Safe re-run: deletes demo product_images then inserts matching SVG URLs.
-- Requires files uploaded to Storage bucket product-images under demo/
-- (see supabase/scripts/upload-demo-images.md).
-- Does not create duplicate primary images.

begin;

delete from public.product_images
where product_id between '${pid(1)}' and '${pid(150)}'
   or id between '${iid(1)}' and '${iid(150)}';

insert into public.product_images (id, product_id, storage_path, sort_order, is_primary)
values
${imageRows}
on conflict (id) do update set
  product_id = excluded.product_id,
  storage_path = excluded.storage_path,
  sort_order = excluded.sort_order,
  is_primary = excluded.is_primary;

${shopUpdates}

${reelUpdates}

commit;
`;

fs.writeFileSync(path.join(root, "supabase/seed_demo_images.sql"), sql, "utf8");

const mapLines = PRODUCT_TYPES.map((type, i) => {
  const n = i + 1;
  return `${String(n).padStart(3, "0")} | ${pid(n)} | ${type}.svg | ${pub(`products/${type}.svg`)}`;
});
fs.writeFileSync(
  path.join(root, "supabase/scripts/demo-product-image-map.txt"),
  mapLines.join("\n"),
  "utf8",
);

console.log("types", used.size);
console.log("products", PRODUCT_TYPES.length);
console.log("wrote", productDir);
console.log("sql", "supabase/seed_demo_images.sql");
