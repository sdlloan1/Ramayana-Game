import * as THREE from 'three';
import type { EnvKind } from './chapters';

export type WorldCollider = { x: number; z: number; radius: number };

export type World = {
  group: THREE.Group;
  bounds: number;
  colliders: WorldCollider[];
  spawnPoints: THREE.Vector3[];
  bridgeCore: THREE.Vector3 | null;
  fog: { color: number; density: number };
  update: (time: number, dt: number) => void;
  dispose: () => void;
};

type GlowTexture = THREE.CanvasTexture;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function noise2(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  return lerp(
    lerp(hash2(xi, zi), hash2(xi + 1, zi), u),
    lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u),
    v,
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function makeGlowTexture(): GlowTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,240,210,0.75)');
    gradient.addColorStop(0.6, 'rgba(255,200,140,0.18)');
    gradient.addColorStop(1, 'rgba(255,180,120,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSprite(texture: GlowTexture, color: THREE.ColorRepresentation, scale: number, opacity = 0.8): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  return sprite;
}

function makeSky(top: string, bottom: string): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(280, 24, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(top) },
      bottomColor: { value: new THREE.Color(bottom) },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vPosition;
      void main() {
        float h = normalize(vPosition).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.85)), 1.0);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

function buildGround(
  seed: number,
  colors: [string, string],
  radius: number,
  roughness: number,
  flatten = 9,
): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(radius, 120, 0, Math.PI * 2);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const base = new THREE.Color(colors[0]);
  const alt = new THREE.Color(colors[1]);
  const colorArray = new Float32Array(position.count * 3);
  const rand = mulberry32(seed);

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const r = Math.hypot(x, z);
    const falloff = smoothstep(flatten, flatten + 16, r);
    const n = noise2(x * 0.09, z * 0.09) * 0.9 + noise2(x * 0.27, z * 0.27) * 0.22;
    const height = (n - 0.5) * 2.4 * falloff;
    position.setY(i, height);
    const mix = Math.min(1, Math.max(0, n * 0.85 + rand() * 0.18));
    const c = base.clone().lerp(alt, mix);
    colorArray[i * 3] = c.r;
    colorArray[i * 3 + 1] = c.g;
    colorArray[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness,
    metalness: 0.04,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function buildTrees(
  seed: number,
  trunkColor: string,
  leafColor: string,
  count: number,
  colliders: WorldCollider[],
): THREE.Group {
  const rand = mulberry32(seed);
  const group = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.38, 3.6, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.95 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);

  const leafGeo = new THREE.ConeGeometry(1.55, 3.4, 7);
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9, flatShading: true });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count * 2);

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tint = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = 13 + Math.pow(rand(), 0.7) * 42;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const s = 0.7 + rand() * 0.9;

    pos.set(x, 1.6 * s, z);
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
    scale.set(s, s, s);
    matrix.compose(pos, quat, scale);
    trunks.setMatrixAt(i, matrix);
    tint.setHex(0xffffff).multiplyScalar(0.7 + rand() * 0.4);
    trunks.setColorAt(i, tint);

    for (let layer = 0; layer < 2; layer += 1) {
      const index = i * 2 + layer;
      const layerScale = s * (1 - layer * 0.3);
      pos.set(x, (3.0 + layer * 1.75) * s, z);
      scale.set(layerScale, layerScale, layerScale);
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      matrix.compose(pos, quat, scale);
      leaves.setMatrixAt(index, matrix);
      tint.setHex(0xffffff).multiplyScalar(0.65 + rand() * 0.5);
      leaves.setColorAt(index, tint);
    }

    if (radius < 34) colliders.push({ x, z, radius: 0.55 * s });
  }

  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  trunks.castShadow = false;
  leaves.castShadow = false;
  group.add(trunks, leaves);
  return group;
}

