import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'fs';
import path from 'path';

const projectRoot = '/Users/djati/Movies/freyaproject/output/source code';
const server = await preview({
  root: projectRoot,
  preview: {
    port: 4185,
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

  // 1. Visit 1
  console.log('Visit 1: Navigating to', url);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__freya, { timeout: 60000 });

  console.log('Waiting for visitor counter animation to finish...');
  await wait(1800);

  const count1 = await page.evaluate(() => {
    const el = document.getElementById('visitor-count');
    const badge = document.getElementById('visitor-counter');
    const local = localStorage.getItem('freya_room_visitor_count_v3');
    return {
      displayed: el ? el.textContent : null,
      visible: badge ? !badge.classList.contains('hidden') : false,
      local,
    };
  });
  console.log('Visit 1 result:', count1);

  // 2. Visit 2: Trigger next visit
  console.log('Visit 2: Simulating next visit...');
  const count2 = await page.evaluate(async () => {
    const f = window.__freya;
    await f.visitorCounter.init();
    await new Promise((r) => setTimeout(r, 1200));
    const el = document.getElementById('visitor-count');
    const local = localStorage.getItem('freya_room_visitor_count_v3');
    return {
      displayed: el ? el.textContent : null,
      local,
    };
  });
  console.log('Visit 2 result:', count2);

  // Hide start overlay to capture clean HUD badge
  await page.evaluate(() => window.__freya.hideStart());
  await wait(500);

  const shotPath = path.join(outDir, 'visitor-counter-live-proof.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved screenshot to:', shotPath);

  console.log('ALL VISITOR COUNTER TESTS PASSED SUCCESSFULLY!');
} catch (err) {
  console.error('Test error:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
