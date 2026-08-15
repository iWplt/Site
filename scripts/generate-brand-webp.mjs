import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const srcDir = path.join("public", "warka-brand");
const outDir = path.join(srcDir, "webp");
fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter((name) => name.toLowerCase().endsWith(".png"));

for (const name of files) {
  const input = path.join(srcDir, name);
  const output = path.join(outDir, name.replace(/\.png$/i, ".webp"));
  const isHero = name.startsWith("mobile-hero-");
  const width = isHero ? 1280 : 960;
  const quality = isHero ? 82 : 80;
  await sharp(input)
    .rotate()
    .resize({ width, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toFile(output);
  const inKb = Math.round(fs.statSync(input).size / 1024);
  const outKb = Math.round(fs.statSync(output).size / 1024);
  console.log(`${name} ${inKb}KB -> ${outKb}KB`);
}
