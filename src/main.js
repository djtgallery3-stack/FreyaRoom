import './style.css';
import * as THREE from 'three';
import { loadWorld } from './world.js';
import { Player } from './player.js';
import { Interaction } from './interaction.js';
import { UI } from './ui.js';
import { OrbitViewer } from './orbit.js';
import { AudioManager } from './audio.js';
import { VisitorCounter } from './counter.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const isDebug = new URLSearchParams(location.search).has('debug');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 40);
camera.rotation.order = 'YXZ';

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const audio = new AudioManager();
const ui = new UI({ orbit: new OrbitViewer($('orbit-canvas')) });
const visitorCounter = new VisitorCounter();

// Auto device detection: Desktop vs Mobile/Touch
const isTouchDevice =
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  window.matchMedia('(pointer: coarse)').matches;
const urlParams = new URLSearchParams(location.search);
const isMobile = urlParams.get('mobile') === '1' || (isTouchDevice && urlParams.get('mobile') !== '0');

// ---------------------------------------------------------------------------
// Load & Initialization
// ---------------------------------------------------------------------------
let player;
let interaction;
let world;

try {
  world = await loadWorld(scene, renderer, (p) => {
    const pct = Math.round(p * 100);
    $('loading-bar').style.width = `${pct}%`;
    $('loading-text').textContent = `Menyiapkan kamar… ${pct}%`;
  });
  player = new Player(camera, canvas, world.colliders);
  player.isMobile = isMobile;
  interaction = new Interaction({ camera, proxies: world.proxies, interactables: world.interactables });

  $('loading').remove();
  initDeviceMode();
  showStart('Klik untuk masuk');

  // Reveal top controls bar and visitor counter
  $('controls-bar').classList.remove('hidden');
  $('controls-bar').classList.add('flex');
  visitorCounter.init();

  setupControls();
  if (isMobile) setupMobileControls();

  if (isDebug) {
    window.__freya = {
      scene,
      camera,
      player,
      interaction,
      ui,
      world,
      renderer,
      audio,
      visitorCounter,
      lighting: world.lighting,
      toggleLighting,
      activate,
      showStart,
      hideStart,
      isMobile,
      get isOpeningBox() {
        return isOpeningBox;
      },
    };
  }
} catch (err) {
  console.error(err);
  $('loading-text').textContent = 'Gagal memuat kamar. Muat ulang halaman untuk mencoba lagi.';
  $('loading-bar').classList.replace('bg-pink-300', 'bg-red-400');
  throw err;
}

// ---------------------------------------------------------------------------
// Device Mode Configuration (Desktop vs Mobile)
// ---------------------------------------------------------------------------
function initDeviceMode() {
  if (isMobile) {
    document.body.classList.add('is-mobile');
    // Hide desktop keyboard help bar
    $('hud-desktop-help')?.classList.add('!hidden');
    $('desktop-instructions')?.classList.add('hidden');
    $('mobile-instructions')?.classList.remove('hidden');
    $('mobile-instructions')?.classList.add('flex');
    $('start-note')?.classList.add('hidden');
    $('exit-fullscreen-btn')?.classList.remove('hidden');
  } else {
    $('desktop-instructions')?.classList.remove('hidden');
    $('mobile-instructions')?.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// State: loading -> start overlay -> playing <-> modal / paused
// ---------------------------------------------------------------------------
let pendingModal = false; // pointer released on purpose to show modal

function showStart(label) {
  $('start-label').textContent = label;
  $('start').classList.remove('hidden');
  $('start').classList.add('flex');
  $('hud').classList.add('hidden');
  if (isMobile) {
    player.isPlaying = false;
    player.setTouchMove(0, 0);
    $('mobile-menu-btn')?.classList.add('hidden');
    $('joystick-zone')?.classList.add('hidden');
    $('mobile-actions')?.classList.add('hidden');
  }
  $('start-btn').focus({ preventScroll: true });
}

function hideStart() {
  $('start').classList.add('hidden');
  $('start').classList.remove('flex');
  $('hud').classList.remove('hidden');
  if (isMobile) {
    player.isPlaying = true;
    $('mobile-menu-btn')?.classList.remove('hidden');
    $('mobile-menu-btn')?.classList.add('inline-flex');
    $('joystick-zone')?.classList.remove('hidden');
    $('joystick-zone')?.classList.add('flex');
    $('mobile-actions')?.classList.remove('hidden');
    $('mobile-actions')?.classList.add('flex');
  }
}

$('start-btn').addEventListener('click', () => {
  audio.start();
  syncAudioUi();

  if (isMobile) {
    // Auto Fullscreen & Auto Landscape on mobile gameplay start
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
    hideStart();
  } else {
    player.lock();
  }
});

// Mobile Exit Fullscreen Button
$('exit-fullscreen-btn')?.addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch?.(() => {});
  }
  screen.orientation?.unlock?.();
  if (!isMobile) player.unlock();
});

