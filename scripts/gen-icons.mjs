import sharp from 'sharp';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const svgContent = Buffer.from(`<svg width="512" height="512" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3DBE8B"/>
      <stop offset="100%" stop-color="#2A6FBF"/>
    </linearGradient>
  </defs>
  <path d="M14 10 H52 C76 10 88 26 88 50 C88 74 76 90 52 90 H14 Z" fill="url(#g)"/>
  <path d="M30 52 L43 65 L70 36" stroke="white" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`);

const sizes = [16, 32, 64, 180, 192, 512];

for (const s of sizes) {
  await sharp(svgContent)
    .resize(s, s)
    .png()
    .toFile(path.join(root, 'public', `icon-${s}.png`));
  console.log(`Generated icon-${s}.png`);
}

// Also generate apple-touch-icon (180x180) with a white background
await sharp(svgContent)
  .resize(180, 180)
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  .png()
  .toFile(path.join(root, 'public', 'apple-touch-icon.png'));
console.log('Generated apple-touch-icon.png');

// favicon.ico equivalent — use 32x32 PNG named favicon.png
await sharp(svgContent)
  .resize(32, 32)
  .png()
  .toFile(path.join(root, 'public', 'favicon.png'));
console.log('Generated favicon.png');

console.log('All icons generated.');
