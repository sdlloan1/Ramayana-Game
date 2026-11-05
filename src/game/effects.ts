import * as THREE from 'three';

type Transient = {
  object: THREE.Object3D;
  material: THREE.Material & { opacity: number };
  life: number;
  maxLife: number;
  grow: number;
  spin: number;
  geometry: THREE.BufferGeometry | null;
};

const PARTICLE_COUNT = 520;

/**
 * Lightweight effect layer: one pooled additive point cloud for sparks/embers,
 * plus short-lived slash arcs, shockwave rings and beams. No post-processing
 * passes, so the frame cost stays low enough for the overlay target.
 */
export class Effects {
  private readonly scene: THREE.Object3D;
  private readonly geometry: THREE.BufferGeometry;
  private readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly baseColors: Float32Array;
  private cursor = 0;
  private transient: Transient[] = [];

  constructor(scene: THREE.Object3D) {
    this.scene = scene;
    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.colors = new Float32Array(PARTICLE_COUNT * 3);
    this.velocities = new Float32Array(PARTICLE_COUNT * 3);
    this.life = new Float32Array(PARTICLE_COUNT);
    this.maxLife = new Float32Array(PARTICLE_COUNT);
    this.baseColors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      this.positions[i * 3 + 1] = -999;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.scene.add(this.points);
  }

  burst(
    position: THREE.Vector3,
    color: THREE.ColorRepresentation,
    count = 14,
    speed = 4,
    life = 0.7,
    gravity = 7,
  ): void {
    const tint = new THREE.Color(color);
    for (let i = 0; i < count; i += 1) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % PARTICLE_COUNT;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const magnitude = speed * (0.35 + Math.random() * 0.85);
      this.positions[index * 3] = position.x + (Math.random() - 0.5) * 0.4;
      this.positions[index * 3 + 1] = position.y + (Math.random() - 0.5) * 0.4;
      this.positions[index * 3 + 2] = position.z + (Math.random() - 0.5) * 0.4;
      this.velocities[index * 3] = Math.sin(phi) * Math.cos(theta) * magnitude;
      this.velocities[index * 3 + 1] = Math.cos(phi) * magnitude + gravity * 0.1;
      this.velocities[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * magnitude;
      this.baseColors[index * 3] = tint.r;
      this.baseColors[index * 3 + 1] = tint.g;
      this.baseColors[index * 3 + 2] = tint.b;
      this.colors[index * 3] = tint.r;
      this.colors[index * 3 + 1] = tint.g;
      this.colors[index * 3 + 2] = tint.b;
      this.life[index] = life * (0.6 + Math.random() * 0.7);
      this.maxLife[index] = this.life[index];
    }
  }

  slash(position: THREE.Vector3, angle: number, color: THREE.ColorRepresentation, range = 2.4): void {
    // Ring arc centred on local +Z so the parent's Y rotation points it along
    // the attacker's facing.
    const geometry = new THREE.RingGeometry(range * 0.36, range, 22, 1, -Math.PI / 2 - 0.7, 1.4);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.position.copy(position).add(new THREE.Vector3(0, 1.15, 0));
    pivot.rotation.y = angle;
    pivot.add(mesh);
    this.scene.add(pivot);
    this.transient.push({
      object: pivot,
      material,
      life: 0.24,
      maxLife: 0.24,
      grow: 1.6,
      spin: 0,
      geometry,
    });
  }

  ring(
    position: THREE.Vector3,
    color: THREE.ColorRepresentation,
    maxScale = 6,
    thickness = 0.28,
    life = 0.55,
  ): void {
    const geometry = new THREE.RingGeometry(0.82, 0.82 + thickness, 40);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y = Math.max(0.08, position.y);
    this.scene.add(mesh);
    this.transient.push({
      object: mesh,
      material,
      life,
      maxLife: life,
      grow: maxScale,
      spin: 0,
      geometry,
    });
  }

  beam(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation): void {
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    if (length < 0.01) return;
    const geometry = new THREE.CylinderGeometry(0.11, 0.05, length, 7, 1, true);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(from).add(direction.clone().multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    this.scene.add(mesh);
    this.transient.push({
      object: mesh,
      material,
      life: 0.28,
      maxLife: 0.28,
      grow: 0,
      spin: 0,
      geometry,
    });
    this.burst(to, color, 26, 9, 0.8);
  }

  update(dt: number, gravity = 9): void {
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -999;
        this.colors[i * 3] = 0;
        this.colors[i * 3 + 1] = 0;
        this.colors[i * 3 + 2] = 0;
        continue;
      }
      this.velocities[i * 3 + 1] -= gravity * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      if (this.positions[i * 3 + 1] < 0.05) {
        this.positions[i * 3 + 1] = 0.05;
        this.velocities[i * 3 + 1] *= -0.28;
        this.velocities[i * 3] *= 0.7;
        this.velocities[i * 3 + 2] *= 0.7;
      }
      const fade = Math.max(0, this.life[i] / this.maxLife[i]);
      this.colors[i * 3] = this.baseColors[i * 3] * fade;
      this.colors[i * 3 + 1] = this.baseColors[i * 3 + 1] * fade;
      this.colors[i * 3 + 2] = this.baseColors[i * 3 + 2] * fade;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    for (let i = this.transient.length - 1; i >= 0; i -= 1) {
      const fx = this.transient[i];
      fx.life -= dt;
      const p = Math.max(0, 1 - fx.life / fx.maxLife);
      if (fx.grow > 0) {
        const scale = 1 + p * (fx.grow - 1);
        fx.object.scale.set(scale, 1, scale);
      }
      fx.material.opacity = Math.max(0, 0.9 * (1 - p));
      if (fx.spin) fx.object.rotation.z += fx.spin * dt;
      if (fx.life <= 0) {
        this.scene.remove(fx.object);
        fx.material.dispose();
        fx.geometry?.dispose();
        this.transient.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      this.life[i] = 0;
      this.positions[i * 3 + 1] = -999;
      this.colors[i * 3] = 0;
      this.colors[i * 3 + 1] = 0;
      this.colors[i * 3 + 2] = 0;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    for (const fx of this.transient) {
      this.scene.remove(fx.object);
      fx.material.dispose();
      fx.geometry?.dispose();
    }
    this.transient = [];
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.points);
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