function buildRocks(
  seed: number,
  color: string,
  count: number,
  minRadius: number,
  maxRadius: number,
  colliders: WorldCollider[],
): THREE.InstancedMesh {
  const rand = mulberry32(seed);
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tint = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = minRadius + rand() * (maxRadius - minRadius);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const s = 0.5 + rand() * 1.9;
    pos.set(x, s * 0.34, z);
    quat.setFromEuler(new THREE.Euler(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4));
    scale.set(s, s * (0.6 + rand() * 0.7), s);
    matrix.compose(pos, quat, scale);
    mesh.setMatrixAt(i, matrix);
    tint.setHex(0xffffff).multiplyScalar(0.75 + rand() * 0.35);
    mesh.setColorAt(i, tint);
    if (s > 1.1 && radius < 32) colliders.push({ x, z, radius: s * 0.6 });
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function buildMotes(
  seed: number,
  count: number,
  color: string,
  radius: number,
  height: number,
  size: number,
): THREE.Points {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = 0.4 + rand() * height;
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
}

type Flame = { sprite: THREE.Sprite; light: THREE.PointLight; base: number };

function makeFire(
  texture: GlowTexture,
  color: string,
  scale: number,
  flames: Flame[],
): { group: THREE.Group; light: THREE.PointLight; sprite: THREE.Sprite } {
  const group = new THREE.Group();
  const light = new THREE.PointLight(color, 14, 22, 2);
  light.position.y = 1.4;
  const sprite = makeSprite(texture, color, scale, 0.85);
  sprite.position.y = 1.35;
  const core = makeSprite(texture, '#fff3c8', scale * 0.4, 0.9);
  core.position.y = 1.25;
  group.add(light, sprite, core);
  flames.push({ sprite, light, base: scale });
  return { group, light, sprite };
}

function buildAltar(texture: GlowTexture, colliders: WorldCollider[], flames: Flame[]): THREE.Group {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#5b5750', roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 0.6, 8), stone);
  base.position.y = 0.3;
  base.receiveShadow = true;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.2, 8), stone);
  column.position.y = 1.1;
  const fire = makeFire(texture, '#ff9a3c', 2.2, flames);
  fire.group.position.set(0, 0.9, 0);
  group.add(base, column, fire.group);
  group.position.set(0, 0, -15);
  colliders.push({ x: 0, z: -15, radius: 1.9 });
  return group;
}

function buildBridge(texture: GlowTexture, flames: Flame[]): { group: THREE.Group; core: THREE.Vector3 } {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#8b8273', roughness: 0.9 });
  const darkStone = new THREE.MeshStandardMaterial({ color: '#5d564b', roughness: 0.95 });

  for (let i = 0; i < 11; i += 1) {
    const z = -11 - i * 3.1;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.5, 3.0), i % 2 === 0 ? stone : darkStone);
    deck.position.set(0, 0.18, z);
    deck.receiveShadow = true;
    group.add(deck);

    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 6), stone);
      pillar.position.set(side * 3.3, -0.8, z + 1.3);
      group.add(pillar);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 3.0), darkStone);
      rail.position.set(side * 3.4, 0.75, z);
      group.add(rail);
    }
  }

  // In-progress construction at the far end — the objective the navy attacks.
  const scaffold = new THREE.Group();
  const beamMat = new THREE.MeshStandardMaterial({ color: '#3c3327', roughness: 0.95 });
  for (let i = 0; i < 4; i += 1) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.4, 0.22), beamMat);
    beam.position.set((i % 2 === 0 ? -1 : 1) * 2.6, 2.2, -24);
    beam.rotation.z = (i < 2 ? 1 : -1) * 0.12;
    scaffold.add(beam);
  }
  const plank = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.18, 1.4), beamMat);
  plank.position.set(0, 3.6, -24);
  const bannerGeo = new THREE.PlaneGeometry(1.6, 2.6);
  const bannerMat = new THREE.MeshStandardMaterial({
    color: '#c0372b',
    roughness: 0.8,
    side: THREE.DoubleSide,
    emissive: '#5c1109',
    emissiveIntensity: 0.4,
  });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 2.6, -24.2);
  const fire = makeFire(texture, '#ffb066', 1.8, flames);
  fire.group.position.set(0, 0.4, -24.4);
  scaffold.add(plank, banner, fire.group);
  group.add(scaffold);

  return { group, core: new THREE.Vector3(0, 0, -24) };
}

