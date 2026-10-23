import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import memories from './data/memories.json';
import { LightingController } from './lighting.js';

// Blender is Z-up, glTF/three is Y-up: (x, y, z)_blender -> (x, z, -y)_three.
export const bl = (x, y, z = 0) => new THREE.Vector3(x, z, -y);

export const DOLLS = {
  Doll_Freya_Slot1_Trainee: 'Freya — Trainee',
  Doll_Freya_Slot2_TimT: 'Freya — Tim T',
  Doll_Freya_Slot3_SeifukuMerah: 'Freya — Seifuku Merah',
  Doll_Freya_Slot4_Ratu: 'Freya — Ratu',
  Plushie_Freya: 'Freya Plushie',
  Plushie_Freya_Seifuku: 'Freya — Seifuku Duduk',
};

/** Static furniture that blocks the player (Blender node names). */
const OBSTACLES = [
  'Bed',
  'Floating_CurvedDesk',
  'Desk_UnderSlats',
  'Desk_Office_Chair',
  'DisplayShelf_Frame',
  'West_Shelf_Plane.001',
];

// Walkable floor in three.js XZ (Blender x∈[-2.05,2.6], y∈[0,4.05] minus wall thickness).
export const ROOM_BOUNDS = { minX: -1.95, maxX: 2.5, minZ: -3.95, maxZ: -0.12 };
export const SPAWN = { position: bl(0, 0.9, 1.6), yaw: 0 };

const sanitize = (n) => n.replace(/\s/g, '_').replace(/[\[\]./:]/g, '');

export async function loadWorld(scene, renderer, onProgress) {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync('/models/room.glb', (e) => {
    if (e.lengthComputable) onProgress?.(e.loaded / e.total);
  });
  draco.dispose();
  const root = gltf.scene;
  scene.add(root);
  root.updateMatrixWorld(true);

  const byName = new Map();
  root.traverse((o) => {
    byName.set(o.name, o);
    if (o.isMesh) {
      // Small props (dolls, books, ivy…) don't need to cast shadows: keeps the shadow pass cheap.
      const size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      o.castShadow = Math.max(size.x, size.y, size.z) > 0.45;
      o.receiveShadow = true;
      const m = o.material;
      if (m?.map) m.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      // glTF export drops the alpha of the sticker PNGs: restore it.
      if (/^Mat_Sticker/.test(m?.name ?? '')) {
        m.transparent = true;
        m.depthWrite = false;
        m.polygonOffset = true;
        m.polygonOffsetFactor = -2;
      }
      // Give the desk lamp shade a warm ambient glow
      if (o.name === 'Lamp_S') {
        m.emissive = new THREE.Color(0xffaa44);
        m.emissiveIntensity = 2.5;
      }
      // Tune room ceiling and walls to match moody movie reels
      if (m?.name === 'Mat_RoomCeiling') {
        m.color = new THREE.Color(0x524c4e);
        m.roughness = 0.95;
      }
      if (m?.name === 'Mat_FloralWallpaper') {
        m.color = new THREE.Color(0xb0a094);
        m.roughness = 0.85;
      }
    }
  });
  const find = (n) => byName.get(sanitize(n));

  const lighting = new LightingController(scene, renderer);
  const interactablesData = buildInteractables(root, find, scene);

  return {
    root,
    find,
    lighting,
    colliders: buildColliders(find),
    ...interactablesData,
  };
}

function buildColliders(find) {
  const boxes = [];
  for (const name of OBSTACLES) {
    const o = find(name);
    if (!o) {
      console.warn('collider node missing:', name);
      continue;
    }
    const b = new THREE.Box3().setFromObject(o);
    if (b.min.y > 1.2) continue; // above head height: not an obstacle
    boxes.push(b);
  }
  return boxes;
}

const BOX_DEFS = memories.boxes; // { n, slug, label, name, color, photos }