// Mobile Pause / Menu / Esc Button
$('mobile-menu-btn')?.addEventListener('click', () => {
  player.isPlaying = false;
  player.setTouchMove(0, 0);
  showStart('Klik untuk melanjutkan');
});

player.controls.addEventListener('lock', () => {
  hideStart();
  audio.start();
  syncAudioUi();
});
player.controls.addEventListener('unlock', () => {
  if (isMobile || pendingModal || ui.isOpen) return;
  showStart('Klik untuk melanjutkan');
});

/** Release the cursor and open a modal; re-acquire control when it closes. */
function openModal(open) {
  pendingModal = true;
  if (isMobile) {
    player.isPlaying = false;
    player.setTouchMove(0, 0);
    $('joystick-zone')?.classList.add('hidden');
    $('mobile-actions')?.classList.add('hidden');
  } else {
    player.unlock();
  }
  $('hud').classList.add('hidden');
  open(() => {
    // fires after the modal is closed (if no other modal remains)
    if (ui.isOpen) return;
    pendingModal = false;
    interaction.closeAllBoxes();
    $('hud').classList.remove('hidden');
    if (isMobile) {
      player.isPlaying = true;
      $('joystick-zone')?.classList.remove('hidden');
      $('joystick-zone')?.classList.add('flex');
      $('mobile-actions')?.classList.remove('hidden');
      $('mobile-actions')?.classList.add('flex');
    } else {
      showStart('Klik untuk melanjutkan');
      player.lock();
    }
  });
}

let isOpeningBox = false;

function activate(customEntry = null) {
  if ((!isMobile && !player.isLocked && !isDebug) || ui.isOpen || isOpeningBox) return;
  const entry = customEntry || interaction.activate();
  if (!entry) return;
  interaction.clearHover();

  switch (entry.kind) {
    case 'box': {
      isOpeningBox = true;
      player.setFrozen(true);
      interaction.openBox(entry);
      audio.playOpen();

      // Allow the player to see the 3D box lid smoothly open (-115°)
      // along with the creak audio SFX before the photo gallery modal appears
      setTimeout(() => {
        isOpeningBox = false;
        player.setFrozen(false);
        openModal((done) => ui.openGallery(entry.def, done));
      }, 700);
      break;
    }
    case 'photo':
      openModal((done) => ui.openLightbox(entry.items, entry.index, done));
      break;
    case 'doll':
      openModal((done) => ui.openOrbit(entry.title, entry.mesh, done));
      break;
    case 'switch':
      toggleLighting();
      break;
  }
}

