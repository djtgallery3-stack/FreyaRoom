import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'fs';
import path from 'path';

const projectRoot = '/Users/djati/multica_workspaces_desktop-api.multica.ai/djt-c9b3aeaef365/djt-67-a69a9c16b9ae/workdir/FreyaRoom';
const server = await preview({
  root: projectRoot,
  preview: {
    port: 4173,
    host: '127.0.0.1',
    strictPort: true,
  },
});

const baseUrl = server.resolvedUrls.local[0];
const url = `${baseUrl}?debug`;
console.log('Preview server running at', url);

const screenshotDir = path.resolve(projectRoot, '../screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1280, height: 720 },
});

try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log(`[page ${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => console.error(`[page error]`, e));

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'load' });
  console.log('Page loaded, waiting for world init...');

  await page.waitForFunction(() => window.__freya, { timeout: 120000 });
  console.log('World initialized successfully!');

  const aimAtInteractable = (predicate) =>
    page.evaluate((predicate) => {
      const f = window.__freya;
      f.hideStart();
      const item = f.world.interactables.find(
        (i) => i.kind === predicate || i.title === predicate || i.prompt?.includes(predicate),
      );
      if (!item) throw new Error('Interactable not found for predicate: ' + predicate);
      const target = item.proxy.position.clone();
      const pos = target.clone();
      const eyeY = 1.55;
      if (item.kind === 'switch') {
        pos.z -= 1.0;
        pos.y = eyeY;
      } else if (item.kind === 'doll') {
        pos.x += 0.85;
        pos.y = eyeY;
      } else if (item.kind === 'box') {
        pos.z += 0.75;
        pos.y = eyeY;
      } else if (item.kind === 'photo') {
        pos.z += 0.9;
        pos.y = eyeY;
      }
      f.camera.position.copy(pos);
      f.camera.lookAt(target);
      f.camera.rotation.setFromQuaternion(f.camera.quaternion, 'YXZ');
      f.camera.updateMatrixWorld(true);
      f.interaction.update(0.016, true);
      return {
        kind: item.kind,
        prompt: item.prompt,
        hover: f.interaction.hovered?.prompt,
      };
    }, predicate);

  const state = () =>
    page.evaluate(() => ({
      hover: window.__freya.interaction.hovered?.prompt ?? null,
      modal: window.__freya.ui.isOpen,
      top: window.__freya.ui.top?.el.id ?? null,
      isNight: window.__freya.lighting.isNight,
      bgmPlaying: window.__freya.audio.isPlaying,
      muted: window.__freya.audio.muted,
      visitorCount: document.getElementById('visitor-count')?.textContent ?? null,
    }));

  const activate = () => page.evaluate(() => window.__freya.activate());
  const press = (code) => page.evaluate((code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })), code);
  const shot = async (name) => {
    const p = path.join(screenshotDir, `${name}.png`);
    await page.screenshot({ path: p });
    console.log(`Saved screenshot: ${p}`);
  };

  // -------------------------------------------------------------------------
  // 1. Check Visitor Counter & Controls Bar Visibility
  // -------------------------------------------------------------------------
  await wait(1200);
  const s0 = await state();
  console.log('Initial state:', JSON.stringify(s0));
  if (!s0.visitorCount) throw new Error('Visitor counter element is missing or empty');
  console.log('Visitor counter confirmed active:', s0.visitorCount);

  // -------------------------------------------------------------------------
  // 2. Check Memory Box Hover & Activation
  // -------------------------------------------------------------------------
  const boxRes = await aimAtInteractable('box');
  await wait(800);
  console.log('Box hover result:', JSON.stringify(boxRes));
  await shot('t2-1-hover');

  console.log('Activating memory box...');
  await activate();
  await wait(1500);
  console.log('Box opened gallery state:', JSON.stringify(await state()));
  await shot('t2-2-gallery');

  // Click thumbnail for lightbox
  console.log('Clicking thumbnail in gallery...');
  await page.click('#gallery-grid li:nth-child(3) button');
  await wait(800);
  console.log('Lightbox opened state:', JSON.stringify(await state()));
  await shot('t2-3-lightbox');

  // Navigate lightbox & close back to room
  await press('ArrowRight');
  await press('Escape');
  await wait(400);
  await press('Escape');
  await wait(500);

  // -------------------------------------------------------------------------
  // 3. Check 3D Doll Orbit Viewer
  // -------------------------------------------------------------------------
  const dollRes = await aimAtInteractable('doll');
  await wait(800);
  console.log('Doll hover result:', JSON.stringify(dollRes));
  await activate();
  await wait(1500);
  console.log('Orbit viewer state:', JSON.stringify(await state()));
  await shot('t2-4-orbit');
  await press('Escape');
  await wait(500);

  // -------------------------------------------------------------------------
  // 4. Check Wall Photo Board
  // -------------------------------------------------------------------------
  const photoRes = await aimAtInteractable('photo');
  await wait(800);
  console.log('Photo hover result:', JSON.stringify(photoRes));
  await activate();
  await wait(1200);
  console.log('Wall photo lightbox state:', JSON.stringify(await state()));
  await shot('t2-5-photo');
  await press('Escape');
  await wait(400);

  // -------------------------------------------------------------------------
  // 5. Check Physical Light Switch near Door (Moody Night Mode)
  // -------------------------------------------------------------------------
  const switchRes = await aimAtInteractable('switch');
  await wait(800);
  console.log('Light switch hover result:', JSON.stringify(switchRes));

  console.log('Flipping light switch to Moody Night Mode...');
  await activate();
  await wait(1200); // Allow smooth lighting transition
  const nightState = await state();
  console.log('Night Mode state:', JSON.stringify(nightState));
  if (!nightState.isNight) throw new Error('Expected isNight to be true after switch activation');
  await shot('t2-6-night-mood');

  // -------------------------------------------------------------------------
  // 6. Check HUD Light Toggle & Audio Controls
  // -------------------------------------------------------------------------
  console.log('Toggling light back to Day Mode via HUD button...');
  await page.evaluate(() => document.getElementById('light-toggle').click());
  await wait(1200);
  const dayState = await state();
  console.log('Day Mode state:', JSON.stringify(dayState));
  if (dayState.isNight) throw new Error('Expected isNight to be false after HUD toggle');
  await shot('t2-7-day-mood');

  // Test toggling with 'L' keyboard shortcut
  console.log('Testing L key shortcut for light toggle...');
  await press('KeyL');
  await wait(400);
  const nightViaKey = await state();
  if (!nightViaKey.isNight) throw new Error('Expected isNight to be true after KeyL');
  await press('KeyL'); // toggle back to day
  await wait(400);

  // Test Play/Pause
  console.log('Testing Audio Play/Pause...');
  await page.evaluate(() => document.getElementById('play-pause').click());
  await wait(300);
  console.log('After pause state:', JSON.stringify(await state()));
  await page.evaluate(() => document.getElementById('play-pause').click());
  await wait(300);
  console.log('After resume state:', JSON.stringify(await state()));

  // Test Mute
  await page.evaluate(() => document.getElementById('mute').click());
  await wait(300);
  const muteState = await state();
  console.log('After mute state:', JSON.stringify(muteState));
  if (!muteState.muted) throw new Error('Expected muted to be true');
  await page.evaluate(() => document.getElementById('mute').click());
  await wait(300);

  console.log('ALL E2E & VERIFICATION CHECKS COMPLETED SUCCESSFULLY!');
} finally {
  await browser.close();
  server.httpServer.close();
}
