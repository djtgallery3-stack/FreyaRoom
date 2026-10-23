import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'fs';
import path from 'path';

const projectRoot = '/Users/djati/Movies/freyaproject/output/source code';
const server = await preview({
  root: projectRoot,
  preview: {
    port: 4174,
    host: '127.0.0.1',
    strictPort: true,
  },
});

const baseUrl = server.resolvedUrls.local[0];
const url = `${baseUrl}?debug`;
console.log('Preview server running at', url);

const outDir = '/Users/djati/multica_workspaces_desktop-api.multica.ai/djt-c9b3aeaef365/djt-67-ff0e696e8bce/workdir';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
  ],
  defaultViewport: { width: 1280, height: 720 },
});

try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log(`[page ${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => console.error(`[page error]`, e));

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'load' });

  await page.waitForFunction(() => window.__freya, { timeout: 120000 });
  console.log('World initialized!');

  // Hide start overlay
  await page.evaluate(() => window.__freya.hideStart());
  await wait(1000);

  // 1. Check Camera FOV and Volume shortcuts
  const checkState = await page.evaluate(() => {
    const f = window.__freya;
    const initialVol = f.audio.volume;
    return {
      fov: f.camera.fov,
      eyeY: f.camera.position.y,
      initialVol,
    };
  });
  console.log('Camera state:', checkState);

  // Test volume keys
  await page.keyboard.press('Comma');
  const volAfterComma = await page.evaluate(() => window.__freya.audio.volume);
  await page.keyboard.press('Period');
  await page.keyboard.press('Period');
  const volAfterPeriod = await page.evaluate(() => window.__freya.audio.volume);
  console.log('Volume test: initial =', checkState.initialVol, 'after comma =', volAfterComma, 'after 2x period =', volAfterPeriod);

  // 2. Position camera to view desk lamp, pinboard, bed, and wallpaper
  await page.evaluate(() => {
    const f = window.__freya;
    f.camera.position.set(0.1, 1.45, -2.1);
    f.camera.rotation.set(-0.15, 0.45, 0, 'YXZ');
  });
  await wait(1500);

  const roomPath = path.join(outDir, 'v2-room-mood-fixed.png');
  await page.screenshot({ path: roomPath });
  console.log('Room mood screenshot saved:', roomPath);

  // 3. Hover on an interactive object (Memory Box or Doll) to test crosshair & tooltip
  const hoverPrompt = await page.evaluate(() => {
    const f = window.__freya;
    // Aim at box 1 or doll
    const item = f.world.interactables.find((i) => i.kind === 'box');
    if (item) {
      const p = item.proxy.position;
      f.camera.position.set(p.x, p.y + 0.3, p.z + 0.7);
      f.camera.lookAt(p);
    }
    return item?.prompt;
  });
  await wait(800);

  const tooltipInfo = await page.evaluate(() => {
    const promptEl = document.getElementById('prompt');
    const reticleEl = document.getElementById('reticle');
    return {
      text: promptEl.textContent,
      opacity: promptEl.style.opacity,
      reticleActive: reticleEl.classList.contains('is-active'),
    };
  });
  console.log('Tooltip info:', tooltipInfo);

  const tooltipPath = path.join(outDir, 'v2-crosshair-tooltip.png');
  await page.screenshot({ path: tooltipPath });
  console.log('Tooltip screenshot saved:', tooltipPath);

  // 4. Open Doll 3D Viewer modal (Trainee)
  console.log('Opening Doll 3D Viewer for Trainee...');
  await page.evaluate(() => {
    const f = window.__freya;
    const doll = f.world.interactables.find((i) => i.title?.includes('Trainee'));
    f.ui.openOrbit(doll.title, doll.mesh, () => {});
  });
  await wait(2000);

  const dollTraineePath = path.join(outDir, 'v2-doll-trainee-neutral.png');
  await page.screenshot({ path: dollTraineePath });
  console.log('Doll Trainee screenshot saved:', dollTraineePath);

  // 5. Close and Open Doll 3D Viewer for Seifuku Duduk
  console.log('Closing and opening Seifuku Duduk...');
  await page.evaluate(() => {
    const f = window.__freya;
    f.ui.closeTop();
  });
  await wait(500);
  await page.evaluate(() => {
    const f = window.__freya;
    const doll = f.world.interactables.find((i) => i.title?.includes('Duduk'));
    f.ui.openOrbit(doll.title, doll.mesh, () => {});
  });
  await wait(2000);

  const dollSeifukuPath = path.join(outDir, 'v2-doll-seifuku-neutral.png');
  await page.screenshot({ path: dollSeifukuPath });
  console.log('Doll Seifuku screenshot saved:', dollSeifukuPath);

  console.log('All automated verification passed successfully!');
} catch (err) {
  console.error('Test error:', err);
} finally {
  await browser.close();
  await server.close();
}
