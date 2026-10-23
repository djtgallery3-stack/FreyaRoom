import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * 3D inspector for the Freya dolls. It builds its own small renderer (created lazily,
 * disposed on close) and re-uses the geometry/material of the already-loaded room mesh,
 * so opening it costs no extra download.
 */
export class OrbitViewer {
  #renderer = null;
  #scene = null;
  #camera = null;
  #controls = null;
  #raf = 0;
  #model = null;
  #resize = null;

  constructor(canvas) {
    this.canvas = canvas;
  }

  show(sourceMesh) {
    this.#init();
    this.#clear();

    const mat = sourceMesh.material.clone();
    mat.roughness = 0.62;
    mat.metalness = 0.0;
    mat.flatShading = false;
    mat.normalMap = null; // Clean smooth rendering without decimation seam artifacts
    mat.needsUpdate = true;

    const geom = sourceMesh.geometry.clone();
    geom.computeVertexNormals();

    const model = new THREE.Mesh(geom, mat);
    model.geometry.computeBoundingBox();
    const box = model.geometry.boundingBox;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 1 / Math.max(size.x, size.y, size.z);

    const pivot = new THREE.Group();
    model.position.copy(center).multiplyScalar(-1);
    pivot.add(model);
    pivot.scale.setScalar(scale);
    // Angle the doll towards the viewer at an aesthetic 3/4 front angle
    pivot.rotation.y = 0.35;
    this.#scene.add(pivot);
    this.#model = pivot;

    this.#camera.position.set(0, 0.15, 1.9);
    this.#controls.target.set(0, 0, 0);
    this.#controls.update();
    this.#onResize();
    this.#loop();
  }

  hide() {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#clear();
    if (this.#resize) window.removeEventListener('resize', this.#resize);
    this.#controls?.dispose();
    this.#renderer?.dispose();
    this.#renderer?.forceContextLoss();
    this.#renderer = this.#scene = this.#camera = this.#controls = this.#resize = null;
  }

  #init() {
    if (this.#renderer) return;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.#renderer = r;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xfff0f5, 0x4a3250, 0.9));
    const key = new THREE.DirectionalLight(0xfffaed, 2.0);
    key.position.set(2, 3, 3);
    const rim = new THREE.DirectionalLight(0xffd5e5, 1.2);
    rim.position.set(-2, 2, -2);
    scene.add(key, rim);
    this.#scene = scene;

    this.#camera = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
    const c = new OrbitControls(this.#camera, this.canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 0.8;
    c.maxDistance = 4;
    c.enablePan = true;
    c.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    c.autoRotateSpeed = 1.2;
    // Stop auto-rotating once the user takes over.
    c.addEventListener('start', () => (c.autoRotate = false));
    this.#controls = c;

    this.#resize = () => this.#onResize();
    window.addEventListener('resize', this.#resize);
  }

  #onResize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.#renderer.setSize(w, h, false);
    this.#camera.aspect = w / h;
    this.#camera.updateProjectionMatrix();
  }

  #clear() {
    if (this.#model) {
      this.#scene?.remove(this.#model); // geometry/material are shared with the room: do not dispose
      this.#model = null;
    }
  }

  #loop = () => {
    this.#raf = requestAnimationFrame(this.#loop);
    this.#controls.update();
    this.#renderer.render(this.#scene, this.#camera);
  };
}
