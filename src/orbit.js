import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 3D inspector for the Freya dolls. Re-uses the geometry/material of the
 * already-loaded room mesh with pure neutral white lighting, sRGB color space,
 * and no pink/purple tinting.
 */
export class OrbitViewer {
  #renderer = null;
  #scene = null;
  #camera = null;
  #controls = null;
  #raf = 0;
  #model = null;
  #clonedMat = null;
  #clonedGeom = null;
  #resize = null;

  constructor(canvas) {
    this.canvas = canvas;
  }

  show(sourceMesh) {
    if (!sourceMesh || !sourceMesh.geometry) {
      console.warn('OrbitViewer: Invalid sourceMesh provided');
      return;
    }

    this.#init();
    this.#clear();

    // Material with neutral white base color, zero pink emissive, and pure sRGB image texture
    const mat = sourceMesh.material ? sourceMesh.material.clone() : new THREE.MeshStandardMaterial();
    mat.color.setHex(0xffffff);
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0.0;
    mat.roughness = 0.8;
    mat.metalness = 0.0;
    mat.flatShading = false;
    mat.vertexColors = false;
    mat.normalMap = null;
    if (mat.map) {
      mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.map.anisotropy = this.#renderer?.capabilities.getMaxAnisotropy() || 8;
      mat.map.needsUpdate = true;
    }
    mat.needsUpdate = true;
    this.#clonedMat = mat;

    // Clone geometry, strip conflicting AI vertex colors, and ensure smooth normals
    const geom = sourceMesh.geometry.clone();
    if (geom.attributes.color) {
      geom.deleteAttribute('color');
    }
    geom.computeVertexNormals();
    this.#clonedGeom = geom;

    const model = new THREE.Mesh(geom, mat);
    model.geometry.computeBoundingBox();
    const box = model.geometry.boundingBox;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 1 / maxDim : 1;

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
    this.#controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#controls.update();
    this.#onResize();
    this.#loop();
  }

  hide() {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#clear();
    if (this.#renderer) {
      this.#renderer.clear();
    }
  }

  #init() {
    if (this.#renderer) return;

    const r = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    this.#renderer = r;

    const scene = new THREE.Scene();
    // Pure neutral white lighting (0xffffff) with no color cast / tint
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(1.5, 3.0, 2.5);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-1.5, 1.2, -1.8);
    scene.add(ambient, key, fill);
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

    // Context loss recovery if OS ever triggers it
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('OrbitViewer: WebGL context lost');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      console.log('OrbitViewer: WebGL context restored');
      this.#renderer = null;
      this.#init();
    });
  }

  #onResize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h || !this.#renderer || !this.#camera) return;
    this.#renderer.setSize(w, h, false);
    this.#camera.aspect = w / h;
    this.#camera.updateProjectionMatrix();
  }

  #clear() {
    if (this.#model) {
      this.#scene?.remove(this.#model);
      this.#model = null;
    }
    if (this.#clonedMat) {
      this.#clonedMat.dispose();
      this.#clonedMat = null;
    }
    if (this.#clonedGeom) {
      this.#clonedGeom.dispose();
      this.#clonedGeom = null;
    }
  }

  #loop = () => {
    this.#raf = requestAnimationFrame(this.#loop);
    this.#controls?.update();
    if (this.#renderer && this.#scene && this.#camera) {
      this.#renderer.render(this.#scene, this.#camera);
    }
  };
}
