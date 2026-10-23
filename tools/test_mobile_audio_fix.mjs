import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'fs';
import path from 'path';

const projectRoot = '/Users/djati/Movies/freyaproject/output/source code';
const server = await preview({
  root: projectRoot,
  preview: {
    port: 4182,
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

  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__freya, { timeout: 60000 });
  console.log('World initialized!');

  // 1. Click Start to start audio and enter gameplay
  console.log('Tapping Start button on mobile...');
  await page.tap('#start-btn');
  await wait(800);

  const initialAudio = await page.evaluate(() => {
    const f = window.__freya;
    return {
      started: f.audio.started,
      muted: f.audio.muted,
      volume: f.audio.volume,
      bgmVolume: f.audio.bgm.volume,
      bgmMuted: f.audio.bgm.muted,
      gainVal: f.audio.bgmGain ? f.audio.bgmGain.gain.value : null,
    };
  });
  console.log('1. Initial Audio State:', initialAudio);
  if (!initialAudio.started || initialAudio.muted) {
    throw new Error('Initial audio state incorrect');
  }

  // 2. Test HUD Mute Tap
  console.log('Tapping HUD Mute button...');
  await page.tap('#mute');
  await wait(300);

  const mutedAudio = await page.evaluate(() => {
    const f = window.__freya;
    const soundHidden = document.getElementById('icon-sound').classList.contains('hidden');
    const mutedHidden = document.getElementById('icon-muted').classList.contains('hidden');
    return {
      muted: f.audio.muted,
      bgmVolume: f.audio.bgm.volume,
      bgmMuted: f.audio.bgm.muted,
      gainVal: f.audio.bgmGain ? f.audio.bgmGain.gain.value : null,
      soundHidden,
      mutedHidden,
    };
  });
  console.log('2. Muted Audio State:', mutedAudio);
  if (!mutedAudio.muted || !mutedAudio.bgmMuted || mutedAudio.gainVal !== 0 || !mutedAudio.soundHidden || mutedAudio.mutedHidden) {
    throw new Error('Mute button failed to mute audio & GainNode');
  }

  // 3. Test HUD Unmute Tap
  console.log('Tapping HUD Mute button to unmute...');
  await page.tap('#mute');
  await wait(300);

  const unmutedAudio = await page.evaluate(() => {
    const f = window.__freya;
    return {
      muted: f.audio.muted,
      bgmMuted: f.audio.bgm.muted,
      gainVal: f.audio.bgmGain ? f.audio.bgmGain.gain.value : null,
    };
  });
  console.log('3. Unmuted Audio State:', unmutedAudio);
  if (unmutedAudio.muted || unmutedAudio.bgmMuted || unmutedAudio.gainVal === 0) {
    throw new Error('Unmute failed');
  }

  // 4. Test Volume Slider change
  console.log('Testing Volume Slider change...');
  await page.evaluate(() => {
    const vol = document.getElementById('volume');
    vol.value = 0.75;
    vol.dispatchEvent(new Event('input', { bubbles: true }));
    vol.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await wait(300);

  const volAudio = await page.evaluate(() => {
    const f = window.__freya;
    return {
      volume: f.audio.volume,
      bgmVolume: f.audio.bgm.volume,
      gainVal: f.audio.bgmGain ? f.audio.bgmGain.gain.value : null,
    };
  });
  console.log('4. Volume changed State:', volAudio);
  if (volAudio.volume !== 0.75 || volAudio.gainVal !== 0.75) {
    throw new Error('Volume slider failed to update volume or GainNode');
  }

  // 5. Open Mobile Pause Menu (Menu / Esc)
  console.log('Tapping Mobile Menu / Esc button...');
  await page.tap('#mobile-menu-btn');
  await wait(600);

  // Check Menu Audio Card UI
  const menuCardState = await page.evaluate(() => {
    const pct = document.getElementById('menu-volume-pct').textContent;
    const menuVol = document.getElementById('menu-volume').value;
    const menuMuteIcon = document.getElementById('menu-mute-icon').textContent;
    return { pct, menuVol, menuMuteIcon };
  });
  console.log('5. Pause Menu Audio Card State:', menuCardState);
  if (menuCardState.pct !== '75%') {
    throw new Error(`Menu volume pct expected 75%, got ${menuCardState.pct}`);
  }

  // Test Menu Vol Down Button (- 10%)
  console.log('Tapping Menu Vol Down button (- 10%)...');
  await page.tap('#menu-vol-down');
  await wait(300);

  const afterDown = await page.evaluate(() => {
    const f = window.__freya;
    const pct = document.getElementById('menu-volume-pct').textContent;
    return {
      volume: Math.round(f.audio.volume * 100) / 100,
      pct,
    };
  });
  console.log('6. After Menu Vol Down (-10%):', afterDown);
  if (afterDown.pct !== '65%') {
    throw new Error(`Expected 65%, got ${afterDown.pct}`);
  }

  // Capture screenshot of Pause Menu with Audio Settings Card
  const pauseMenuPath = path.join(outDir, 'mobile-menu-audio-settings.png');
  await page.screenshot({ path: pauseMenuPath });
  console.log('Saved screenshot to:', pauseMenuPath);

  // Resume game
  await page.tap('#start-btn');
  await wait(600);

  // Capture screenshot of HUD with custom touch-friendly volume slider and active controls
  const hudPath = path.join(outDir, 'mobile-hud-audio-controls.png');
  await page.screenshot({ path: hudPath });
  console.log('Saved screenshot to:', hudPath);

  console.log('ALL MOBILE AUDIO TESTS PASSED WITH 100% SUCCESS!');
} catch (err) {
  console.error('Test error:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
