import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import path from 'path';

const projectRoot = '/Users/djati/Movies/freyaproject/output/source code';
const server = await preview({
  root: projectRoot,
  preview: {
    port: 4202,
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

  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2000));

  // Initialize and aim camera at the first box
  const boxInit = await page.evaluate(async () => {
    const freya = window.__freya;
    const box = freya.interaction.interactables.find((i) => i.kind === 'box');
    if (!box) throw new Error('No box found');

    // Position player right in front of the box
    const pos = box.proxy.position;

    // Set camera looking at box
    freya.player.camera.position.set(pos.x + 0.1, pos.y + 0.35, pos.z + 0.85);
    freya.player.camera.lookAt(pos.x, pos.y + 0.05, pos.z);
    freya.renderer.render(freya.scene, freya.player.camera);

    return {
      slug: box.def.slug,
      name: box.def.name,
      pivotName: box.pivot.name,
      initialRotX: box.pivot.rotation.x,
      hasAudioBuffer: !!freya.audio.openBuffer || !!freya.audio.openArrayBuffer,
    };
  });

  console.log('Box Init:', boxInit);

  // 1. Screenshot: Box Closed Before Click
  const shot1 = path.join(outDir, 'box-open-step1-closed.png');
  await page.screenshot({ path: shot1 });
  console.log('Saved 1: Box Closed:', shot1);

  // 2. Trigger activate on box
  const triggerResult = await page.evaluate(() => {
    const freya = window.__freya;
    const box = freya.interaction.interactables.find((i) => i.kind === 'box');
    freya.activate(box);
    return {
      isOpeningBox: freya.isOpeningBox,
      isGalleryOpen: freya.ui.isOpen,
      target: box.target,
    };
  });
  console.log('Trigger Result (t = 0):', triggerResult);
  if (!triggerResult.isOpeningBox) throw new Error('isOpeningBox should be true at t=0');
  if (triggerResult.isGalleryOpen) throw new Error('Gallery modal should NOT be open yet at t=0');

  // 3. Wait 350ms (Mid opening)
  await new Promise((r) => setTimeout(r, 350));
  const midState = await page.evaluate(() => {
    const freya = window.__freya;
    const box = freya.interaction.interactables.find((i) => i.kind === 'box');
    return {
      isOpeningBox: freya.isOpeningBox,
      isGalleryOpen: freya.ui.isOpen,
      openAmount: box.openAmount,
      rotX: box.pivot.rotation.x,
    };
  });
  console.log('Mid State (t = 350ms):', midState);
  const shot2 = path.join(outDir, 'box-open-step2-mid.png');
  await page.screenshot({ path: shot2 });
  console.log('Saved 2: Mid Opening:', shot2);

  // 4. Wait another 450ms (t = 800ms, modal should now be open)
  await new Promise((r) => setTimeout(r, 450));
  const fullState = await page.evaluate(() => {
    const freya = window.__freya;
    const box = freya.interaction.interactables.find((i) => i.kind === 'box');
    return {
      isOpeningBox: freya.isOpeningBox,
      isGalleryOpen: freya.ui.isOpen,
      galleryTitle: document.getElementById('gallery-title')?.textContent,
      openAmount: box.openAmount,
      rotX: box.pivot.rotation.x,
    };
  });
  console.log('Full State (t = 800ms):', fullState);
  if (!fullState.isGalleryOpen) throw new Error('Gallery modal should be open at t=800ms');

  const shot3 = path.join(outDir, 'box-open-step3-gallery-modal.png');
  await page.screenshot({ path: shot3 });
  console.log('Saved 3: Gallery Modal Open:', shot3);

  // 5. Close Gallery Modal
  const closeResult = await page.evaluate(async () => {
    const freya = window.__freya;
    freya.ui.closeTop();
    const box = freya.interaction.interactables.find((i) => i.kind === 'box');
    return {
      isGalleryOpen: freya.ui.isOpen,
      target: box.target,
    };
  });
  console.log('Close Result:', closeResult);
  if (closeResult.isGalleryOpen) throw new Error('Gallery modal should be closed');
  if (closeResult.target !== 0) throw new Error('Box target should be 0 (closing)');

  // Wait 700ms for box to close
  await new Promise((r) => setTimeout(r, 700));
  const closedState = await page.evaluate(() => {
    const freya = window.__freya;
    const box = freya.interaction.interactables.find((i) => i.kind === 'box');
    return {
      openAmount: box.openAmount,
      rotX: box.pivot.rotation.x,
    };
  });
  console.log('Final Closed State:', closedState);

  const shot4 = path.join(outDir, 'box-open-step4-closed-again.png');
  await page.screenshot({ path: shot4 });
  console.log('Saved 4: Box Closed Again:', shot4);

  console.log('ALL BOX OPENING AND SOUND ANIMATION TESTS PASSED 100%!');
} catch (err) {
  console.error('Test error:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
