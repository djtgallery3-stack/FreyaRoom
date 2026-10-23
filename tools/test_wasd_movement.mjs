import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'fs';
import path from 'path';

const projectRoot = '/Users/djati/Movies/freyaproject/output/source code';
const server = await preview({
  root: projectRoot,
  preview: {
    port: 4186,
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
  await page.waitForFunction(() => window.__freya, { timeout: 60000 });
  console.log('World initialized!');

  // Hide start overlay
  await page.evaluate(() => window.__freya.hideStart());
  await wait(500);

  // Test WASD physics directly on player
  const movementResults = await page.evaluate(async () => {
    const f = window.__freya;
    const p = f.player;

    // Helper to test a key
    function testKey(keyName, frames = 20) {
      const startPos = { x: p.camera.position.x, z: p.camera.position.z };
      // simulate pointer locked
      const origLocked = p.isLocked;
      Object.defineProperty(p, 'isLocked', { value: true, configurable: true });

      p.keys.clear();
      p.keys.add(keyName);

      for (let i = 0; i < frames; i++) {
        p.update(0.016); // 60fps frame
      }

      p.keys.clear();
      const endPos = { x: p.camera.position.x, z: p.camera.position.z };

      // restore
      Object.defineProperty(p, 'isLocked', { value: origLocked, configurable: true });

      // Calculate movement relative to camera yaw
      // forward vector = (-sin(yaw), -cos(yaw))
      // right vector   = (cos(yaw), -sin(yaw))
      const yaw = p.camera.rotation.y;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);

      const deltaX = endPos.x - startPos.x;
      const deltaZ = endPos.z - startPos.z;

      // Project onto right and forward
      const rightMove = deltaX * cos - deltaZ * sin;
      const forwardMove = -deltaX * sin - deltaZ * cos;

      return {
        key: keyName,
        startPos,
        endPos,
        deltaX: Math.round(deltaX * 1000) / 1000,
        deltaZ: Math.round(deltaZ * 1000) / 1000,
        rightMove: Math.round(rightMove * 1000) / 1000,
        forwardMove: Math.round(forwardMove * 1000) / 1000,
      };
    }

    const testA = testKey('KeyA');
    const testD = testKey('KeyD');
    const testW = testKey('KeyW');
    const testS = testKey('KeyS');
    const testArrowLeft = testKey('ArrowLeft');
    const testArrowRight = testKey('ArrowRight');

    return { testA, testD, testW, testS, testArrowLeft, testArrowRight };
  });

  console.log('Movement test results:', JSON.stringify(movementResults, null, 2));

  // Assertions
  if (movementResults.testA.rightMove >= 0) {
    throw new Error(`KeyA did not move left! rightMove = ${movementResults.testA.rightMove}`);
  }
  if (movementResults.testD.rightMove <= 0) {
    throw new Error(`KeyD did not move right! rightMove = ${movementResults.testD.rightMove}`);
  }
  if (movementResults.testW.forwardMove <= 0) {
    throw new Error(`KeyW did not move forward! forwardMove = ${movementResults.testW.forwardMove}`);
  }
  if (movementResults.testS.forwardMove >= 0) {
    throw new Error(`KeyS did not move backward! forwardMove = ${movementResults.testS.forwardMove}`);
  }
  if (movementResults.testArrowLeft.rightMove >= 0) {
    throw new Error(`ArrowLeft did not move left! rightMove = ${movementResults.testArrowLeft.rightMove}`);
  }

  console.log('SUCCESS: KeyA and ArrowLeft move cleanly to the LEFT!');

  const shotPath = path.join(outDir, 'wasd-left-strafe-verified.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved screenshot to:', shotPath);

  console.log('ALL WASD VERIFICATIONS PASSED WITH 100% SUCCESS!');
} catch (err) {
  console.error('Test error:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
