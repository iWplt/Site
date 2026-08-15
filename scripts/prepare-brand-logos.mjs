/**
 * Copy approved WARKA logos into public/brand and knock out paper backgrounds.
 * Does not redraw the emblem — pixel-preserving resize/trim only.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC_CANDIDATES = [
  path.join(ROOT, "assets"),
  path.join(process.env.USERPROFILE || "", ".cursor", "projects", "c-Users-bfd3e-WARKA", "assets")
];
const OUT = path.join(ROOT, "public", "brand");
const APP = path.join(ROOT, "src", "app");

const FILES = {
  primary: "c__Users_bfd3e_AppData_Roaming_Cursor_User_workspaceStorage_5a6aa806c2b4a01b66be567b932f38ed_images_ChatGPT_Image_Aug_15__2026__03_46_22_PM__1_-1a4cdc87-4fdd-4382-a178-403d77615a4a.png",
  icon: "c__Users_bfd3e_AppData_Roaming_Cursor_User_workspaceStorage_5a6aa806c2b4a01b66be567b932f38ed_images_ChatGPT_Image_Aug_15__2026__03_46_22_PM__2_-c20b6dcf-22ce-4429-9be3-1b5269a05d01.png",
  black: "c__Users_bfd3e_AppData_Roaming_Cursor_User_workspaceStorage_5a6aa806c2b4a01b66be567b932f38ed_images_ChatGPT_Image_Aug_15__2026__03_46_23_PM__3_-b9d41bc5-7dd4-4a3a-a17c-80109354f0b5.png",
  reverse: "c__Users_bfd3e_AppData_Roaming_Cursor_User_workspaceStorage_5a6aa806c2b4a01b66be567b932f38ed_images_ChatGPT_Image_Aug_15__2026__03_46_23_PM__4_-35518725-1806-4c93-a597-e25d1984e78f.png"
};

function isPaper(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max >= 215 && min >= 190 && max - min <= 50;
}

function isOlive(r, g, b) {
  return g > r && g > b && r < 90 && g < 110 && b < 80 && (r + g + b) / 3 < 85;
}

async function knockout(buffer, mode) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = Buffer.from(data);
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    if (mode === "paper" && isPaper(r, g, b)) px[i + 3] = 0;
    if (mode === "olive" && isOlive(r, g, b)) px[i + 3] = 0;
  }
  return sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

async function savePng(image, dest, maxEdge) {
  let pipeline = image.png({ compressionLevel: 9, palette: false });
  if (maxEdge) {
    pipeline = pipeline.resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true });
  }
  await pipeline.trim({ threshold: 8 }).toFile(dest);
  const meta = await sharp(dest).metadata();
  console.log(path.basename(dest), `${meta.width}x${meta.height}`);
}

fs.mkdirSync(OUT, { recursive: true });

function sourcePath(name) {
  for (const dir of SRC_CANDIDATES) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Missing logo source: ${name}`);
}

const primaryBuf = fs.readFileSync(sourcePath(FILES.primary));
const iconBuf = fs.readFileSync(sourcePath(FILES.icon));
const blackBuf = fs.readFileSync(sourcePath(FILES.black));
const reverseBuf = fs.readFileSync(sourcePath(FILES.reverse));

await savePng(sharp(primaryBuf), path.join(OUT, "warka-logo-primary.png"), 1024);
await savePng(await knockout(primaryBuf, "paper"), path.join(OUT, "warka-logo-primary-transparent.png"), 1024);

await savePng(sharp(iconBuf), path.join(OUT, "warka-logo-icon.png"), 512);
await savePng(await knockout(iconBuf, "paper"), path.join(OUT, "warka-logo-icon-transparent.png"), 512);

await savePng(sharp(blackBuf), path.join(OUT, "warka-logo-black.png"), 1024);
await savePng(sharp(reverseBuf), path.join(OUT, "warka-logo-reverse.png"), 1024);

const iconTransparent = path.join(OUT, "warka-logo-icon-transparent.png");
const iconMeta = await sharp(iconTransparent).metadata();
const tile = 180;
const fitted = await sharp(iconTransparent)
  .resize(Math.round(tile * 0.78), Math.round(tile * 0.78), { fit: "inside" })
  .toBuffer();
await sharp({
  create: { width: tile, height: tile, channels: 4, background: { r: 63, g: 71, b: 45, alpha: 1 } }
})
  .composite([{ input: fitted, gravity: "center" }])
  .png()
  .toFile(path.join(APP, "apple-icon.png"));

await sharp(path.join(APP, "apple-icon.png")).resize(32, 32).png().toFile(path.join(APP, "icon.png"));
console.log("app icons", iconMeta.width, "source");
