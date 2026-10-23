import * as THREE from 'three';

const REACH = 3.0; // metres
const OPEN_ANGLE = THREE.MathUtils.degToRad(115);
const OPEN_SECONDS = 0.7;
const HIGHLIGHT = new THREE.Color(0xff6fa5);

const AXIS_X = new THREE.Vector3(1, 0, 0);
const _q = new THREE.Quaternion();

/**
 * Centre-screen raycast, hover feedback (reticle/prompt/emissive tint) and
 * the lid-open animation of the memory boxes.
 */
export class Interaction {
  constructor({ camera, proxies, interactables }) {
    this.camera = camera;
    this.proxies = proxies;
    this.interactables = interactables;
    this.raycaster = new THREE.Raycaster(undefined, undefined, 0.05, REACH);
    this.hovered = null;
    this.promptEl = document.getElementById('prompt');
    this.reticleEl = document.getElementById('reticle');
    this.center = new THREE.Vector2(0, 0);
  }

  /** @param enabled whether the player is currently in control (pointer locked, no modal) */
  update(dt, enabled) {
    let hit = null;
    if (enabled) {
      this.raycaster.setFromCamera(this.center, this.camera);
      hit = this.raycaster.intersectObjects(this.proxies, false)[0]?.object.userData.interactable ?? null;
    }
    if (hit !== this.hovered) {
      this.#tint(this.hovered, false);
      this.hovered = hit;
      this.#tint(hit, true);
      this.promptEl.textContent = hit?.prompt ?? '';
      this.promptEl.style.opacity = hit ? '1' : '0';
      this.reticleEl.classList.toggle('is-active', !!hit);
    }
    this.#animateLids(dt);
  }

  /** Activate whatever is under the reticle. Returns the interactable or null. */
  activate() {
    return this.hovered;
  }

  openBox(entry) {
    entry.target = 1;
  }
  closeBox(entry) {
    entry.target = 0;
  }
  closeAllBoxes() {
    for (const i of this.interactables) if (i.kind === 'box') i.target = 0;
  }

  /** Has the lid reached (nearly) fully open? */
  isOpen(entry) {
    return entry.openAmount > 0.98;
  }

  #animateLids(dt) {
    for (const e of this.interactables) {
      if (e.kind !== 'box' || e.openAmount === e.target) continue;
      const step = dt / OPEN_SECONDS;
      e.openAmount = e.target > e.openAmount ? Math.min(e.target, e.openAmount + step) : Math.max(e.target, e.openAmount - step);
      // ease in-out
      const t = e.openAmount;
      const eased = t * t * (3 - 2 * t);
      // Lids hinge on their local X axis; negative = lift the front edge up (matches the Blender rig).
      e.pivot.quaternion.copy(e.closedQuat).multiply(_q.setFromAxisAngle(AXIS_X, -OPEN_ANGLE * eased));
    }
  }

  #tint(entry, on) {
    if (!entry) return;
    const mats = new Set();
    const collect = (o) => {
      if (o.isMesh && o.material?.emissive) mats.add(o.material);
    };
    entry.mesh.traverse(collect); // box: base + lid + stickers; others: the single mesh
    for (const m of mats) {
      if (on) {
        m.userData._emissive = m.emissive.clone();
        m.userData._ei = m.emissiveIntensity;
        m.emissive.copy(HIGHLIGHT);
        m.emissiveIntensity = 0.28;
      } else if (m.userData._emissive) {
        m.emissive.copy(m.userData._emissive);
        m.emissiveIntensity = m.userData._ei;
      }
    }
  }
}