function buildInteractables(root, find, scene) {
  /** @type {{ kind: 'box'|'photo'|'doll'|'switch', proxy: THREE.Mesh, prompt: string, [k: string]: any }[]} */
  const interactables = [];
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

  const addProxy = (bounds, data, pad = 0.03) => {
    const size = bounds.getSize(new THREE.Vector3()).addScalar(pad * 2);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), proxyMat);
    proxy.position.copy(bounds.getCenter(new THREE.Vector3()));
    proxy.updateMatrixWorld(true);
    const entry = { proxy, ...data };
    proxy.userData.interactable = entry;
    interactables.push(entry);
    return entry;
  };

  // --- 6 memory boxes ---------------------------------------------------------
  for (const def of BOX_DEFS) {
    const base = find(`${def.slug}_Base`);
    const pivot = find(`${def.slug}_LidPivot`);
    if (!base || !pivot) {
      console.warn('memory box missing in GLB:', def.slug);
      continue;
    }
    base.traverse((o) => {
      if (o.isMesh) o.material = o.material.clone(); // per-box hover tint
    });
    const bounds = new THREE.Box3().setFromObject(base);
    bounds.expandByObject(pivot.children[0] ?? pivot);
    const closedQuat = pivot.quaternion.clone();
    addProxy(bounds, {
      kind: 'box',
      def,
      pivot,
      closedQuat,
      openAmount: 0, // 0 = closed .. 1 = open
      target: 0,
      prompt: `Tekan E atau klik untuk membuka — ${def.name}`,
      mesh: base,
    });
  }

  // --- wall photo board ("cardboard") ----------------------------------------
  const boardItems = [];
  for (const [objName, url] of Object.entries(memories.board)) {
    const mesh = find(objName);
    if (!mesh) continue;
    boardItems.push({ name: objName, mesh, url });
  }
  boardItems.sort((a, b) => a.name.localeCompare(b.name));
  const lightboxItems = boardItems.map((b, i) => ({
    full: b.url,
    title: `Foto papan #${i + 1}`,
    note: 'Papan foto di dinding kamar Freya',
  }));
  boardItems.forEach((b, i) => {
    b.mesh.material = b.mesh.material.clone(); // own material so hover can tint just this photo
    const bounds = new THREE.Box3().setFromObject(b.mesh);
    // the photos are thin planes: give the proxy depth so the ray reliably hits
    addProxy(bounds, { kind: 'photo', index: i, items: lightboxItems, mesh: b.mesh, prompt: 'Tekan E atau klik untuk melihat foto' }, 0.02);
  });

  // --- Freya dolls ------------------------------------------------------------
  for (const [nodeName, title] of Object.entries(DOLLS)) {
    const mesh = find(nodeName);
    if (!mesh) {
      console.warn('doll missing in GLB:', nodeName);
      continue;
    }
    mesh.material = mesh.material.clone();
    mesh.material.normalMap = null;
    mesh.material.roughness = 0.65;
    mesh.material.metalness = 0.0;
    mesh.material.flatShading = false;
    mesh.material.needsUpdate = true;
    if (mesh.geometry) {
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.computeVertexNormals();
    }
    addProxy(new THREE.Box3().setFromObject(mesh), {
      kind: 'doll',
      title,
      mesh,
      prompt: `Tekan E atau klik untuk memutar — ${title}`,
    }, 0.02);
  }

  // --- physical light switch near door ----------------------------------------
  const switchGroup = new THREE.Group();
  switchGroup.name = 'Physical_Light_Switch';
  // Positioned on the entrance south wall right beside the door frame (height 1.35m)
  switchGroup.position.copy(bl(0.60, 0.04, 1.35));
  switchGroup.rotation.y = Math.PI; // Face towards the room (-z in Three.js)

  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xf3f3f5,
    roughness: 0.35,
    metalness: 0.05,
  });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.015), plateMat);
  plate.castShadow = true;
  plate.receiveShadow = true;
  switchGroup.add(plate);

  const rockerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.05,
  });
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.075, 0.012), rockerMat);
  rocker.position.set(0, 0, 0.007);
  rocker.rotation.x = 0.16; // Day mode: tilted down at bottom
  rocker.castShadow = true;
  switchGroup.add(rocker);

  const ledGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 16);
  ledGeo.rotateX(Math.PI / 2);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xffb300,
    emissive: 0xffb300,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 0.045, 0.008);
  switchGroup.add(led);

  scene.add(switchGroup);

  const switchBounds = new THREE.Box3().setFromObject(switchGroup);
  const switchItem = addProxy(
    switchBounds,
    {
      kind: 'switch',
      prompt: 'Tekan E atau klik saklar — Matikan lampu (Mode Malam)',
      mesh: plate,
      rocker,
      ledMat,
      switchGroup,
      updateState(isNight) {
        this.rocker.rotation.x = isNight ? -0.16 : 0.16;
        const color = isNight ? 0x00e5ff : 0xffb300;
        this.ledMat.color.setHex(color);
        this.ledMat.emissive.setHex(color);
        this.ledMat.emissiveIntensity = isNight ? 3.0 : 2.0;
        this.prompt = isNight
          ? 'Tekan E atau klik saklar — Nyalakan lampu (Mode Terang)'
          : 'Tekan E atau klik saklar — Matikan lampu (Mode Malam)';
      },
    },
    0.04,
  );

  return {
    interactables,
    proxies: interactables.map((i) => i.proxy),
    switchItem,
  };
}
