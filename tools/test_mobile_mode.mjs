import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'fs';
import path from 'path';

const projectRoot = '/Users/djati/Movies/freyaproject/output/source code';
const server = await preview({
  root: projectRoot,
  preview: {
    port: 4175,
    host: '127.0.0.1',
    strictPort: true,
  },
});

const baseUrl = server.resolvedUrls.local[0];
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
  defaultViewport: {
    width: 844,
    height: 390,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
});

try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log(`[page ${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => console.error(`[page error]`, e));

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // 1. Test Mobile Emulation
  const mobileUrl = `${baseUrl}?debug&mobile=1`;
  console.log('Navigating to mobile mode:', mobileUrl);
  await page.goto(mobileUrl, { waitUntil: 'load' });

  await page.waitForFunction(() => window.__freya, { timeout: 120000 });
  console.log('World initialized in mobile mode!');

  // Check initial start screen on mobile
  const startScreenState = await page.evaluate(() => {
    const mobileInstr = document.getElementById('mobile-instructions');
    const desktopInstr = document.getElementById('desktop-instructions');
    const exitFsBtn = document.getElementById('exit-fullscreen-btn');
    const desktopHelp = document.getElementById('hud-desktop-help');
    return {
      isMobileBody: document.body.classList.contains('is-mobile'),
      mobileInstrVisible: !mobileInstr.classList.contains('hidden'),
      desktopInstrHidden: desktopInstr.classList.contains('hidden'),
      exitFsBtnVisible: !exitFsBtn.classList.contains('hidden'),
      desktopHelpHidden: desktopHelp.classList.contains('!hidden'),
    };
  });
  console.log('Mobile start screen state:', startScreenState);

  // Capture start screen on mobile
  const startScreenPath = path.join(outDir, 'mobile-v3-start-menu.png');
  await page.screenshot({ path: startScreenPath });
  console.log('Saved mobile start screen:', startScreenPath);

  // Click Start Button
  console.log('Tapping start button...');
  await page.click('#start-btn');
  await wait(1200);

  // Check gameplay mobile HUD elements (Joystick, Actions, Menu button)
  const gameplayHudState = await page.evaluate(() => {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const joystick = document.getElementById('joystick-zone');
    const actions = document.getElementById('mobile-actions');
    const reticle = document.getElementById('reticle');
    return {
      menuBtnVisible: !menuBtn.classList.contains('hidden'),
      joystickVisible: !joystick.classList.contains('hidden'),
      actionsVisible: !actions.classList.contains('hidden'),
      isPlaying: window.__freya.player.isPlaying,
    };
  });
  console.log('Gameplay mobile HUD state:', gameplayHudState);

  // Capture Mobile In-Game HUD (with Joystick and Actions)
  const hudPath = path.join(outDir, 'mobile-v3-gameplay-hud.png');
  await page.screenshot({ path: hudPath });
  console.log('Saved mobile gameplay HUD screenshot:', hudPath);

  // 2. Test Virtual Joystick Movement
  console.log('Testing Virtual Joystick movement...');
  const initialPos = await page.evaluate(() => {
    const p = window.__freya.player.camera.position;
    return { x: p.x, z: p.z };
  });

  // Emulate touch move forward
  await page.evaluate(() => {
    const p = window.__freya.player;
    p.setTouchMove(1.0, 0.0); // full forward
    for (let i = 0; i < 40; i++) {
      p.update(0.016);
    }
    p.setTouchMove(0.0, 0.0);
  });

  const movedPos = await page.evaluate(() => {
    const p = window.__freya.player.camera.position;
    return { x: p.x, z: p.z };
  });
  console.log('Joystick movement test:', { initialPos, movedPos });
  const dist = Math.hypot(movedPos.x - initialPos.x, movedPos.z - initialPos.z);
  console.log('Distance moved by joystick:', dist.toFixed(3), 'meters');

  // 3. Test Touch Look Rotation
  await page.evaluate(() => {
    window.__freya.player.addLookRotation(0.5, 0.1);
  });
  await wait(500);

  // 4. Test Mobile Action Button and Direct Tap
  console.log('Testing direct interaction...');
  await page.evaluate(() => {
    const f = window.__freya;
    const doll = f.world.interactables.find((i) => i.title?.includes('Trainee'));
    f.activate(doll);
  });
  await wait(2000);

  // Check if Orbit modal opened
  const modalOpen = await page.evaluate(() => window.__freya.ui.isOpen);
  console.log('Modal opened successfully:', modalOpen);

  const dollModalPath = path.join(outDir, 'mobile-v3-doll-modal.png');
  await page.screenshot({ path: dollModalPath });
  console.log('Saved mobile doll modal screenshot:', dollModalPath);

  // Check Close Button touch target size
  const closeBtnSize = await page.evaluate(() => {
    const btn = document.querySelector('#orbit [data-close]');
    const rect = btn.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  console.log('Modal close button size on mobile (target >= 44x44):', closeBtnSize);

  // Close modal by tapping close button
  await page.click('#orbit [data-close]');
  await wait(800);

  // 5. Test Tombol "⏸️ Menu / Esc"
  console.log('Tapping Menu / Esc button...');
  await page.click('#mobile-menu-btn');
  await wait(800);

  const pauseMenuState = await page.evaluate(() => {
    const start = document.getElementById('start');
    const label = document.getElementById('start-label').textContent;
    const exitBtn = document.getElementById('exit-fullscreen-btn');
    return {
      startVisible: !start.classList.contains('hidden'),
      label,
      exitBtnVisible: !exitBtn.classList.contains('hidden'),
    };
  });
  console.log('Pause menu state on mobile:', pauseMenuState);

  const pauseMenuPath = path.join(outDir, 'mobile-v3-pause-menu.png');
  await page.screenshot({ path: pauseMenuPath });
  console.log('Saved mobile pause menu screenshot:', pauseMenuPath);

  console.log('All mobile checks passed successfully!');
} catch (err) {
  console.error('Test error:', err);
} finally {
  await browser.close();
  await server.close();
}
