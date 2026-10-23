import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { ROOM_BOUNDS, SPAWN } from './world.js';

const EYE_HEIGHT = 1.55;
const RADIUS = 0.22;
const WALK = 2.0; // m/s
const RUN = 3.4;
const ACCEL = 14; // how quickly we reach the target speed
const BOB_FREQ = 9;
const BOB_AMP = 0.012;

/**
 * First-person controller: Pointer Lock look + WASD/arrow movement with smooth
 * acceleration/friction and simple circle-vs-AABB collision (walls + furniture).
 */
export class Player {
  constructor(camera, domElement, colliders) {
    this.camera = camera;
    this.colliders = colliders;
    this.controls = new PointerLockControls(camera, domElement);
    this.controls.pointerSpeed = 0.8;
    this.velocity = new THREE.Vector2(); // x, z
    this.keys = new Set();
    this.bob = 0;
    this.moving = false;

    camera.position.copy(SPAWN.position).setY(EYE_HEIGHT);
    camera.rotation.set(0, SPAWN.yaw, 0, 'YXZ');

    addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  get isLocked() {
    return this.controls.isLocked;
  }

  lock() {
    // may reject if the user pressed Esc just before: harmless
    try {
      const p = this.controls.lock();
      p?.catch?.(() => {});
    } catch {
      /* noop */
    }
  }
  unlock() {
    this.controls.unlock();
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    const k = this.keys;
    let f = 0;
    let r = 0;
    if (this.isLocked) {
      if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) r += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) r -= 1;
    }
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN : WALK;

    // input direction in world space (camera yaw only)
    const yaw = this.camera.rotation.y;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // forward = (-sin, -cos), right = (cos, -sin)
    let dx = -sin * f + cos * r;
    let dz = -cos * f - sin * r;
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      dx = (dx / len) * speed;
      dz = (dz / len) * speed;
    }

    // exponential approach to target velocity = smooth acceleration + friction
    const t = 1 - Math.exp(-ACCEL * dt);
    this.velocity.x += (dx - this.velocity.x) * t;
    this.velocity.y += (dz - this.velocity.y) * t;

    const pos = this.camera.position;
    this.#moveAxis(pos, this.velocity.x * dt, 'x');
    this.#moveAxis(pos, this.velocity.y * dt, 'z');

    const planar = this.velocity.length();
    this.moving = planar > 0.35;
    if (this.moving) this.bob += dt * BOB_FREQ * (planar / WALK);
    const targetY = EYE_HEIGHT + (this.moving ? Math.sin(this.bob) * BOB_AMP : 0);
    pos.y += (targetY - pos.y) * Math.min(1, dt * 12);
  }

  #moveAxis(pos, delta, axis) {
    if (!delta) return;
    const next = pos[axis] + delta;
    const prev = pos[axis];
    pos[axis] = next;
    const b = ROOM_BOUNDS;
    pos.x = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX);
    pos.z = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
    for (const box of this.colliders) {
      if (
        pos.x > box.min.x - RADIUS &&
        pos.x < box.max.x + RADIUS &&
        pos.z > box.min.z - RADIUS &&
        pos.z < box.max.z + RADIUS
      ) {
        pos[axis] = prev; // slide: blocked on this axis only
        this.velocity[axis === 'x' ? 'x' : 'y'] = 0;
        break;
      }
    }
  }
}
