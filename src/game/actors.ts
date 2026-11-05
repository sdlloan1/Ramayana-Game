import * as THREE from 'three';
import { makeGlowTexture } from './world';

export type ActorKind =
  | 'rama'
  | 'asura'
  | 'brute'
  | 'vanara'
  | 'rakshasa'
  | 'dushana'
  | 'vali'
  | 'kumbhakarna'
  | 'indrajit'
  | 'ravana'
  | 'hanuman';

export type Rig = {
  kind: ActorKind;
  root: THREE.Group;
  visual: THREE.Group;
  torso: THREE.Group;
  head: THREE.Object3D;
  armL: THREE.Group;
  armR: THREE.Group;
  armL2: THREE.Group | null;
  armR2: THREE.Group | null;
  legL: THREE.Group;
  legR: THREE.Group;
  weapon: THREE.Object3D | null;
  bow: THREE.Object3D | null;
  materials: THREE.MeshStandardMaterial[];
  baseEmissive: THREE.Color[];
  height: number;
  radius: number;
  glow: THREE.Sprite | null;
};

type BuildSpec = {
  skin: string;
  skinAlt: string;
  cloth: string;
  accent: string;
  eye: string;
  scale: number;
  bulk: number;
  horns: boolean;
  tail: boolean;
  bow: boolean;
  sword: boolean;
  club: boolean;
  hood: boolean;
  heads: number;
  extraArms: boolean;
  crown: string | null;
  glow: string | null;
};

const SPECS: Record<ActorKind, BuildSpec> = {
  rama: {
    skin: '#3f5c8f',
    skinAlt: '#2c4470',
    cloth: '#d8b25a',
    accent: '#e8c877',
    eye: '#f3e6c4',
    scale: 1,
    bulk: 1,
    horns: false,
    tail: false,
    bow: true,
    sword: true,
    club: false,
    hood: false,
    heads: 1,
    extraArms: false,
    crown: '#e8c877',
    glow: '#f6d998',
  },
  asura: {
    skin: '#6b2e2c',
    skinAlt: '#4a1d1d',
    cloth: '#2b1416',
    accent: '#8a4a2a',
    eye: '#ff7a4a',
    scale: 1.02,
    bulk: 1.05,
    horns: true,
    tail: false,
    bow: false,
    sword: false,
    club: true,
    hood: false,
    heads: 1,
    extraArms: false,
    crown: null,
    glow: '#ff5a2a',
  },
  brute: {
    skin: '#5b2a28',
    skinAlt: '#3c1a1a',
    cloth: '#241012',
    accent: '#b06a32',
    eye: '#ffb14a',
    scale: 1.35,
    bulk: 1.32,
    horns: true,
    tail: false,
    bow: false,
    sword: false,
    club: true,
    hood: false,
    heads: 1,
    extraArms: false,
    crown: null,
    glow: '#ff7a2a',
  },
  vanara: {
    skin: '#7a5433',
    skinAlt: '#5b3c22',
    cloth: '#9c7b2f',
    accent: '#d9b65a',
    eye: '#ffe9b0',
    scale: 1.06,
    bulk: 1.08,
    horns: false,
    tail: true,
    bow: false,
    sword: false,
    club: true,
    hood: false,
    heads: 1,
    extraArms: false,
    crown: null,
    glow: null,
  },
  rakshasa: {
    skin: '#3f2438',
    skinAlt: '#291728',
    cloth: '#1b0f1a',
    accent: '#7a3f6a',
    eye: '#e87aff',
    scale: 1.08,
    bulk: 0.95,
    horns: true,
    tail: false,
    bow: true,
    sword: false,
    club: false,
    hood: true,
    heads: 1,
    extraArms: false,
    crown: null,
    glow: '#b45aff',
  },
  dushana: {
    skin: '#5a2622',
    skinAlt: '#33130f',
    cloth: '#2b0f0c',
    accent: '#d9a441',
    eye: '#ffcf5a',
    scale: 1.95,
    bulk: 1.25,
    horns: true,
    tail: false,
    bow: false,
    sword: false,
    club: true,
    hood: false,
    heads: 1,
    extraArms: false,
    crown: '#d9a441',
    glow: '#ff7a2a',
  },
  vali: {
    skin: '#c9964a',
    skinAlt: '#a4762f',
    cloth: '#8c2f22',
    accent: '#f0cc70',
    eye: '#fff0b8',
    scale: 2.1,
    bulk: 1.28,
    horns: false,
    tail: true,
    bow: false,
    sword: false,
    club: false,
    hood: false,
    heads: 1,
    extraArms: false,
    crown: '#f0cc70',
    glow: '#ffcc66',
  },
  kumbhakarna: {
    skin: '#6a4a2c',
    skinAlt: '#4a3020',
    cloth: '#3a2418',
    accent: '#b98d3e',
    eye: '#ffb84a',
    scale: 2.9,
    bulk: 1.6,
    horns: true,
    tail: false,
    bow: false,
    sword: false,
    club: true,
    hood: false,
    heads: 1,
    extraArms: false,
    crown: '#b98d3e',
    glow: '#ff8a3a',
  },
  indrajit: {
    skin: '#2f2a44',
    skinAlt: '#1e1a30',
    cloth: '#141226',
    accent: '#7a6cd9',
    eye: '#b39cff',
    scale: 2.15,
    bulk: 1.02,
    horns: false,
    tail: false,
    bow: true,
    sword: false,
    club: false,
    hood: true,
    heads: 1,
    extraArms: false,
    crown: '#7a6cd9',
    glow: '#9a7aff',
  },
  ravana: {
    skin: '#4a2a3a',
    skinAlt: '#2f1a26',
    cloth: '#3a0f12',
    accent: '#e0b04a',
    eye: '#ff4a4a',
    scale: 2.45,
    bulk: 1.12,
    horns: false,
    tail: false,
    bow: false,
    sword: true,
    club: false,
    hood: false,
    heads: 10,
    extraArms: true,
    crown: '#e0b04a',
    glow: '#ff5a3a',
  },
  hanuman: {
    skin: '#a0703f',
    skinAlt: '#7d532c',
    cloth: '#d9a441',
    accent: '#f3d98a',
    eye: '#fff4cc',
    scale: 1.7,
    bulk: 1.15,
    horns: false,
    tail: true,
    bow: false,
    sword: false,
    club: true,
    hood: false,
    heads: 1,
    extraArms: false,
    crown: '#f3d98a',
    glow: '#ffe9a8',
  },
};

