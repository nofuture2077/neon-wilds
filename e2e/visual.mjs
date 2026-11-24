#!/usr/bin/env node
/**
 * Visual regression test: renders fixed views of a frozen city (dev server, `?quickstart&freeze`)
 * and compares the canvas pixel by pixel with committed baselines in e2e/visual-baselines/.
 *   node e2e/visual.mjs           compare (fails if more than 0.5% of pixels differ noticeably)
 *   node e2e/visual.mjs --update  write new baselines after an intended visual change
 * Moving things (characters, Wildlings, markers) are hidden; flickering lights are off.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const DIR = fileURLToPath(new URL('./visual-baselines/', import.meta.url));
const OUT = process.env.SHOT_DIR ?? 'e2e/screenshots';
const UPDATE = process.argv.includes('--update');
const TOLERANCE = 0.005;
mkdirSync(DIR, { recursive: true });
mkdirSync(OUT, { recursive: true });

/** Views: a time of day and a camera target taken from the layout (landmarks are stable per seed). */
const VIEWS = [
  { name: 'slums-noon', time: '12:00', target: 'spawn' },
  { name: 'oldtown-night', time: '23:00', target: 'Cathedral of Saint Verity' },
  { name: 'harbor-day', time: '10:00', target: 'Night Market' },
  { name: 'outskirts-dusk', time: '19:00', target: 'Marsh Lighthouse' },
  { name: 'downtown-night', time: '22:30', target: 'Lumen Spire' },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
await page.addInitScript(() => localStorage.setItem('neon-wilds-settings', JSON.stringify({ reduceFlashing: true, screenShake: false })));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
let failed = 0;

for (const v of VIEWS) {
  await page.goto(`${BASE}/?quickstart&freeze&seed=1337&time=${v.time}`);
  await page.waitForFunction(() => window.__NEON_WILDS__?.scene?.sim, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate((target) => {
    const s = window.__NEON_WILDS__.scene;
    const L = s.sim.layout;
    const b = target === 'spawn' ? null : L.buildings.find((x) => x.name === target);
    const p = b ? { x: b.x + b.w / 2, y: b.y + b.h + 3 } : L.playerSpawn;
    const cam = s.cameras.main;
    cam.stopFollow();
    s.baseZoom = 1;
    cam.setZoom(1);
    cam.centerOn(Math.round(p.x * 16), Math.round(p.y * 16));
    for (const o of s.children.list) if (o.type === 'Sprite' || o.type === 'Container' || o.type === 'Text') o.setVisible(false);
  }, v.target);
  // Only the rendered world: hide the React overlays (HUD, dialogue, toasts) on top of the canvas.
  await page.addStyleTag({ content: '#root > div > *:not(:first-child) { display: none !important; }' });
  await page.waitForTimeout(400);
  const shot = await page.locator('canvas').first().screenshot();
  const file = `${DIR}${v.name}.png`;
  if (UPDATE || !existsSync(file)) {
    writeFileSync(file, shot);
    console.log(`baseline ${UPDATE ? 'updated' : 'created'}: ${v.name}`);
    continue;
  }
  const res = await page.evaluate(
    async ({ a, b }) => {
      const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { ratio: 1, diff: null };
      const c = document.createElement('canvas');
      c.width = ia.width;
      c.height = ia.height;
      const g = c.getContext('2d');
      g.drawImage(ia, 0, 0);
      const da = g.getImageData(0, 0, c.width, c.height);
      g.drawImage(ib, 0, 0);
      const db = g.getImageData(0, 0, c.width, c.height);
      const out = g.createImageData(c.width, c.height);
      let bad = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
        const hit = d > 24;
        if (hit) bad++;
        out.data[i] = hit ? 255 : db.data[i] * 0.3;
        out.data[i + 1] = hit ? 0 : db.data[i + 1] * 0.3;
        out.data[i + 2] = hit ? 80 : db.data[i + 2] * 0.3;
        out.data[i + 3] = 255;
      }
      g.putImageData(out, 0, 0);
      return { ratio: bad / (da.data.length / 4), diff: c.toDataURL('image/png') };
    },
    { a: `data:image/png;base64,${readFileSync(file).toString('base64')}`, b: `data:image/png;base64,${shot.toString('base64')}` },
  );
  const ok = res.ratio <= TOLERANCE;
  console.log(`${ok ? 'ok' : 'FAIL'} - ${v.name}: ${(res.ratio * 100).toFixed(3)}% of pixels differ`);
  if (!ok) {
    failed++;
    writeFileSync(`${OUT}/visual-${v.name}-actual.png`, shot);
    if (res.diff) writeFileSync(`${OUT}/visual-${v.name}-diff.png`, Buffer.from(res.diff.split(',')[1], 'base64'));
  }
}
await browser.close();
if (errors.length) {
  console.error('page errors:', errors);
  process.exit(1);
}
if (failed) {
  console.error(`${failed} view(s) changed. If intended, run: node e2e/visual.mjs --update`);
  process.exit(1);
}
