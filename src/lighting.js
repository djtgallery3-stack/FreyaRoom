import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bl } from './world.js';

export class LightingController {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.isNight = false;
    this.transitionSpeed = 5.0; // Lerp speed factor

    this.#initSceneAtmosphere();
    this.#initLights();
    this.#applyState(true);
  }

  #initSceneAtmosphere() {
    this.scene.background = new THREE.Color(0x1e1528);
    this.scene.fog = new THREE.Fog(0x1e1528, 8, 18);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.22;
    pmrem.dispose();
  }

  #initLights() {
    // 1. Hemisphere Light (Sky vs Ground bounce) - lowered for rich ambient contrast
    this.hemi = new THREE.HemisphereLight(0xa8998d, 0x241d1a, 0.10);
    this.scene.add(this.hemi);

    // 2. Window Directional Light (Soft warm beam, non-blinding)
    this.moon = new THREE.DirectionalLight(0xffecd6, 0.12);
    this.moon.position.copy(bl(4.5, 2.95, 2.4));
    this.moon.target.position.copy(bl(1.2, 2.5, 0));
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    Object.assign(this.moon.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 14 });
    this.moon.shadow.bias = -0.0004;
    this.moon.shadow.normalBias = 0.02;
    this.scene.add(this.moon, this.moon.target);

    // 3. Main Ceiling Room Light (subtle fill; ceiling is dark/moody in movie reels)
    this.ceiling = new THREE.PointLight(0xffebd6, 0.05, 5, 2.0);
    this.ceiling.position.copy(bl(0.0, 1.3, 2.4));
    this.scene.add(this.ceiling);

    // 4. Desk Lamp (Lamp_S at [0.48, 1.15, -3.68] - hero warm amber/golden glow matching movie reels)
    this.deskLamp = new THREE.PointLight(0xff9e38, 4.8, 5.0, 1.7);
    this.deskLamp.position.set(0.48, 1.15, -3.68);
    this.deskLamp.castShadow = true;
    this.deskLamp.shadow.mapSize.set(1024, 1024);
    this.deskLamp.shadow.bias = -0.002;
    this.scene.add(this.deskLamp);

    // 5. Bedside Sconce (soft accent)
    this.bedsideSconce = new THREE.PointLight(0xffa8c0, 0.35, 3.5, 1.8);
    this.bedsideSconce.position.copy(bl(1.8, 2.3, 1.35));
    this.scene.add(this.bedsideSconce);

    // 6. Shelf Fill Light (soft warm accent)
    this.shelfFill = new THREE.PointLight(0xffd8a0, 0.25, 3.5, 1.8);
    this.shelfFill.position.copy(bl(-1.4, 2.85, 1.75));
    this.scene.add(this.shelfFill);

    // 7. Desk Spotlight (Warm subtle accent focused on desk workspace)
    this.deskSpot = new THREE.SpotLight(0xffa44a, 1.2, 4.5, Math.PI / 4, 0.7, 1.8);
    this.deskSpot.position.set(0.48, 1.25, -3.68);
    this.deskSpot.target.position.set(0.12, 0.72, -3.70);
    this.scene.add(this.deskSpot, this.deskSpot.target);

    // 8. Shelf Neon LED Strip (Moody Night Accent)
    this.shelfLed = new THREE.PointLight(0xff90b8, 0.3, 3.5, 1.5);
    this.shelfLed.position.copy(bl(-1.2, 2.9, 1.85));
    this.scene.add(this.shelfLed);

    // Target values for smooth transition
    this.targets = {
      hemiSky: new THREE.Color(),
      hemiGround: new THREE.Color(),
      hemiIntensity: 0.10,
      moonColor: new THREE.Color(),
      moonIntensity: 0.12,
      ceilingColor: new THREE.Color(),
      ceilingIntensity: 0.05,
      deskLampColor: new THREE.Color(),
      deskLampIntensity: 4.8,
      bedsideSconceColor: new THREE.Color(),
      bedsideSconceIntensity: 0.35,
      shelfFillColor: new THREE.Color(),
      shelfFillIntensity: 0.25,
      deskSpotIntensity: 1.2,
      shelfLedColor: new THREE.Color(),
      shelfLedIntensity: 0.3,
      bgColor: new THREE.Color(),
      envIntensity: 0.04,
      toneExp: 0.85,
    };
  }

  #applyState(immediate = false) {
    const t = this.targets;
    if (!this.isNight) {
      // --- Mode Terang (Warm Movie Reels Aesthetic) ---
      t.hemiSky.setHex(0xa8998d);
      t.hemiGround.setHex(0x241d1a);
      t.hemiIntensity = 0.10;

      t.moonColor.setHex(0xffecd6); // Soft warm beam
      t.moonIntensity = 0.12;

      t.ceilingColor.setHex(0xffebd6);
      t.ceilingIntensity = 0.05;

      t.deskLampColor.setHex(0xff9e38); // Warm amber desk glow
      t.deskLampIntensity = 4.8;

      t.bedsideSconceColor.setHex(0xffa8c0);
      t.bedsideSconceIntensity = 0.35;

      t.shelfFillColor.setHex(0xffd8a0);
      t.shelfFillIntensity = 0.25;

      t.deskSpotIntensity = 1.2;

      t.shelfLedColor.setHex(0xff90b8);
      t.shelfLedIntensity = 0.3;

      t.bgColor.setHex(0x181216);
      t.envIntensity = 0.04;
      t.toneExp = 0.85;
    } else {
      // --- Mode Malam Temaram (Moody Night) ---
      t.hemiSky.setHex(0x151d3b);
      t.hemiGround.setHex(0x080612);
      t.hemiIntensity = 0.10;

      t.moonColor.setHex(0x78a6ff); // Electric cool moonlight
      t.moonIntensity = 2.0;

      t.ceilingColor.setHex(0x223055);
      t.ceilingIntensity = 0.15;

      t.deskLampColor.setHex(0xff9850);
      t.deskLampIntensity = 0.4;

      t.bedsideSconceColor.setHex(0xd946ef);
      t.bedsideSconceIntensity = 0.25;

      t.shelfFillColor.setHex(0x0284c7);
      t.shelfFillIntensity = 0.4;

      t.deskSpotIntensity = 0.0;

      t.shelfLedColor.setHex(0x38bdf8); // Vibrant neon blue strip
      t.shelfLedIntensity = 3.8;

      t.bgColor.setHex(0x090611);
      t.envIntensity = 0.05;
      t.toneExp = 0.80;
    }

    if (immediate) {
      this.hemi.color.copy(t.hemiSky);
      this.hemi.groundColor.copy(t.hemiGround);
      this.hemi.intensity = t.hemiIntensity;

      this.moon.color.copy(t.moonColor);
      this.moon.intensity = t.moonIntensity;

      this.ceiling.color.copy(t.ceilingColor);
      this.ceiling.intensity = t.ceilingIntensity;

      this.deskLamp.color.copy(t.deskLampColor);
      this.deskLamp.intensity = t.deskLampIntensity;

      this.bedsideSconce.color.copy(t.bedsideSconceColor);
      this.bedsideSconce.intensity = t.bedsideSconceIntensity;

      this.shelfFill.color.copy(t.shelfFillColor);
      this.shelfFill.intensity = t.shelfFillIntensity;

      this.deskSpot.intensity = t.deskSpotIntensity;

      this.shelfLed.color.copy(t.shelfLedColor);
      this.shelfLed.intensity = t.shelfLedIntensity;

      this.scene.background.copy(t.bgColor);
      this.scene.fog.color.copy(t.bgColor);
      this.scene.environmentIntensity = t.envIntensity;
      this.renderer.toneMappingExposure = t.toneExp;
    }
  }

  setNight(isNight) {
    if (this.isNight === isNight) return;
    this.isNight = isNight;
    this.#applyState(false);
  }

  toggle() {
    this.setNight(!this.isNight);
    return this.isNight;
  }

  update(dt) {
    const factor = Math.min(1, dt * this.transitionSpeed);
    const t = this.targets;

    this.hemi.color.lerp(t.hemiSky, factor);
    this.hemi.groundColor.lerp(t.hemiGround, factor);
    this.hemi.intensity = THREE.MathUtils.lerp(this.hemi.intensity, t.hemiIntensity, factor);

    this.moon.color.lerp(t.moonColor, factor);
    this.moon.intensity = THREE.MathUtils.lerp(this.moon.intensity, t.moonIntensity, factor);

    this.ceiling.color.lerp(t.ceilingColor, factor);
    this.ceiling.intensity = THREE.MathUtils.lerp(this.ceiling.intensity, t.ceilingIntensity, factor);

    this.deskLamp.color.lerp(t.deskLampColor, factor);
    this.deskLamp.intensity = THREE.MathUtils.lerp(this.deskLamp.intensity, t.deskLampIntensity, factor);

    this.bedsideSconce.color.lerp(t.bedsideSconceColor, factor);
    this.bedsideSconce.intensity = THREE.MathUtils.lerp(this.bedsideSconce.intensity, t.bedsideSconceIntensity, factor);

    this.shelfFill.color.lerp(t.shelfFillColor, factor);
    this.shelfFill.intensity = THREE.MathUtils.lerp(this.shelfFill.intensity, t.shelfFillIntensity, factor);

    this.deskSpot.intensity = THREE.MathUtils.lerp(this.deskSpot.intensity, t.deskSpotIntensity, factor);

    this.shelfLed.color.lerp(t.shelfLedColor, factor);
    this.shelfLed.intensity = THREE.MathUtils.lerp(this.shelfLed.intensity, t.shelfLedIntensity, factor);

    this.scene.background.lerp(t.bgColor, factor);
    this.scene.fog.color.lerp(t.bgColor, factor);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(this.scene.environmentIntensity, t.envIntensity, factor);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(this.renderer.toneMappingExposure, t.toneExp, factor);
  }
}
