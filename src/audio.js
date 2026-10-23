// Background music + footsteps + SFX. Browsers only allow audio after a user gesture, so
// `start()` must be called from a click handler.
const BGM_URL = '/audio/waiting-room.mp3';
const STEP_URL = '/audio/footsteps.mp3';
const OPEN_URL = '/audio/box-open.mp3';

export class AudioManager {
  constructor() {
    this.bgm = Object.assign(new Audio(BGM_URL), { loop: true, preload: 'auto' });
    this.steps = Object.assign(new Audio(STEP_URL), { loop: true, preload: 'auto', volume: 0.5 });
    this.open = Object.assign(new Audio(OPEN_URL), { preload: 'auto', volume: 0.6 });
    this.volume = 0.4;
    this.muted = false;
    this.started = false;
    this.paused = false;
    this.walking = false;
    this.audioCtx = null;
    this.bgmGain = null;
    this.#apply();
  }

  get isPlaying() {
    return this.started && !this.bgm.paused;
  }

  initWebAudio() {
    if (this.bgmGain) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const source = this.audioCtx.createMediaElementSource(this.bgm);
      this.bgmGain = this.audioCtx.createGain();
      const effectiveVol = this.muted ? 0 : this.volume;
      this.bgmGain.gain.setValueAtTime(effectiveVol, this.audioCtx.currentTime);
      source.connect(this.bgmGain);
      this.bgmGain.connect(this.audioCtx.destination);
    } catch (err) {
      console.warn('Web Audio routing fallback:', err);
    }
  }

  #apply() {
    const effectiveVol = this.muted ? 0 : this.volume;

    // 1. Native HTMLMediaElement properties (critical for all desktop & mobile)
    this.bgm.muted = this.muted;
    this.bgm.volume = effectiveVol;
    this.steps.muted = this.muted;
    this.steps.volume = this.muted ? 0 : this.volume * 0.5;
    this.open.muted = this.muted;
    this.open.volume = this.muted ? 0 : this.volume * 0.6;

    // 2. Web Audio GainNode (crucial for iOS Safari software volume & mute control)
    if (this.bgmGain && this.audioCtx) {
      try {
        this.bgmGain.gain.setValueAtTime(effectiveVol, this.audioCtx.currentTime);
      } catch {}
    }
  }

  start() {
    this.initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    if (this.started) {
      if (this.bgm.paused && !this.paused) {
        this.bgm.play().catch(() => {});
      }
      return;
    }
    this.started = true;
    this.paused = false;
    this.#apply();
    this.bgm.play().catch(() => (this.started = false));
  }

  togglePlay() {
    this.initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    if (!this.started) {
      this.start();
      return true;
    }
    if (this.bgm.paused) {
      this.bgm.play().catch(() => {});
      this.paused = false;
    } else {
      this.bgm.pause();
      this.paused = true;
    }
    return !this.paused;
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.volume > 0 && this.muted) this.muted = false;
    this.#apply();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.#apply();
    return this.muted;
  }

  /** Called every frame with whether the player is currently moving on the floor. */
  setWalking(walking) {
    if (walking === this.walking) return;
    this.walking = walking;
    if (walking && this.started) this.steps.play().catch(() => {});
    else this.steps.pause();
  }

  playOpen() {
    this.open.currentTime = 0;
    this.open.play().catch(() => {});
  }

  playSwitch() {
    if (this.muted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const t = this.audioCtx.currentTime;

      // Primary crisp mechanical rocker transient
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1700, t);
      osc1.frequency.exponentialRampToValueAtTime(260, t + 0.024);
      gain1.gain.setValueAtTime(0.35, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.024);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(t);
      osc1.stop(t + 0.024);

      // Secondary plate resonance thump
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(320, t + 0.006);
      osc2.frequency.exponentialRampToValueAtTime(65, t + 0.042);
      gain2.gain.setValueAtTime(0.28, t + 0.006);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(t + 0.006);
      osc2.stop(t + 0.042);
    } catch {
      // AudioContext unavailable or autoplay blocked
    }
  }
}
