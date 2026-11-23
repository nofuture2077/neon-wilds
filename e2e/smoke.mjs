#!/usr/bin/env node
/**
 * End-to-end smoke test: drives a real browser through the core loop.
 *   menu → character creation → Last Run mission → Glitchling → trainer battle →
 *   wild battle + capture → pause menu → save → quit → continue → steal a car and drive.
 * Fails on any console error. Usage: BASE_URL=http://localhost:5173 node e2e/smoke.mjs
 * CHROME_PATH can point at a local Chrome; otherwise Playwright's Chromium is used.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = process.env.SHOT_DIR ?? 'e2e/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const step = async (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const sim = (fn, arg) => page.evaluate(fn, arg);
const press = async (key, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(140);
  }
};
const dismissDialogues = async () => {
  for (let i = 0; i < 30; i++) {
    const open = await page.locator('.blink').count();
    if (!open) return;
    await press('e');
  }
};
const goto = (name) =>
  sim((n) => {
    const { sim } = window.__NEON_WILDS__;
    const b = sim.layout.buildings.find((x) => x.name === n);
    sim.player.x = sim.player.prevX = b.entrance.tx + 0.5;
    sim.player.y = sim.player.prevY = b.entrance.ty + 0.5;
    for (const npc of sim.npcs) if (Math.hypot(npc.x - sim.player.x, npc.y - sim.player.y) < 3 && !npc.stationary) npc.x += 8;
  }, name);
const fightUntilOver = async () => {
  for (let i = 0; i < 80; i++) {
    const inBattle = await sim(() => !!document.querySelector('.bottom-52'));
    if (!inBattle) return true;
    const fight = page.getByRole('button', { name: 'Fight' });
    if (await fight.isVisible().catch(() => false)) {
      await fight.click();
      await page.waitForTimeout(120);
      await page.locator('.pixel-button').filter({ hasText: /pow|status/ }).first().click();
    } else {
      const forced = page.locator('.pixel-button:not([disabled])').filter({ hasText: /Lv\d/ }).first();
      if (await forced.isVisible().catch(() => false)) await forced.click();
      else await press('e');
    }
    await page.waitForTimeout(120);
  }
  return false;
};

const assert = (cond, msg) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else console.log('ok -', msg);
};

await page.goto(BASE);
await page.evaluate(() => indexedDB.deleteDatabase('neon-wilds'));
await page.reload();
await page.waitForTimeout(600);
await step('01-menu');
await page.getByText('New Game').click();
await page.locator('input').fill('Nova');
await step('02-create');
await page.getByText('Hit the streets').click();
await page.waitForFunction(() => window.__NEON_WILDS__?.sim);
await page.waitForTimeout(500);
await dismissDialogues();
await step('03-world');
assert(await page.getByText('Pick up the package').isVisible(), 'Last Run objective shown in HUD');

await goto('Vesper Courier Co-op');
await page.waitForTimeout(150);
await press('e');
await dismissDialogues();
await goto('Halcyon Outreach Kiosk');
await page.waitForTimeout(150);
await press('e');
await step('04-hatch');
await dismissDialogues();
const party = await sim(() => window.__NEON_WILDS__.sim.progression.party.map((w) => w.speciesId));
assert(party[0] === 'glitchling', 'Glitchling joined the party');

// Talk to the Aegis agent → trainer battle.
await sim(() => {
  const { sim } = window.__NEON_WILDS__;
  const a = sim.npcs.find((n) => n.id === 'npc-aegis');
  sim.player.x = sim.player.prevX = a.x;
  sim.player.y = sim.player.prevY = a.y - 0.9;
  sim.player.heading = Math.PI / 2;
  sim.progression.party[0].level = 12;
});
await page.waitForTimeout(150);
await press('e');
await dismissDialogues();
await page.waitForTimeout(700);
await step('05-trainer-battle');
assert(await sim(() => !!window.__NEON_WILDS__.sim.battle), 'trainer battle started');
assert(await fightUntilOver(), 'trainer battle finished');
await dismissDialogues();
assert(await sim(() => window.__NEON_WILDS__.sim.progression.defeatedTrainers.includes('npc-aegis')), 'Aegis agent defeated');

await goto('Saint Ottilie Free Clinic');
await page.waitForTimeout(150);
await press('e');
await dismissDialogues();
assert(await sim(() => window.__NEON_WILDS__.sim.progression.missions[0].status === 'completed'), 'Last Run completed');

// Wild encounter + capture.
await sim(() => {
  const { sim } = window.__NEON_WILDS__;
  const w = sim.wildlings[0];
  w.calmUntilTick = 0;
  w.mode = 'idle';
  sim.player.x = sim.player.prevX = w.x;
  sim.player.y = sim.player.prevY = w.y;
});
await page.waitForTimeout(700);
await step('06-wild-battle');
assert(await sim(() => window.__NEON_WILDS__.sim.battle?.kind === 'wild'), 'wild battle started');
await press('e');
await sim(() => {
  const { sim } = window.__NEON_WILDS__;
  const b = sim.battle;
  b.enemy.party[0].hp = 1;
  b.enemy.party[0].status = { kind: 'dazed', turns: 99, stacks: 1 };
  sim.progression.inventory['tin-snare'] = 30;
});
for (let i = 0; i < 60; i++) {
  const inBattle = await sim(() => !!window.__NEON_WILDS__.sim.battle);
  if (!inBattle) break;
  const snare = page.getByRole('button', { name: 'Snare' });
  if (await snare.isVisible().catch(() => false)) {
    await snare.click();
    await page.waitForTimeout(250);
    const option = page.locator('.pixel-button').filter({ hasText: 'Snare' }).filter({ hasText: '×' }).first();
    if (await option.isVisible().catch(() => false)) await option.click();
  }
  await page.waitForTimeout(200);
  await press('e', 2);
}
const captureState = await sim(() => {
  const { sim } = window.__NEON_WILDS__;
  return { battle: sim.battle && { phase: sim.battle.phase, enemy: sim.battle.enemy.party[0], kind: sim.battle.kind }, caught: sim.progression.index.caught, snares: sim.progression.inventory['tin-snare'] };
});
await step('07-capture');
await dismissDialogues();
await press('e', 4);
const caught = await sim(() => window.__NEON_WILDS__.sim.progression.index.caught.length);
if (caught < 2) {
  await step('fail-capture');
  console.error('capture diagnostics:', JSON.stringify(captureState));
}
assert(caught >= 2, `captured a wild Wildling (${caught} species caught)`);

// Pause menu, save, quit, continue.
await page.waitForTimeout(300);
await press('Escape');
await page.waitForTimeout(300);
await step('08-party');
await page.getByRole('button', { name: 'Index' }).click();
await step('09-index');
await page.getByRole('button', { name: 'Save' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Slot 1/ }).click();
await page.waitForTimeout(500);
assert(await page.getByText('Saved to Slot 1').isVisible(), 'saved to slot 1');
await page.getByRole('button', { name: 'Quit' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForFunction(() => window.__NEON_WILDS__?.sim?.progression?.party?.length >= 2, null, { timeout: 5000 });
assert(true, 'continued from save with party restored');
await page.waitForTimeout(500);
await step('10-continued');

// Steal a parked car and drive.
await sim(() => {
  const { sim } = window.__NEON_WILDS__;
  const car = sim.vehicles.find((v) => v.driver === 'none' && v.wreckedTick === null);
  sim.player.x = sim.player.prevX = car.x;
  sim.player.y = sim.player.prevY = car.y + 1.2;
});
await page.waitForTimeout(200);
await press('f');
const before = await sim(() => ({ ...window.__NEON_WILDS__.sim.player }));
await page.keyboard.down('w');
await page.waitForTimeout(900);
await page.keyboard.up('w');
await step('11-driving');
const after = await sim(() => ({ ...window.__NEON_WILDS__.sim.player }));
assert(after.vehicleId && Math.hypot(after.x - before.x, after.y - before.y) > 1, 'stole a car and drove it');
await page.waitForTimeout(1500);
await press('f');
assert(await sim(() => window.__NEON_WILDS__.sim.player.vehicleId === null), 'got out of the car');

const fps = await page.evaluate(
  () =>
    new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const f = () => (++n, performance.now() - t0 < 2000 ? requestAnimationFrame(f) : res(n / 2));
      requestAnimationFrame(f);
    }),
);
console.log('fps', fps);
assert(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
