#!/usr/bin/env node
/** Generates the app icon set (icon, adaptive icon layers, splash, favicon) with sharp from an inline SVG. */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app/assets/images');
const BG = '#0D1117'; const GOLD = '#C9A84C';

// Stylised "A" with wings — a nod to Aion's daeva wings.
const glyph = (fg, wings) => `
  <g fill="none" stroke="${fg}" stroke-width="46" stroke-linecap="round" stroke-linejoin="round">
    <path d="M512 250 L340 720" /><path d="M512 250 L684 720" /><path d="M400 560 L624 560" />
  </g>
  ${wings ? `<g fill="${fg}" opacity="0.55">
    <path d="M330 470 C240 430 170 360 150 270 C230 300 300 360 350 440 Z" />
    <path d="M694 470 C784 430 854 360 874 270 C794 300 724 360 674 440 Z" />
    <path d="M300 560 C210 560 140 520 100 470 C170 470 240 500 320 520 Z" />
    <path d="M724 560 C814 560 884 520 924 470 C854 470 784 500 704 520 Z" />
  </g>` : ''}`;
const svg = (bg, fg, wings, radius) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bg ? `<rect width="1024" height="1024" rx="${radius}" fill="${bg}"/>` : ''}
  ${bg ? `<circle cx="512" cy="512" r="400" fill="none" stroke="${fg}" stroke-opacity="0.25" stroke-width="18"/>` : ''}
  ${glyph(fg, wings)}
</svg>`;

const render = (s, size, file) => sharp(Buffer.from(s)).resize(size, size).png().toFile(path.join(OUT, file));
fs.mkdirSync(OUT, { recursive: true });
await render(svg(BG, GOLD, true, 0), 1024, 'icon.png');
await render(svg(null, GOLD, true, 0), 1024, 'android-icon-foreground.png');
await render(svg(BG, BG, false, 0), 1024, 'android-icon-background.png');
await render(svg(null, '#FFFFFF', true, 0), 1024, 'android-icon-monochrome.png');
await render(svg(null, GOLD, true, 0), 512, 'splash-icon.png');
await render(svg(BG, GOLD, false, 96), 96, 'favicon.png');
console.log('icons written to', OUT);