function standard(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.12,
    ...extra,
  });
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

function makeLimb(
  length: number,
  thickness: number,
  material: THREE.Material,
  handColor: string,
): { pivot: THREE.Group; hand: THREE.Mesh } {
  const pivot = new THREE.Group();
  const upper = mesh(
    new THREE.CapsuleGeometry(thickness, length * 0.55, 3, 6),
    material,
    [0, -length * 0.36, 0],
  );
  const hand = mesh(
    new THREE.SphereGeometry(thickness * 1.35, 8, 6),
    standard(handColor, { roughness: 0.8 }),
    [0, -length * 0.78, 0],
  );
  pivot.add(upper, hand);
  return { pivot, hand };
}

export function createActor(kind: ActorKind): Rig {
  const spec = SPECS[kind];
  const root = new THREE.Group();
  const visual = new THREE.Group();
  root.add(visual);

  const skin = standard(spec.skin, { roughness: 0.78 });
  const skinAlt = standard(spec.skinAlt, { roughness: 0.82 });
  const cloth = standard(spec.cloth, { roughness: 0.9 });
  const accent = standard(spec.accent, { roughness: 0.45, metalness: 0.6, emissive: spec.accent, emissiveIntensity: 0.08 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: spec.eye,
    emissive: spec.eye,
    emissiveIntensity: 2.2,
    roughness: 0.4,
  });

  const bulk = spec.bulk;
  const torso = new THREE.Group();
  visual.add(torso);

  // Legs
  const hipY = 0.86;
  const legFor = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.18 * bulk, hipY, 0);
    const thigh = mesh(
      new THREE.CapsuleGeometry(0.1 * bulk, 0.44, 3, 6),
      skinAlt,
      [0, -0.28, 0],
    );
    const shin = mesh(new THREE.CapsuleGeometry(0.085 * bulk, 0.36, 3, 6), skin, [0, -0.62, 0]);
    const foot = mesh(new THREE.BoxGeometry(0.16 * bulk, 0.1, 0.28), cloth, [0, -0.84, 0.06]);
    pivot.add(thigh, shin, foot);
    visual.add(pivot);
    return pivot;
  };
  const legL = legFor(-1);
  const legR = legFor(1);

  if (kind === 'rama') {
    const dhoti = mesh(new THREE.CylinderGeometry(0.24, 0.42, 0.62, 10), cloth, [0, 0.72, 0]);
    const sash = mesh(new THREE.TorusGeometry(0.28, 0.045, 6, 16, Math.PI * 1.5), accent, [0, 0.92, 0], [Math.PI / 2, 0, 0.4]);
    visual.add(dhoti, sash);
  }

  // Torso
  const torsoMesh = mesh(
    new THREE.CapsuleGeometry(0.28 * bulk, 0.44 * bulk, 4, 10),
    skin,
    [0, 1.28, 0],
  );
  torso.add(torsoMesh);

  const chest = mesh(
    new THREE.BoxGeometry(0.5 * bulk, 0.36, 0.14),
    accent,
    [0, 1.4, 0.24],
  );
  chest.scale.setScalar(kind === 'rama' ? 0.9 : 1);
  torso.add(chest);

  if (spec.bulk > 1.2 && kind !== 'hanuman') {
    const belly = mesh(new THREE.SphereGeometry(0.42 * bulk, 12, 8), skinAlt, [0, 1.06, 0.06]);
    belly.scale.set(1, 0.85, 0.9);
    torso.add(belly);
  }

  const shoulderGeo = new THREE.SphereGeometry(0.17 * bulk, 10, 8);

  const armFor = (side: number) => {
    const arm = makeLimb(0.78, 0.075 * bulk, skinAlt, spec.skin);
    arm.pivot.position.set(side * 0.36 * bulk, 1.5, 0);
    torso.add(arm.pivot);
    const shoulder = mesh(shoulderGeo, skin, [side * 0.06, 0.02, 0]);
    arm.pivot.add(shoulder);
    return arm.pivot;
  };
  const armL = armFor(-1);
  const armR = armFor(1);

  let armL2: THREE.Group | null = null;
  let armR2: THREE.Group | null = null;
  if (spec.extraArms) {
    armL2 = new THREE.Group();
    armL2.position.set(-0.44 * bulk, 1.28, 0);
    armL2.rotation.z = 0.5;
    armL2.add(
      mesh(new THREE.CapsuleGeometry(0.07, 0.6, 3, 6), skinAlt, [0, -0.38, 0]),
      mesh(new THREE.SphereGeometry(0.1, 8, 6), skin, [0, -0.72, 0]),
    );
    armR2 = new THREE.Group();
    armR2.position.set(0.44 * bulk, 1.28, 0);
    armR2.rotation.z = -0.5;
    armR2.add(
      mesh(new THREE.CapsuleGeometry(0.07, 0.6, 3, 6), skinAlt, [0, -0.38, 0]),
      mesh(new THREE.SphereGeometry(0.1, 8, 6), skin, [0, -0.72, 0]),
    );
    torso.add(armL2, armR2);
  }

  // Neck + head(s)
  const neck = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 8), skinAlt, [0, 1.68, 0]);
  torso.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 1.82, 0);
  torso.add(head);

  const headCount = spec.heads;
  const headPositions: [number, number, number][] = [[0, 0, 0]];
  if (headCount === 10) {
    headPositions.length = 0;
    const rows = [
      { y: -0.1, xs: [-0.42, -0.14, 0.14, 0.42] },
      { y: 0.18, xs: [-0.34, 0, 0.34] },
      { y: 0.44, xs: [-0.2, 0.2] },
      { y: 0.66, xs: [0] },
    ];
    for (const row of rows) for (const x of row.xs) headPositions.push([x, row.y, 0.02]);
  }

  for (const [hx, hy, hz] of headPositions) {
    const skull = mesh(new THREE.SphereGeometry(0.19, 12, 10), skin, [hx, hy, hz]);
    head.add(skull);
    const face = mesh(new THREE.BoxGeometry(0.16, 0.06, 0.05), cloth, [hx, hy - 0.05, hz + 0.17]);
    head.add(face);
    for (const eyeSide of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeMat, [hx + eyeSide * 0.07, hy + 0.03, hz + 0.17]);
      head.add(eye);
    }
    if (spec.horns) {
      for (const hornSide of [-1, 1]) {
        const horn = mesh(
          new THREE.ConeGeometry(0.045, 0.26, 6),
          standard('#cbb89a', { roughness: 0.8 }),
          [hx + hornSide * 0.12, hy + 0.2, hz],
          [0, 0, hornSide * 0.35],
        );
        head.add(horn);
      }
    }
  }

  if (spec.crown) {
    const crownMat = standard(spec.crown, { metalness: 0.7, roughness: 0.35, emissive: spec.crown, emissiveIntensity: 0.2 });
    const crown = mesh(new THREE.ConeGeometry(0.22, 0.26, 8), crownMat, [0, headCount > 1 ? 0.95 : 0.25, 0]);
    head.add(crown);
    if (kind === 'rama') {
      const bun = mesh(new THREE.SphereGeometry(0.12, 8, 8), standard('#241a16'), [0, 0.06, -0.2]);
      head.add(bun);
    }
  }

  if (spec.hood) {
    const hood = mesh(new THREE.ConeGeometry(0.34, 0.62, 8), cloth, [0, 0.08, -0.03]);
    hood.rotation.x = -0.08;
    head.add(hood);
  }

  if (spec.tail) {
    const tail = mesh(
      new THREE.TorusGeometry(0.5, 0.05, 6, 18, Math.PI * 1.4),
      skinAlt,
      [0, 1.0, -0.35],
      [0, Math.PI / 2, 0.4],
    );
    torso.add(tail);
  }

  let weapon: THREE.Object3D | null = null;
  let bowObject: THREE.Object3D | null = null;
  if (spec.sword) {
    const sword = new THREE.Group();
    const blade = mesh(
      new THREE.BoxGeometry(0.055, 0.92, 0.02),
      standard('#d7dbe6', { metalness: 0.85, roughness: 0.25, emissive: '#3a4a66', emissiveIntensity: 0.3 }),
      [0, -0.46, 0],
    );
    const guard = mesh(new THREE.BoxGeometry(0.26, 0.05, 0.07), accent, [0, 0.02, 0]);
    const grip = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6), cloth, [0, 0.12, 0]);
    sword.add(blade, guard, grip);
    sword.position.set(0, -0.78, 0.04);
    armR.add(sword);
    weapon = sword;
  }

  if (spec.bow) {
    const bow = new THREE.Group();
    const limb = mesh(
      new THREE.TorusGeometry(0.5, 0.022, 5, 22, Math.PI * 1.25),
      accent,
      [0, 0, 0],
      [0, 0, Math.PI * 0.62],
    );
    const stringMat = new THREE.MeshBasicMaterial({ color: '#f0e6cc', transparent: true, opacity: 0.7 });
    const string = mesh(new THREE.BoxGeometry(0.006, 0.92, 0.006), stringMat, [0, 0, 0.05]);
    bow.add(limb, string);
    if (kind === 'rama') {
      bow.position.set(-0.06, 0.1, -0.28);
      bow.rotation.set(0.1, 0.4, 0.4);
      torso.add(bow);
      bowObject = bow;
    } else {
      bow.position.set(0.06, -0.62, 0.12);
      bow.rotation.set(0.3, 0, -1.1);
      armL.add(bow);
    }
    weapon = bow;
  }

  if (spec.club) {
    const club = new THREE.Group();
    const handle = mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 6), standard('#3b2a1c'), [0, -0.3, 0]);
    const headClub = mesh(new THREE.DodecahedronGeometry(0.22, 0), standard('#4a3a2c', { flatShading: true }), [0, 0.34, 0]);
    const spike = mesh(new THREE.ConeGeometry(0.07, 0.24, 5), standard('#8a7a5f', { metalness: 0.5 }), [0, 0.56, 0]);
    club.add(handle, headClub, spike);
    club.position.set(0, -0.86, 0.08);
    armR.add(club);
    weapon = club;
  }

  if (spec.extraArms) {
    for (const arm of [armL2, armR2]) {
      if (!arm) continue;
      const blade = mesh(
        new THREE.BoxGeometry(0.05, 0.78, 0.02),
        standard('#d7dbe6', { metalness: 0.8, roughness: 0.3 }),
        [0, -0.98, 0.06],
      );
      arm.add(blade);
    }
  }

  // Boss aura — additive sprite so commanders read instantly in a crowd.
  let glow: THREE.Sprite | null = null;
  if (spec.glow) {
    const texture = makeGlowTexture();
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: spec.glow,
      transparent: true,
      opacity: kind === 'rama' ? 0.16 : 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    glow = new THREE.Sprite(material);
    glow.scale.setScalar(kind === 'rama' ? 1.6 : 2.6);
    glow.position.y = kind === 'rama' ? 1.4 : 1.3;
    visual.add(glow);
  }

  const materials: THREE.MeshStandardMaterial[] = [];
  visual.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material;
      if (material instanceof THREE.MeshStandardMaterial && !materials.includes(material)) {
        materials.push(material);
      }
    }
  });

  root.scale.setScalar(spec.scale);
  const height = (headCount > 1 ? 2.55 : 2.05) * spec.scale;
  const radius = Math.max(0.45, 0.42 * bulk * spec.scale);

  return {
    kind,
    root,
    visual,
    torso,
    head,
    armL,
    armR,
    armL2,
    armR2,
    legL,
    legR,
    weapon,
    bow: bowObject,
    materials,
    baseEmissive: materials.map((m) => m.emissive.clone()),
    height,
    radius,
    glow,
  };
}