// ---------------------------------------------------------------------------
// Mobile Touch Controls (Virtual Joystick + Touch Drag Look + Direct Tap)
// ---------------------------------------------------------------------------
function setupMobileControls() {
  const joystickZone = $('joystick-zone');
  const joystickKnob = $('joystick-knob');
  const MAX_JOYSTICK_RADIUS = 46;
  let joystickTouchId = null;
  let joystickCenter = { x: 0, y: 0 };

  function updateJoystick(clientX, clientY) {
    let dx = clientX - joystickCenter.x;
    let dy = clientY - joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_JOYSTICK_RADIUS) {
      dx = (dx / dist) * MAX_JOYSTICK_RADIUS;
      dy = (dy / dist) * MAX_JOYSTICK_RADIUS;
    }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    // Forward is -dy, Right is dx
    const forward = -dy / MAX_JOYSTICK_RADIUS;
    const right = dx / MAX_JOYSTICK_RADIUS;
    player.setTouchMove(forward, right);
  }

  joystickZone.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (const touch of e.changedTouches) {
        if (joystickTouchId === null) {
          joystickTouchId = touch.identifier;
          const rect = joystickZone.getBoundingClientRect();
          joystickCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          updateJoystick(touch.clientX, touch.clientY);
          break;
        }
      }
    },
    { passive: false },
  );

  window.addEventListener(
    'touchmove',
    (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === joystickTouchId) {
          updateJoystick(touch.clientX, touch.clientY);
          break;
        }
      }
    },
    { passive: true },
  );

  function resetJoystick(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === joystickTouchId) {
        joystickTouchId = null;
        joystickKnob.style.transform = 'translate(0px, 0px)';
        player.setTouchMove(0, 0);
        break;
      }
    }
  }

  window.addEventListener('touchend', resetJoystick, { passive: true });
  window.addEventListener('touchcancel', resetJoystick, { passive: true });

  // Floating Action Button
  $('mobile-action-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    activate();
  });

  // Mobile Light Toggle Button
  $('mobile-light-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleLighting();
  });

  // Touch Drag Look & Direct Tap on Canvas
  let lookTouchId = null;
  let lookStartX = 0;
  let lookStartY = 0;
  let lookLastX = 0;
  let lookLastY = 0;
  let lookStartTime = 0;

  canvas.addEventListener(
    'touchstart',
    (e) => {
      if (!isMobile || ui.isOpen || !player.isPlaying) return;
      for (const touch of e.changedTouches) {
        if (lookTouchId === null) {
          lookTouchId = touch.identifier;
          lookStartX = touch.clientX;
          lookStartY = touch.clientY;
          lookLastX = touch.clientX;
          lookLastY = touch.clientY;
          lookStartTime = performance.now();
          break;
        }
      }
    },
    { passive: true },
  );

  canvas.addEventListener(
    'touchmove',
    (e) => {
      if (!isMobile || ui.isOpen || !player.isPlaying) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier === lookTouchId) {
          const dx = touch.clientX - lookLastX;
          const dy = touch.clientY - lookLastY;
          lookLastX = touch.clientX;
          lookLastY = touch.clientY;
          player.addLookRotation(dx * 0.004, dy * 0.0035);
          break;
        }
      }
    },
    { passive: true },
  );

  canvas.addEventListener(
    'touchend',
    (e) => {
      if (!isMobile || ui.isOpen) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier === lookTouchId) {
          const dt = performance.now() - lookStartTime;
          const moveDist = Math.hypot(touch.clientX - lookStartX, touch.clientY - lookStartY);
          lookTouchId = null;

          // Direct Tap: tap on 3D object to open it directly
          if (dt < 280 && moveDist < 12 && player.isPlaying) {
            const ndc = new THREE.Vector2(
              (touch.clientX / innerWidth) * 2 - 1,
              -(touch.clientY / innerHeight) * 2 + 1,
            );
            const hit = interaction.raycastPoint(ndc);
            if (hit) {
              activate(hit);
            }
          }
          break;
        }
      }
    },
    { passive: true },
  );
}

function adjustVolume(delta) {
  audio.setVolume(audio.volume + delta);
  syncAudioUi();
}

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyE') activate();
  else if (e.code === 'KeyL') toggleLighting();
  else if (e.code === 'KeyP') togglePlayPause();
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'Comma') adjustVolume(-0.05);
  else if (e.code === 'Period') adjustVolume(0.05);
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) activate();
});

// ---------------------------------------------------------------------------
// Controls (Lighting Mood & BGM Audio)
// ---------------------------------------------------------------------------
function setupControls() {
  // Lighting toggle
  $('light-toggle').addEventListener('click', toggleLighting);

  // Audio BGM Play/Pause (HUD & Menu)
  $('play-pause').addEventListener('click', togglePlayPause);
  $('menu-play-btn')?.addEventListener('click', togglePlayPause);

  // Audio Mute toggle (HUD & Menu)
  $('mute').addEventListener('click', toggleMute);
  $('menu-mute-btn')?.addEventListener('click', toggleMute);

  // Volume range slider (Top HUD)
  const volume = $('volume');
  const onVolChange = () => {
    audio.setVolume(Number(volume.value));
    syncAudioUi();
  };
  volume.addEventListener('input', onVolChange);
  volume.addEventListener('change', onVolChange);

  // Volume range slider (Menu card)
  const menuVolume = $('menu-volume');
  if (menuVolume) {
    const onMenuVolChange = () => {
      audio.setVolume(Number(menuVolume.value));
      syncAudioUi();
    };
    menuVolume.addEventListener('input', onMenuVolChange);
    menuVolume.addEventListener('change', onMenuVolChange);
  }

  // Menu volume step buttons (- / +)
  $('menu-vol-down')?.addEventListener('click', () => adjustVolume(-0.1));
  $('menu-vol-up')?.addEventListener('click', () => adjustVolume(0.1));

  syncLightingUi(world.lighting.isNight);
  syncAudioUi();
}

function toggleLighting() {
  if (!world?.lighting) return;
  const isNight = world.lighting.toggle();
  audio.playSwitch();
  world.switchItem?.updateState(isNight);
  syncLightingUi(isNight);
}