function buildLanka(texture: GlowTexture, colliders: WorldCollider[], flames: Flame[]): THREE.Group {
  const group = new THREE.Group();
  const rand = mulberry32(99);
  const pillarMat = new THREE.MeshStandardMaterial({
    color: '#8a6224',
    roughness: 0.55,
    metalness: 0.55,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#c9a04a',
    roughness: 0.4,
    metalness: 0.7,
    emissive: '#3a2606',
    emissiveIntensity: 0.4,
  });

  const ring = 18;
  for (let i = 0; i < ring; i += 1) {
    const angle = (i / ring) * Math.PI * 2;
    const radius = 30 + rand() * 5;
    const height = 9 + rand() * 8;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.35, height, 8), pillarMat);
    pillar.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    pillar.rotation.y = rand() * Math.PI;
    group.add(pillar);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.1, 0.8, 8), trimMat);
    cap.position.set(pillar.position.x, height, pillar.position.z);
    group.add(cap);
    colliders.push({ x: pillar.position.x, z: pillar.position.z, radius: 1.6 });
  }

  // Flanking gate towers.
  for (const side of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 16, 5), pillarMat);
    tower.position.set(side * 11, 8, -32);
    group.add(tower);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(4.1, 4.5, 4), trimMat);
    crown.position.set(side * 11, 18, -32);
    crown.rotation.y = Math.PI / 4;
    group.add(crown);
    colliders.push({ x: side * 11, z: -32, radius: 3.4 });
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(17.5, 2.2, 4.4), pillarMat);
  lintel.position.set(0, 13, -32);
  group.add(lintel);

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 12;
    const radius = 19;
    const brazier = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.8, 8), trimMat);
    bowl.position.y = 1.2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.2, 6), pillarMat);
    post.position.y = 0.5;
    const fire = makeFire(texture, '#ff7a2f', 2.4, flames);
    fire.group.position.y = 1.5;
    brazier.add(bowl, post, fire.group);
    brazier.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    group.add(brazier);
    colliders.push({ x: brazier.position.x, z: brazier.position.z, radius: 0.9 });
  }

  return group;
}

function disposeGroup(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Sprite) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose?.();
    }
  });
}

