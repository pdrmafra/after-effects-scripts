import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const publicPath = name => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
// Keep font discovery and caches scoped to the project's supplied fonts.
const fontCache = await mkdtemp(join(tmpdir(), 'transversal-fonts-'));
await mkdir(join(fontCache, 'cache'));
const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const configPath = join(fontCache, 'fonts.conf');
await writeFile(configPath, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>${xml(publicPath('fonts'))}</dir><cachedir>${xml(join(fontCache, 'cache'))}</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE = configPath;
const { default: sharp } = await import('sharp');
const logo = await sharp(await readFile(publicPath('brand/logo-horizontal.svg'))).resize({ width: 282 }).png().toBuffer();
const symbol = await sharp(await readFile(publicPath('brand/symbol.svg'))).resize({ width: 180 }).png().toBuffer();
const text = async (value, size, color, weight = 'Medium') => sharp({
  text: {
    text: `<span foreground="${color}">${value}</span>`,
    font: `Switzer ${weight} ${size}`,
    fontfile: publicPath(`fonts/Switzer-${weight}.otf`),
    rgba: true,
  },
}).png().toBuffer();

await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#F3F1EC' } }).composite([
  { input: logo, left: 65, top: 53 },
  { input: await text('Small tools.', 101, '#121212'), left: 62, top: 218 },
  { input: await text('More motion.', 101, '#FF5A1F'), left: 62, top: 330 },
  { input: symbol, left: 930, top: 255 },
  { input: await text('Free After Effects scripts &amp; utilities by Pedro Mafra', 23, '#65615B', 'Regular'), left: 65, top: 514 },
  { input: await text('transversal.tools', 18, '#65615B', 'Regular'), left: 65, top: 558 },
]).png().toFile(publicPath('social-card.png'));
await rm(fontCache, { recursive: true, force: true });