function syncLightingUi(isNight) {
  $('icon-sun').classList.toggle('hidden', isNight);
  $('icon-moon').classList.toggle('hidden', !isNight);
  $('light-toggle').setAttribute(
    'aria-label',
    isNight ? 'Ganti mode lampu: Nyalakan lampu (Mode Terang)' : 'Ganti mode lampu: Matikan lampu (Mode Malam)',
  );
  $('light-toggle').title = isNight ? 'Mode Malam [L] — Klik untuk Mode Terang' : 'Mode Terang [L] — Klik untuk Mode Malam';
}

function togglePlayPause() {
  audio.togglePlay();
  syncAudioUi();
}

function toggleMute() {
  audio.toggleMute();
  syncAudioUi();
}

function syncAudioUi() {
  const isPlaying = audio.isPlaying;
  $('icon-pause').classList.toggle('hidden', !isPlaying);
  $('icon-play').classList.toggle('hidden', isPlaying);
  $('play-pause').setAttribute('aria-label', isPlaying ? 'Jeda musik' : 'Putar musik');
  $('play-pause').title = isPlaying ? 'Jeda Musik [P]' : 'Putar Musik [P]';

  // Menu play button
  const menuPlayIcon = $('menu-play-icon');
  if (menuPlayIcon) menuPlayIcon.textContent = isPlaying ? '⏸️' : '▶️';
  $('menu-play-btn')?.setAttribute('aria-label', isPlaying ? 'Jeda musik' : 'Putar musik');

  $('mute').setAttribute('aria-pressed', String(audio.muted));
  $('mute').setAttribute('aria-label', audio.muted ? 'Hidupkan musik' : 'Bisukan musik');
  $('icon-sound').classList.toggle('hidden', audio.muted);
  $('icon-muted').classList.toggle('hidden', !audio.muted);

  const displayVol = audio.muted ? 0 : audio.volume;
  $('volume').value = displayVol;

  // Menu volume & mute sync
  const menuVolume = $('menu-volume');
  if (menuVolume) menuVolume.value = displayVol;
  const menuVolumePct = $('menu-volume-pct');
  if (menuVolumePct) menuVolumePct.textContent = `${Math.round(displayVol * 100)}%`;
  const menuMuteIcon = $('menu-mute-icon');
  if (menuMuteIcon) menuMuteIcon.textContent = audio.muted ? '🔇' : '🔊';
  $('menu-mute-btn')?.setAttribute('aria-label', audio.muted ? 'Hidupkan musik' : 'Bisukan musik');
}

function updateMobileActionUi(hit) {
  const actionBtn = $('mobile-action-btn');
  const actionIcon = $('mobile-action-icon');
  const actionLabel = $('mobile-action-label');
  if (!actionBtn) return;
  if (hit) {
    actionBtn.classList.add('bg-pink-400', '!text-white', 'ring-4', 'ring-pink-300/60', 'shadow-[0_0_16px_rgba(244,114,182,0.85)]');
    actionBtn.classList.remove('bg-black/60', 'ring-white/20');
    switch (hit.kind) {
      case 'box':
        actionIcon.textContent = '📦';
        actionLabel.textContent = 'Buka Kotak';
        break;
      case 'photo':
        actionIcon.textContent = '🖼️';
        actionLabel.textContent = 'Lihat Foto';
        break;
      case 'doll':
        actionIcon.textContent = '🧸';
        actionLabel.textContent = 'Putar Boneka';
        break;
      case 'switch':
        actionIcon.textContent = '💡';
        actionLabel.textContent = 'Saklar';
        break;
      default:
        actionIcon.textContent = '🖐️';
        actionLabel.textContent = 'Buka/Lihat';
    }
  } else {
    actionBtn.classList.remove('bg-pink-400', '!text-white', 'ring-4', 'ring-pink-300/60', 'shadow-[0_0_16px_rgba(244,114,182,0.85)]');
    actionBtn.classList.add('bg-black/60', 'ring-white/20');
    actionIcon.textContent = '🖐️';
    actionLabel.textContent = 'Buka/Lihat';
  }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let prevTime = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - prevTime) / 1000, 0.1);
  prevTime = now;
  const active = (isMobile ? player.isPlaying : player.isLocked || isDebug) && !ui.isOpen;
  player.update(dt);
  interaction.update(dt, active && !isOpeningBox);
  world.lighting.update(dt);
  audio.setWalking(active && player.moving);
  if (isMobile && active) updateMobileActionUi(interaction.hovered);
  renderer.render(scene, camera);
});