export function applyFlash(rig: Rig, amount: number): void {
  const t = Math.max(0, Math.min(1, amount));
  for (let i = 0; i < rig.materials.length; i += 1) {
    const material = rig.materials[i];
    if (material.userData.noFlash) continue;
    material.emissive.copy(rig.baseEmissive[i]).lerp(new THREE.Color('#fff2d0'), t);
  }
}

export function animateIdle(rig: Rig, time: number, moveSpeed: number, attacking: boolean): void {
  const phase = time * 9;
  const swing = Math.min(1, moveSpeed / 5.5);
  const breathe = Math.sin(time * 1.6) * 0.012;

  rig.legL.rotation.x = Math.sin(phase) * 0.55 * swing;
  rig.legR.rotation.x = -Math.sin(phase) * 0.55 * swing;
  rig.visual.position.y = Math.abs(Math.sin(phase)) * 0.06 * swing + breathe;

  if (!attacking) {
    rig.armL.rotation.x = -Math.sin(phase) * 0.4 * swing;
    rig.armR.rotation.x = Math.sin(phase) * 0.4 * swing;
  }
  rig.torso.rotation.y = Math.sin(phase * 0.5) * 0.04 * swing;
  rig.torso.rotation.z = Math.sin(phase) * 0.02 * swing;
  if (rig.glow) {
    const material = rig.glow.material as THREE.SpriteMaterial;
    material.opacity = 0.18 + Math.sin(time * 2.4) * 0.05;
  }
}

export function disposeRig(rig: Rig): void {
  rig.root.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
      const meshChild = child as THREE.Mesh;
      meshChild.geometry?.dispose?.();
      const material = meshChild.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose?.();
    }
  });
  if (rig.glow) {
    const material = rig.glow.material as THREE.SpriteMaterial;
    material.map?.dispose();
    material.dispose();
  }
}