export function buildWorld(env: EnvKind): World {
  const group = new THREE.Group();
  const colliders: WorldCollider[] = [];
  const spawnPoints: THREE.Vector3[] = [];
  const texture = makeGlowTexture();
  const flames: Flame[] = [];
  let water: THREE.Mesh | null = null;
  let embers: THREE.Points | null = null;
  let bridgeCore: THREE.Vector3 | null = null;
  let bounds = 30;
  let fog = { color: 0x101c18, density: 0.013 };

  const skyConfig: Record<EnvKind, { top: string; bottom: string; sun: string; fog: number; density: number }> = {
    forest: { top: '#08140f', bottom: '#4e7a5c', sun: '#ffe2ae', fog: 0x101f18, density: 0.014 },
    canyon: { top: '#1d1410', bottom: '#a8633a', sun: '#ffcf9a', fog: 0x241812, density: 0.016 },
    ocean: { top: '#0a1a26', bottom: '#4c7f8c', sun: '#ffd9b0', fog: 0x0e222d, density: 0.011 },
    lanka: { top: '#160a0d', bottom: '#7a2c1c', sun: '#ff9a62', fog: 0x1a0d0e, density: 0.018 },
  };
  const sky = skyConfig[env];
  fog = { color: sky.fog, density: sky.density };

  group.add(makeSky(sky.top, sky.bottom));

  const sun = makeSprite(texture, sky.sun, 60, 0.4);
  sun.position.set(-70, 55, -120);
  group.add(sun);

  const hemi = new THREE.HemisphereLight(sky.bottom, '#1c1712', env === 'lanka' ? 0.55 : 0.9);
  group.add(hemi);

  const dir = new THREE.DirectionalLight(sky.sun, env === 'lanka' ? 2.6 : 2.2);
  dir.position.set(22, 34, 16);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 90;
  dir.shadow.camera.left = -32;
  dir.shadow.camera.right = 32;
  dir.shadow.camera.top = 32;
  dir.shadow.camera.bottom = -32;
  dir.shadow.bias = -0.0006;
  group.add(dir);

  if (env === 'forest') {
    bounds = 30;
    group.add(buildGround(11, ['#182b1e', '#25402b'], 62, 0.95));
    group.add(buildTrees(21, '#3a2a1c', '#1f4a30', 120, colliders));
    group.add(buildRocks(31, '#3a3b33', 26, 9, 48, colliders));
    group.add(buildAltar(texture, colliders, flames));
    const motes = buildMotes(41, 160, '#c6ff9a', 30, 5, 0.14);
    group.add(motes);
    embers = motes;
    for (let i = 0; i < 7; i += 1) {
      const mist = makeSprite(texture, '#9fd6b0', 18 + Math.random() * 12, 0.05);
      mist.position.set((Math.random() - 0.5) * 46, 0.7, -6 + (Math.random() - 0.5) * 40);
      group.add(mist);
    }
  } else if (env === 'canyon') {
    bounds = 32;
    group.add(buildGround(12, ['#4a2e1d', '#6d4426'], 62, 0.98));
    group.add(buildTrees(22, '#3b2a1d', '#4c3a21', 30, colliders));
    group.add(buildRocks(32, '#6b4a30', 60, 7, 46, colliders));
    const spireMat = new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.95, flatShading: true });
    const rand = mulberry32(52);
    for (let i = 0; i < 16; i += 1) {
      const angle = rand() * Math.PI * 2;
      const radius = 26 + rand() * 20;
      const height = 14 + rand() * 26;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(4 + rand() * 3, height, 6), spireMat);
      spire.position.set(Math.cos(angle) * radius, height / 2 - 2, Math.sin(angle) * radius);
      group.add(spire);
    }
    const bannerMat = new THREE.MeshStandardMaterial({
      color: '#b4552c',
      roughness: 0.85,
      side: THREE.DoubleSide,
      emissive: '#431206',
      emissiveIntensity: 0.35,
    });
    for (const x of [-9, 9]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 7, 6),
        new THREE.MeshStandardMaterial({ color: '#2c2118', roughness: 0.9 }),
      );
      pole.position.set(x, 3.5, -13);
      group.add(pole);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.2), bannerMat);
      banner.position.set(x + 1, 4.4, -13);
      group.add(banner);
      colliders.push({ x, z: -13, radius: 0.4 });
    }
    const dust = buildMotes(42, 220, '#ffd9a3', 34, 8, 0.13);
    group.add(dust);
    embers = dust;
  } else if (env === 'ocean') {
    bounds = 31;
    group.add(buildGround(13, ['#4d4636', '#6d6150'], 26, 0.92, 6));

    const waterGeometry = new THREE.PlaneGeometry(320, 320, 72, 72);
    waterGeometry.rotateX(-Math.PI / 2);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: '#153f4c',
      roughness: 0.18,
      metalness: 0.55,
      transparent: true,
      opacity: 0.92,
    });
    water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.position.y = -0.55;
    water.receiveShadow = false;
    group.add(water);

    const bridge = buildBridge(texture, flames);
    group.add(bridge.group);
    bridgeCore = bridge.core;

    group.add(buildRocks(33, '#5e5a4e', 24, 12, 42, colliders));
    const spray = buildMotes(43, 200, '#c8ecff', 36, 7, 0.12);
    group.add(spray);
    embers = spray;
  } else {
    bounds = 33;
    group.add(buildGround(14, ['#2a1a18', '#452421'], 64, 0.9));
    group.add(buildLanka(texture, colliders, flames));
    group.add(buildRocks(34, '#3a2620', 26, 10, 44, colliders));
    const emberCloud = buildMotes(44, 240, '#ff8a4a', 34, 9, 0.14);
    group.add(emberCloud);
    embers = emberCloud;
  }

  if (env !== 'ocean') {
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2 + 0.2;
      const radius = 18 + (i % 3) * 3;
      spawnPoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
  } else {
    for (let i = 0; i < 6; i += 1) {
      spawnPoints.push(new THREE.Vector3(-2.4 + (i % 3) * 2.4, 0, -16 - Math.floor(i / 3) * 5));
    }
    spawnPoints.push(new THREE.Vector3(-10, 0, -6), new THREE.Vector3(10, 0, -6));
  }

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = child.castShadow || false;
      child.receiveShadow = true;
    }
  });

  const flamesList = flames;

  return {
    group,
    bounds,
    colliders,
    spawnPoints,
    bridgeCore,
    fog,
    update(time: number) {
      if (water) {
        const attr = water.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < attr.count; i += 1) {
          const x = attr.getX(i);
          const z = attr.getZ(i);
          attr.setY(i, Math.sin(x * 0.18 + time * 1.2) * 0.28 + Math.cos(z * 0.22 + time * 0.9) * 0.22);
        }
        attr.needsUpdate = true;
      }
      if (embers) {
        embers.rotation.y = time * 0.03;
        embers.position.y = Math.sin(time * 0.5) * 0.3;
      }
      for (const flame of flamesList) {
        const pulse = 0.85 + Math.sin(time * 7 + flame.base) * 0.12 + Math.cos(time * 11.3 + flame.base) * 0.06;
        flame.light.intensity = 12 * pulse;
        flame.sprite.scale.setScalar(flame.base * pulse);
      }
    },
    dispose() {
      group.removeFromParent();
      disposeGroup(group);
      texture.dispose();
    },
  };
}
