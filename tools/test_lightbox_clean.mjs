import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'fs';
import path from 'path';

const projectRoot = '/Users/djati/Movies/freyaproject/output/source code';
const server = await preview({
  root: projectRoot,
  preview: {
    port: 4176,
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

  // 1. Open Box 1 gallery and click the 2nd photo (index 1)
  console.log('Testing Lightbox for Box 1 photo 2...');
  const lightboxState = await page.evaluate(async () => {
    const f = window.__freya;
    const boxEntry = f.world.interactables.find((i) => i.kind === 'box');
    f.ui.openGallery(boxEntry.def);

    // Wait a frame
    await new Promise((r) => setTimeout(r, 100));
    const gridButtons = document.querySelectorAll('#gallery-grid button');
    // Click 2nd photo
    gridButtons[1].click();

    await new Promise((r) => setTimeout(r, 200));

    const titleEl = document.getElementById('lightbox-title');
    const noteEl = document.getElementById('lightbox-note');
    const posEl = document.getElementById('lightbox-pos');
    const imgEl = document.getElementById('lightbox-img');

    return {
      title: titleEl ? titleEl.textContent : null,
      titleColor: titleEl ? window.getComputedStyle(titleEl).color : null,
      pos: posEl ? posEl.textContent : null,
      noteText: noteEl ? noteEl.textContent : null,
      noteHidden: noteEl ? (noteEl.hidden || window.getComputedStyle(noteEl).display === 'none') : true,
      imgSrc: imgEl ? imgEl.src : null,
    };
  });

  console.log('Lightbox state:', lightboxState);

  // Wait for the full image to load
  await wait(800);

  const shotPath = path.join(outDir, 'lightbox-clean-box1-photo2.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved screenshot to:', shotPath);

  // 2. Next photo check
  console.log('Testing Next button...');
  const nextState = await page.evaluate(async () => {
    document.getElementById('lb-next').click();
    await new Promise((r) => setTimeout(r, 200));
    return {
      title: document.getElementById('lightbox-title').textContent,
      pos: document.getElementById('lightbox-pos').textContent,
      noteText: document.getElementById('lightbox-note').textContent,
    };
  });
  console.log('Next photo state:', nextState);

  console.log('ALL VERIFICATIONS PASSED!');
} catch (err) {
  console.error('Test failed:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
  console.log('Server and browser closed.');
}
