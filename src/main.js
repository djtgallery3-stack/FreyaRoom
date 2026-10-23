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

const isTouchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
if (isTouchOnly) $('start-note').classList.remove('hidden');

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
  interaction = new Interaction({ camera, proxies: world.proxies, interactables: world.interactables });

  $('loading').remove();
  showStart('Klik untuk masuk');

  // Reveal top controls bar and visitor counter
  $('controls-bar').classList.remove('hidden');
  $('controls-bar').classList.add('flex');
  visitorCounter.init();

  setupControls();

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
      lighting: world.lighting,
      toggleLighting,
      activate,
      showStart,
      hideStart,
    };
  }
} catch (err) {
  console.error(err);
  $('loading-text').textContent = 'Gagal memuat kamar. Muat ulang halaman untuk mencoba lagi.';
  $('loading-bar').classList.replace('bg-pink-300', 'bg-red-400');
  throw err;
}

// ---------------------------------------------------------------------------
// State: loading -> start overlay -> playing (pointer locked) <-> modal / paused
// ---------------------------------------------------------------------------
let pendingModal = false; // pointer released on purpose to show modal

function showStart(label) {
  $('start-label').textContent = label;
  $('start').classList.remove('hidden');
  $('start').classList.add('flex');
  $('hud').classList.add('hidden');
  $('start-btn').focus({ preventScroll: true });
}
function hideStart() {
  $('start').classList.add('hidden');
  $('start').classList.remove('flex');
  $('hud').classList.remove('hidden');
}

$('start-btn').addEventListener('click', () => {
  audio.start();
  syncAudioUi();
  player.lock();
});

player.controls.addEventListener('lock', () => {
  hideStart();
  audio.start();
  syncAudioUi();
});
player.controls.addEventListener('unlock', () => {
  if (pendingModal || ui.isOpen) return;
  showStart('Klik untuk melanjutkan');
});

/** Release the cursor and open a modal; re-acquire control when it closes. */
function openModal(open) {
  pendingModal = true;
  player.unlock();
  $('hud').classList.add('hidden');
  open(() => {
    // fires after the modal is closed (if no other modal remains)
    if (ui.isOpen) return;
    pendingModal = false;
    interaction.closeAllBoxes();
    $('hud').classList.remove('hidden');
    showStart('Klik untuk melanjutkan');
    player.lock(); // succeeds when the close was a click; otherwise the overlay waits for one
  });
}

function activate() {
  if ((!player.isLocked && !isDebug) || ui.isOpen) return;
  const entry = interaction.activate();
  if (!entry) return;

  switch (entry.kind) {
    case 'box':
      interaction.openBox(entry);
      audio.playOpen();
      openModal((done) => ui.openGallery(entry.def, done));
      break;
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

  // Audio BGM Play/Pause
  $('play-pause').addEventListener('click', togglePlayPause);

  // Audio Mute toggle
  $('mute').addEventListener('click', toggleMute);

  // Volume range slider
  const volume = $('volume');
  volume.addEventListener('input', () => {
    audio.setVolume(Number(volume.value));
    syncAudioUi();
  });

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

  $('mute').setAttribute('aria-pressed', String(audio.muted));
  $('mute').setAttribute('aria-label', audio.muted ? 'Hidupkan musik' : 'Bisukan musik');
  $('icon-sound').classList.toggle('hidden', audio.muted);
  $('icon-muted').classList.toggle('hidden', !audio.muted);
  $('volume').value = audio.muted ? 0 : audio.volume;
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let prevTime = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - prevTime) / 1000, 0.1);
  prevTime = now;
  const active = (player.isLocked || isDebug) && !ui.isOpen;
  player.update(dt);
  interaction.update(dt, active);
  world.lighting.update(dt);
  audio.setWalking(active && player.moving);
  renderer.render(scene, camera);
});
