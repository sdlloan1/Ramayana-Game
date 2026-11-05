import * as THREE from 'three';
import { getChapter, type Chapter, type Stage } from './chapters';
import { buildWorld, type World } from './world';
import { animateIdle, applyFlash, createActor, disposeRig, type Rig } from './actors';
import { Effects } from './effects';
import { AudioEngine } from './audio';
import { ENEMY_STATS, type EnemyStats } from './stats';
import type { GameCallbacks, GameSettings, HudAstra, HudState, DeathReason } from './types';
import type { EnemyKind } from './chapters';

type Mode = 'attract' | 'cinematic' | 'playing' | 'paused' | 'dead' | 'victory';

type Attack = {
  type: 'light' | 'heavy';
  t: number;
  dur: number;
  windup: number;
  struck: boolean;
  chain: number;
};

type Hero = {
  rig: Rig;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  lunge: THREE.Vector3;
  facing: number;
  hp: number;
  maxHp: number;
  invuln: number;
  parryTimer: number;
  blocking: boolean;
  aiming: boolean;
  attack: Attack | null;
  chainTimer: number;
  bowCd: number;
  bowDraw: number;
  comboTimer: number;
  combo: number;
  noDamageTimer: number;
};

type EnemyState = 'spawn' | 'chase' | 'windup' | 'recover' | 'stagger' | 'dead';

type Enemy = {
  id: number;
  kind: EnemyKind;
  stats: EnemyStats;
  rig: Rig;
  pos: THREE.Vector3;
  facing: number;
  hp: number;
  maxHp: number;
  state: EnemyState;
  t: number;
  attackCd: number;
  specialCd: number;
  phase: number;
  flash: number;
  dead: boolean;
  deathT: number;
  hasSummoned: boolean;
  burn: number;
  burnTick: number;
};

type Projectile = {
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  damage: number;
  friendly: boolean;
  radius: number;
  target: Enemy | null;
};

type Hazard = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  pos: THREE.Vector3;
  radius: number;
  t: number;
  delay: number;
  damage: number;
  fired: boolean;
};

type Summon = {
  rig: Rig;
  t: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  struck: boolean;
  target: Enemy | null;
};

const PLAYER_MAX_HP = 120;
const LIGHT_DAMAGE = [17, 17, 28];
const HEAVY_DAMAGE = 44;
const ARROW_DAMAGE = 27;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const angleDelta = (a: number, b: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const lerpAngle = (a: number, b: number, t: number) => a + angleDelta(a, b) * t;

export class Game {
  readonly audio = new AudioEngine();

  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: GameCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly stageRoot = new THREE.Group();
  private readonly fxRoot = new THREE.Group();
  private readonly effects: Effects;
  private readonly clock = new THREE.Clock();

  private settings: GameSettings = { volume: 0.75, sensitivity: 1, quality: 'high' };
  private hanumanUnlocked = false;

  private mode: Mode = 'attract';
  private world: World | null = null;
  private chapter: Chapter | null = null;
  private hero: Hero | null = null;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private hazards: Hazard[] = [];
  private summon: Summon | null = null;
  private enemyId = 0;

  private camYaw = 0;
  private camPitch = 0.2;
  private camDist = 7.4;
  private shake = 0;
  private hitStop = 0;
  private time = 0;
  private battleTime = 0;
  private hudClock = 0;

  private stageIndex = 0;
  private stageLabel = '';
  private pendingStage = -1;
  private score = 0;
  private kills = 0;
  private bridgeHp = 0;
  private bridgeWarned = 0;
  private defence: { label: string; hp: number } | null = null;
  private astras: HudAstra[] = [];
  private chainStep = 0;
  private keys = new Set<string>();
  private disposed = false;
  private announcedHanuman = false;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 420);
    this.camera.position.set(0, 6, 18);

    this.scene.add(this.stageRoot, this.fxRoot);
    this.effects = new Effects(this.fxRoot);

    this.bindEvents();
    this.applyQuality('high');

    this.time = 0;
    this.attract();
    this.renderer.setAnimationLoop(this.tick);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  attract(): void {
    this.clearStage();
    this.mode = 'attract';
    this.chapter = null;
    this.scene.fog = null;
    const world = buildWorld('forest');
    this.world = world;
    this.scene.fog = new THREE.FogExp2(world.fog.color, world.fog.density * 1.1);
    this.stageRoot.add(world.group);

    const rig = createActor('rama');
    rig.root.position.set(0, 0, 0);
    rig.root.rotation.y = Math.PI;
    this.stageRoot.add(rig.root);
    const hero: Hero = this.freshHero(rig);
    this.hero = hero;

    this.camYaw = 0;
    this.camPitch = 0.16;
    this.camDist = 7.4;
    this.audio.setMood('menu');
    this.emitHud();
  }

  startChapter(chapterId: number): void {
    const chapter = getChapter(chapterId);
    this.clearStage();
    this.chapter = chapter;
    this.mode = 'cinematic';
    this.stageIndex = 0;
    this.stageLabel = chapter.stages[0]?.label ?? '';
    this.pendingStage = -1;
    this.score = 0;
    this.kills = 0;
    this.battleTime = 0;
    this.chainStep = 0;
    this.enemies = [];
    this.projectiles = [];
    this.hazards = [];
    this.summon = null;
    this.bridgeWarned = 0;

    const world = buildWorld(chapter.env);
    this.world = world;
    this.scene.fog = new THREE.FogExp2(world.fog.color, world.fog.density);
    this.stageRoot.add(world.group);

    const rig = createActor('rama');
    rig.root.position.set(0, 0, 2);
    rig.root.rotation.y = Math.PI;
    this.stageRoot.add(rig.root);
    this.hero = this.freshHero(rig);

    this.defence = chapter.defense ? { ...chapter.defense } : null;
    this.bridgeHp = chapter.defense?.hp ?? 0;

    this.astras = [
      { id: 'agni', key: '1', name: 'Agneyastra', short: 'Agni', cd: 0, cdMax: 14, locked: false },
      { id: 'brahma', key: '2', name: 'Brahmastra', short: 'Brahma', cd: 0, cdMax: 26, locked: false },
      {
        id: 'hanuman',
        key: '3',
        name: 'Hanuman\u2019s Aid',
        short: 'Hanuman',
        cd: 0,
        cdMax: 40,
        locked: !this.hanumanUnlocked,
      },
    ];

    this.camYaw = 0;
    this.camPitch = 0.2;
    this.camDist = 7.4;
    this.audio.init();
    this.audio.setMood(chapter.env);
    this.emitHud();
  }

  beginBattle(): void {
    if (!this.chapter || !this.hero) return;
    this.mode = 'playing';
    this.hero.pos.set(0, 0, 6);
    this.hero.facing = Math.PI;
    this.hero.rig.root.position.copy(this.hero.pos);
    this.hero.rig.root.rotation.y = this.hero.facing;
    this.camYaw = 0;
    this.spawnStage(0, true);
    this.emitHud();
  }

  togglePause(): void {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      this.keys.clear();
      this.hero && (this.hero.blocking = false);
      this.callbacks.onEvent({ type: 'pause', paused: true });
      if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    } else if (this.mode === 'paused') {
      this.mode = 'playing';
      this.clock.getDelta();
      this.callbacks.onEvent({ type: 'pause', paused: false });
    }
  }

  setPaused(paused: boolean): void {
    if (paused && this.mode === 'playing') this.togglePause();
    else if (!paused && this.mode === 'paused') this.togglePause();
  }

  retry(): void {
    if (this.chapter) this.startChapter(this.chapter.id);
  }

  applySettings(settings: GameSettings): void {
    this.settings = settings;
    this.audio.setVolume(settings.volume);
    this.applyQuality(settings.quality);
  }

  setHanumanUnlocked(unlocked: boolean): void {
    this.hanumanUnlocked = unlocked;
    const slot = this.astras.find((astra) => astra.id === 'hanuman');
    if (slot) slot.locked = !unlocked;
    this.emitHud();
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.unbindEvents();
    this.clearStage();
    this.effects.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }

  debugState() {
    return {
      mode: this.mode,
      chapter: this.chapter?.id ?? null,
      stageIndex: this.stageIndex,
      stageLabel: this.stageLabel,
      score: Math.round(this.score),
      kills: this.kills,
      hp: Math.round(this.hero?.hp ?? 0),
      maxHp: this.hero?.maxHp ?? 0,
      combo: this.hero?.combo ?? 0,
      player: this.hero ? this.hero.pos.toArray().map((n) => Math.round(n * 100) / 100) : null,
      astras: this.astras.map((a) => ({ id: a.id, cd: Math.round(a.cd * 10) / 10, locked: a.locked })),
      bridge: this.defence ? { hp: Math.round(this.bridgeHp), max: this.defence.hp } : null,
      enemies: this.enemies
        .filter((e) => !e.dead)
        .map((e) => ({
          kind: e.kind,
          hp: Math.round(e.hp),
          state: e.state,
          pos: e.pos.toArray().map((n) => Math.round(n * 100) / 100),
        })),
    };
  }

  // ---------------------------------------------------------------------------
  // Setup helpers
  // ---------------------------------------------------------------------------

  private freshHero(rig: Rig): Hero {
    return {
      rig,
      pos: rig.root.position.clone(),
      vel: new THREE.Vector3(),
      lunge: new THREE.Vector3(),
      facing: rig.root.rotation.y,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      invuln: 0,
      parryTimer: 0,
      blocking: false,
      aiming: false,
      attack: null,
      chainTimer: 0,
      bowCd: 0,
      bowDraw: 0,
      comboTimer: 0,
      combo: 0,
      noDamageTimer: 0,
    };
  }

  private clearStage(): void {
    for (const enemy of this.enemies) disposeRig(enemy.rig);
    this.enemies = [];
    for (const projectile of this.projectiles) {
      projectile.mesh.removeFromParent();
      this.disposeObject(projectile.mesh);
    }
    this.projectiles = [];
    for (const hazard of this.hazards) {
      hazard.mesh.removeFromParent();
      this.disposeObject(hazard.mesh);
    }
    this.hazards = [];
    if (this.hero) {
      disposeRig(this.hero.rig);
      this.hero.rig.root.removeFromParent();
      this.hero = null;
    }
    if (this.summon) {
      disposeRig(this.summon.rig);
      this.summon.rig.root.removeFromParent();
      this.summon = null;
    }
    this.world?.dispose();
    this.world = null;
    this.effects.clear();
    this.stageRoot.clear();
    this.scene.fog = null;
    this.scene.background = null;
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose?.();
      }
    });
  }

  private applyQuality(quality: GameSettings['quality']): void {
    const dpr = window.devicePixelRatio || 1;
    const ratio = quality === 'low' ? 0.75 : quality === 'medium' ? Math.min(1, dpr) : Math.min(1.75, dpr);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = quality !== 'low';
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private unbindEvents(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const code = event.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) {
      event.preventDefault();
    }
    if (event.repeat) {
      this.keys.add(event.key.toLowerCase());
      return;
    }
    this.keys.add(event.key.toLowerCase());
    this.audio.init();

    if (code === 'KeyQ') {
      this.tryRequestPointerLock();
    }
    if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
      this.tryParry();
    }
    if (code === 'Digit1') this.castAstra('agni');
    if (code === 'Digit2') this.castAstra('brahma');
    if (code === 'Digit3') this.castAstra('hanuman');
    if (code === 'Escape' || code === 'KeyP') this.togglePause();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase());
  };

  private onBlur = (): void => {
    this.keys.clear();
    if (this.hero) {
      this.hero.blocking = false;
      this.hero.aiming = false;
    }
  };

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  };

  private onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private onMouseDown = (event: MouseEvent): void => {
    this.audio.init();
    if (this.mode !== 'playing') return;
    if (event.button === 2) {
      this.startAttack('heavy');
    } else if (event.button === 0) {
      if (this.hero?.aiming) this.fireArrow();
      else this.startAttack('light');
    }
    this.tryRequestPointerLock();
  };

  private onMouseUp = (): void => {
    /* held state is keyed off movement, not mouse buttons */
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (this.mode !== 'playing') return;
    if (document.pointerLockElement !== this.canvas) return;
    const sensitivity = this.settings.sensitivity;
    this.camYaw -= event.movementX * 0.0022 * sensitivity;
    this.camPitch = clamp(this.camPitch + event.movementY * 0.0018 * sensitivity, -0.1, 0.72);
  };

  private onPointerLockChange = (): void => {
    /* no UI dependency; input checks the element directly */
  };

  private tryRequestPointerLock(): void {
    if (document.pointerLockElement === this.canvas) return;
    try {
      const request = this.canvas.requestPointerLock?.();
      if (request && typeof (request as Promise<void>).catch === 'function') {
        (request as unknown as Promise<void>).catch(() => undefined);
      }
    } catch {
      /* pointer lock is optional — the camera also orbits with arrow keys */
    }
  }

  private tryParry(): void {
    if (this.mode !== 'playing' || !this.hero) return;
    if (this.hero.attack) return;
    this.hero.parryTimer = 0.32;
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  private tick = (): void => {
    if (this.disposed) return;
    const raw = Math.min(0.05, this.clock.getDelta());
    const slow = this.hitStop > 0 ? 0.22 : 1;
    this.hitStop = Math.max(0, this.hitStop - raw);
    const dt = raw * slow;
    this.time += raw;

    if (this.mode === 'playing') {
      this.battleTime += dt;
      this.updateHero(dt);
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updateHazards(dt);
      this.updateSummon(dt);
      this.updateStageFlow(dt);
      this.hudClock += raw;
      if (this.hudClock >= 0.1) {
        this.hudClock = 0;
        this.emitHud();
      }
    } else if (this.mode === 'cinematic') {
      this.updateCinematic(dt);
    } else if (this.mode === 'attract') {
      if (this.hero) {
        animateIdle(this.hero.rig, this.time, 0, false);
      }
    } else if (this.mode === 'victory') {
      if (this.hero) animateIdle(this.hero.rig, this.time, 0, false);
      this.effects.update(raw);
    }

    if (this.mode !== 'cinematic') {
      this.effects.update(raw);
    }

    this.world?.update(this.time, raw);
    this.updateCamera(raw);
    this.renderer.render(this.scene, this.camera);
  };

  private updateCinematic(dt: number): void {
    if (!this.hero) return;
    this.hero.rig.root.rotation.y = Math.PI;
    animateIdle(this.hero.rig, this.time, 0, false);
    this.hero.rig.torso.rotation.y = Math.sin(this.time * 0.6) * 0.05;
    this.effects.update(dt);
  }

  // ---------------------------------------------------------------------------
  // Hero
  // ---------------------------------------------------------------------------

  private updateHero(dt: number): void {
    const hero = this.hero;
    if (!hero) return;

    hero.aiming = this.keys.has('q') && !hero.attack;
    const blockHeld = this.keys.has('shift') || this.keys.has(' ');
    hero.blocking = blockHeld && !hero.attack && !hero.aiming;

    if (hero.invuln > 0) hero.invuln -= dt;
    if (hero.parryTimer > 0) hero.parryTimer -= dt;
    if (hero.chainTimer > 0) hero.chainTimer -= dt;
    if (hero.bowCd > 0) hero.bowCd -= dt;
    if (hero.bowDraw > 0) hero.bowDraw = Math.max(0, hero.bowDraw - dt);
    if (hero.comboTimer > 0) {
      hero.comboTimer -= dt;
      if (hero.comboTimer <= 0) hero.combo = 0;
    }
    hero.noDamageTimer += dt;
    if (hero.noDamageTimer > 4.5 && hero.hp > 0 && hero.hp < hero.maxHp) {
      hero.hp = Math.min(hero.maxHp, hero.hp + 2.2 * dt);
    }

    for (const astra of this.astras) {
      if (astra.cd > 0) astra.cd = Math.max(0, astra.cd - dt);
    }

    // Camera orbit via arrow keys (works without pointer lock).
    if (this.keys.has('arrowleft')) this.camYaw += 2.1 * dt;
    if (this.keys.has('arrowright')) this.camYaw -= 2.1 * dt;
    if (this.keys.has('arrowup')) this.camPitch = clamp(this.camPitch - 1.1 * dt, -0.1, 0.72);
    if (this.keys.has('arrowdown')) this.camPitch = clamp(this.camPitch + 1.1 * dt, -0.1, 0.72);

    const forward = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const wish = new THREE.Vector3();
    if (this.keys.has('w')) wish.add(forward);
    if (this.keys.has('s')) wish.sub(forward);
    if (this.keys.has('d')) wish.add(right);
    if (this.keys.has('a')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    const speed = hero.attack ? 2.1 : hero.blocking ? 2.5 : hero.aiming ? 3.1 : 6.4;
    const targetVel = wish.multiplyScalar(speed);
    hero.vel.lerp(targetVel, 1 - Math.exp(-12 * dt));
    hero.pos.addScaledVector(hero.vel, dt);
    hero.pos.addScaledVector(hero.lunge, dt);
    hero.lunge.multiplyScalar(Math.exp(-7 * dt));
    hero.pos.y = 0;

    if (hero.attack) {
      const attack = hero.attack;
      attack.t += dt;
      if (!attack.struck && attack.t >= attack.windup) {
        attack.struck = true;
        this.resolveMelee(attack);
      }
      if (attack.t >= attack.dur) {
        if (attack.type === 'light') {
          hero.chainTimer = 0.85;
        }
        hero.attack = null;
      }
    }

    // Facing: camera forward when aiming/attacking, movement direction otherwise.
    let faceTarget = hero.facing;
    if (hero.aiming || hero.attack) {
      faceTarget = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
    } else if (wish.lengthSq() > 0.01) {
      faceTarget = Math.atan2(wish.x, wish.z);
    }
    hero.facing = lerpAngle(hero.facing, faceTarget, 1 - Math.exp(-16 * dt));
    hero.rig.root.rotation.y = hero.facing;

    // World collisions + arena bounds.
    this.resolveColliders(hero.pos, 0.45);
    const bounds = (this.world?.bounds ?? 30) - 0.8;
    const radius = Math.hypot(hero.pos.x, hero.pos.z);
    if (radius > bounds) {
      hero.pos.multiplyScalar(bounds / radius);
      hero.pos.y = 0;
    }

    hero.rig.root.position.copy(hero.pos);
    animateIdle(hero.rig, this.time, hero.vel.length(), !!hero.attack);
    this.poseHero(hero);
  }

  private poseHero(hero: Hero): void {
    const rig = hero.rig;
    const attack = hero.attack;
    rig.weapon && (rig.weapon.visible = !hero.aiming);

    if (hero.aiming) {
      rig.armL.rotation.x = -1.35;
      rig.armL.rotation.z = 0.18;
      rig.armR.rotation.x = -1.15 + Math.min(0.25, hero.bowDraw * 0.9);
      rig.armR.rotation.z = -0.1;
      rig.torso.rotation.y = -0.18;
      if (rig.bow && rig.bow.parent !== rig.armL) {
        rig.armL.add(rig.bow);
        rig.bow.position.set(0, -0.72, 0.08);
        rig.bow.rotation.set(0, 0, -Math.PI / 2);
      }
      return;
    }

    if (rig.bow && rig.bow.parent !== rig.torso) {
      rig.torso.add(rig.bow);
      rig.bow.position.set(-0.06, 0.1, -0.28);
      rig.bow.rotation.set(0.1, 0.4, 0.4);
    }

    if (hero.blocking) {
      rig.armL.rotation.x = -1.15;
      rig.armL.rotation.z = 0.32;
      rig.armR.rotation.x = -1.05;
      rig.armR.rotation.z = -0.28;
      rig.torso.rotation.x = 0.06;
      return;
    }

    rig.armL.rotation.z = 0;
    rig.armR.rotation.z = 0;
    rig.torso.rotation.x = 0;

    if (attack) {
      const p = Math.min(1, attack.t / attack.dur);
      if (attack.type === 'light') {
        const swing = p < 0.34 ? p / 0.34 : 1;
        const strike = p < 0.34 ? 0 : Math.min(1, (p - 0.34) / 0.28);
        rig.armR.rotation.x = swing * 1.25 - strike * 3.3;
        rig.armR.rotation.z = -0.25 + strike * 0.4;
        rig.armL.rotation.x = swing * 0.4 - strike * 0.9;
        rig.torso.rotation.y = -strike * 0.5 + swing * 0.2;
      } else {
        const lift = Math.min(1, p / 0.45);
        const slam = p < 0.45 ? 0 : Math.min(1, (p - 0.45) / 0.25);
        rig.armR.rotation.x = lift * 2.4 - slam * 4.6;
        rig.armL.rotation.x = lift * 1.8 - slam * 3.4;
        rig.torso.rotation.x = -lift * 0.2 + slam * 0.4;
        rig.torso.rotation.y = 0;
      }
    }
  }

  private startAttack(type: 'light' | 'heavy'): void {
    const hero = this.hero;
    if (!hero) return;
    if (hero.aiming) return;
    if (hero.attack && hero.attack.t < hero.attack.dur * 0.62) return;

    const target = this.softTarget(7);
    if (target) {
      hero.facing = Math.atan2(target.pos.x - hero.pos.x, target.pos.z - hero.pos.z);
    }

    if (type === 'light') {
      this.chainStep = hero.chainTimer > 0 ? Math.min(3, this.chainStep + 1) : 1;
    } else {
      this.chainStep = 0;
    }

    hero.attack = {
      type,
      t: 0,
      dur: type === 'light' ? 0.46 : 0.92,
      windup: type === 'light' ? 0.17 : 0.42,
      struck: false,
      chain: this.chainStep || 1,
    };

    const shove = type === 'light' ? 2.4 : 1.2;
    hero.lunge.add(new THREE.Vector3(Math.sin(hero.facing), 0, Math.cos(hero.facing)).multiplyScalar(shove));
    if (type === 'heavy') this.audio.play('heavy');
  }

  private resolveMelee(attack: Attack): void {
    const hero = this.hero;
    if (!hero) return;
    const isHeavy = attack.type === 'heavy';
    const damage = isHeavy ? HEAVY_DAMAGE : LIGHT_DAMAGE[Math.min(2, attack.chain - 1)];
    const range = isHeavy ? 3.4 : 3.0;
    const arc = isHeavy ? 1.6 : 2.1;
    const forward = new THREE.Vector3(Math.sin(hero.facing), 0, Math.cos(hero.facing));

    this.effects.slash(
      hero.pos,
      hero.facing,
      isHeavy ? '#ffb066' : attack.chain === 3 ? '#ffe28a' : '#f7e7c4',
      isHeavy ? 3.1 : 2.5,
    );
    this.audio.play(isHeavy ? 'heavy' : 'swing');
    this.shake = Math.max(this.shake, isHeavy ? 0.22 : 0.12);
    if (attack.chain === 3 && !isHeavy) {
      this.effects.ring(hero.pos, '#ffd27a', 3.2, 0.16, 0.35);
    }

    let hits = 0;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.pos.x - hero.pos.x;
      const dz = enemy.pos.z - hero.pos.z;
      const distance = Math.hypot(dx, dz);
      if (distance > range + enemy.rig.radius) continue;
      const dot = (dx / (distance || 1)) * forward.x + (dz / (distance || 1)) * forward.z;
      if (dot < Math.cos(arc / 2)) continue;
      const direction = new THREE.Vector3(dx, 0, dz).normalize();
      this.hitEnemy(enemy, damage * (1 + (hero.combo > 8 ? 0.1 : 0)), direction, isHeavy ? 3.2 : 1.2, isHeavy);
      hits += 1;
    }
    if (hits > 0) this.hitStop = isHeavy ? 0.075 : 0.04;
  }

  // ---------------------------------------------------------------------------
  // Bow + astras
  // ---------------------------------------------------------------------------

  private fireArrow(): void {
    const hero = this.hero;
    if (!hero || hero.bowCd > 0 || this.mode !== 'playing') return;
    hero.bowCd = 0.4;
    hero.bowDraw = 0.25;
    hero.facing = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
    hero.rig.root.rotation.y = hero.facing;

    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    if (direction.lengthSq() < 0.01) direction.set(Math.sin(hero.facing), 0, Math.cos(hero.facing));
    direction.normalize();

    const origin = hero.pos.clone().add(new THREE.Vector3(0, 1.45, 0)).addScaledVector(direction, 0.8);
    const geometry = new THREE.CylinderGeometry(0.028, 0.028, 0.95, 6);
    const material = new THREE.MeshBasicMaterial({ color: '#ffe6a8' });
    const arrow = new THREE.Mesh(geometry, material);
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    arrow.position.copy(origin);
    this.stageRoot.add(arrow);

    this.projectiles.push({
      mesh: arrow,
      pos: origin.clone(),
      vel: direction.clone().multiplyScalar(42),
      life: 1.8,
      damage: ARROW_DAMAGE,
      friendly: true,
      radius: 0.25,
      target: this.softTarget(30, 0.55, direction),
    });

    this.audio.play('bow');
    this.shake = Math.max(this.shake, 0.05);
  }

  private castAstra(id: string): void {
    const hero = this.hero;
    if (!hero || this.mode !== 'playing') return;
    const astra = this.astras.find((slot) => slot.id === id);
    if (!astra || astra.locked) {
      if (astra?.locked) this.callbacks.onEvent({ type: 'announce', text: 'Hanuman has not yet pledged his aid', sub: 'Complete Chapter II' });
      return;
    }
    if (astra.cd > 0) return;
    if (hero.attack) return;

    if (id === 'agni') {
      astra.cd = astra.cdMax;
      const forward = new THREE.Vector3(Math.sin(hero.facing), 0, Math.cos(hero.facing));
      this.audio.play('astra');
      this.shake = Math.max(this.shake, 0.55);
      for (let i = 0; i < 7; i += 1) {
        const point = hero.pos.clone().addScaledVector(forward, 2.5 + i * 1.9);
        this.effects.burst(point, i % 2 === 0 ? '#ff8a3a' : '#ffd27a', 16, 5, 0.7);
      }
      this.effects.ring(hero.pos.clone().addScaledVector(forward, 6), '#ff7a2a', 9, 0.9, 0.8);
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        const dx = enemy.pos.x - hero.pos.x;
        const dz = enemy.pos.z - hero.pos.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 15) continue;
        const dot = (dx / (distance || 1)) * forward.x + (dz / (distance || 1)) * forward.z;
        if (dot < 0.36) continue;
        enemy.burn = 4;
        enemy.burnTick = 0.6;
        this.hitEnemy(enemy, 64, new THREE.Vector3(dx, 0, dz).normalize(), 2.4, true);
      }
    } else if (id === 'brahma') {
      const target = this.pickAstraTarget();
      if (!target) return;
      astra.cd = astra.cdMax;
      this.audio.play('brahma');
      this.shake = Math.max(this.shake, 0.8);
      const from = hero.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
      const to = target.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
      this.effects.beam(from, to, '#fff3c8');
      this.effects.ring(target.pos, '#ffe9a8', 7, 0.55, 0.75);
      this.hitEnemy(target, 210, new THREE.Vector3().subVectors(target.pos, hero.pos).setY(0).normalize(), 4, true);
      this.hitStop = 0.1;
    } else if (id === 'hanuman') {
      if (!this.hanumanUnlocked) return;
      const target = this.nearestEnemy();
      if (!target) return;
      astra.cd = astra.cdMax;
      this.audio.play('summon');
      const rig = createActor('hanuman');
      const from = hero.pos.clone().add(new THREE.Vector3(2, 0, 2));
      rig.root.position.copy(from);
      this.stageRoot.add(rig.root);
      this.summon = {
        rig,
        t: 0,
        from,
        to: target.pos.clone(),
        struck: false,
        target,
      };
      this.callbacks.onEvent({ type: 'announce', text: 'Hanuman answers the call', sub: 'Vayuputra' });
    }
    this.emitHud();
  }

  private updateSummon(dt: number): void {
    const summon = this.summon;
    if (!summon) return;
    summon.t += dt;
    const rig = summon.rig;
    if (summon.t < 0.65) {
      const p = summon.t / 0.65;
      const targetPos = summon.target && !summon.target.dead ? summon.target.pos : summon.to;
      rig.root.position.lerpVectors(summon.from, targetPos, Math.min(1, p));
      rig.root.position.y = Math.sin(p * Math.PI) * 4.5;
      rig.root.rotation.y = Math.atan2(targetPos.x - summon.from.x, targetPos.z - summon.from.z);
      rig.armR.rotation.x = -1.4;
    } else if (!summon.struck) {
      summon.struck = true;
      const impact = rig.root.position.clone();
      impact.y = 0;
      this.effects.ring(impact, '#ffe9a8', 8, 0.6, 0.7);
      this.effects.burst(impact, '#ffd27a', 40, 9, 0.9);
      this.shake = Math.max(this.shake, 0.7);
      this.audio.play('brahma');
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (enemy.pos.distanceTo(impact) < 6.5) {
          this.hitEnemy(enemy, 115, new THREE.Vector3().subVectors(enemy.pos, impact).setY(0).normalize(), 5, true);
        }
      }
    } else {
      rig.visual.position.y = Math.sin(summon.t * 12) * 0.05;
      if (summon.t > 1.5) {
        if (summon.rig.glow) {
          const material = summon.rig.glow.material as THREE.SpriteMaterial;
          material.opacity = Math.max(0, 0.3 - (summon.t - 1.5));
        }
        rig.root.position.y = Math.max(0, rig.root.position.y - dt * 3);
        if (summon.t > 2.1) {
          disposeRig(summon.rig);
          summon.rig.root.removeFromParent();
          this.summon = null;
        }
      }
    }
  }

  private pickAstraTarget(): Enemy | null {
    const boss = this.enemies.find((enemy) => !enemy.dead && enemy.stats.boss);
    if (boss) return boss;
    return this.nearestEnemy();
  }

  private nearestEnemy(maxDistance = 34): Enemy | null {
    const hero = this.hero;
    if (!hero) return null;
    let best: Enemy | null = null;
    let bestDistance = maxDistance;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const distance = enemy.pos.distanceTo(hero.pos);
      if (distance < bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }
    return best;
  }

  private softTarget(maxDistance: number, minDot = 0.35, direction?: THREE.Vector3): Enemy | null {
    const hero = this.hero;
    if (!hero) return null;
    const forward =
      direction ??
      new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)).normalize();
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.pos.x - hero.pos.x;
      const dz = enemy.pos.z - hero.pos.z;
      const distance = Math.hypot(dx, dz);
      if (distance > maxDistance) continue;
      const dot = (dx / (distance || 1)) * forward.x + (dz / (distance || 1)) * forward.z;
      if (dot < minDot) continue;
      const score = dot * 2 - distance / maxDistance;
      if (score > bestScore) {
        best = enemy;
        bestScore = score;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Enemies
  // ---------------------------------------------------------------------------

  private spawnStage(index: number, first = false): void {
    const chapter = this.chapter;
    if (!chapter) return;
    if (index >= chapter.stages.length) {
      this.win();
      return;
    }
    this.stageIndex = index;
    const stage = chapter.stages[index] as Stage;
    this.stageLabel = stage.label;

    if (stage.type === 'wave') {
      for (const group of stage.enemies) {
        for (let i = 0; i < group.count; i += 1) this.spawnEnemy(group.kind);
      }
      const count = this.enemies.filter((e) => !e.dead).length;
      this.callbacks.onEvent({
        type: 'announce',
        text: stage.label,
        sub: `${count} hostile${count === 1 ? '' : 's'} inbound`,
        tone: 'wave',
      });
    } else {
      this.spawnEnemy(stage.boss, true);
      this.callbacks.onEvent({
        type: 'announce',
        text: stage.label,
        sub: 'Commander of Lanka',
        tone: 'boss',
      });
      if (stage.taunt) {
        this.callbacks.onEvent({ type: 'taunt', speaker: stage.taunt.speaker, line: stage.taunt.line });
      }
      this.audio.play('roar');
      this.shake = Math.max(this.shake, 0.4);
    }

    if (first) this.hitStop = 0.04;
    this.emitHud();
  }

  private spawnEnemy(kind: EnemyKind, boss = false): void {
    const stats = ENEMY_STATS[kind];
    const rig = createActor(kind);
    const spawn = this.pickSpawn(boss);
    rig.root.position.copy(spawn);
    rig.root.position.y = boss ? 0 : -2.4;
    rig.root.rotation.y = Math.atan2(-spawn.x, -spawn.z);
    this.stageRoot.add(rig.root);

    const enemy: Enemy = {
      id: (this.enemyId += 1),
      kind,
      stats,
      rig,
      pos: spawn.clone(),
      facing: rig.root.rotation.y,
      hp: stats.hp,
      maxHp: stats.hp,
      state: 'spawn',
      t: 0,
      attackCd: 0.6 + Math.random() * 0.9,
      specialCd: 3.5,
      phase: 1,
      flash: 0,
      dead: false,
      deathT: 0,
      hasSummoned: false,
      burn: 0,
      burnTick: 0,
    };
    this.enemies.push(enemy);

    this.effects.ring(spawn, stats.boss ? '#ff8a4a' : '#b44a32', stats.boss ? 7 : 3, 0.4, 0.55);
    this.effects.burst(spawn.clone().setY(0.3), stats.boss ? '#ffb066' : '#a03a28', stats.boss ? 30 : 12, 4, 0.7);
    if (kind === 'kumbhakarna' || kind === 'ravana') this.shake = Math.max(this.shake, 0.35);
  }

  private pickSpawn(boss: boolean): THREE.Vector3 {
    const points = this.world?.spawnPoints ?? [new THREE.Vector3(0, 0, -16)];
    const hero = this.hero;
    let best = points[0];
    let bestDistance = -1;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = points[Math.floor(Math.random() * points.length)];
      const distance = hero ? candidate.distanceTo(hero.pos) : 0;
      if (distance > bestDistance && distance > 9) {
        best = candidate;
        bestDistance = distance;
      }
    }
    if (boss) {
      const far = points.reduce((acc, point) => {
        const d = hero ? point.distanceTo(hero.pos) : 0;
        return d > (hero ? acc.distanceTo(hero.pos) : -1) ? point : acc;
      }, points[0]);
      return far.clone();
    }
    return best.clone();
  }

  private updateEnemies(dt: number): void {
    const hero = this.hero;
    if (!hero) return;

    for (const enemy of this.enemies) {
      if (enemy.dead) {
        enemy.deathT += dt;
        enemy.rig.root.rotation.z += dt * 0.8;
        if (enemy.deathT > 0.55) {
          enemy.rig.visual.position.y -= dt * 1.4;
          enemy.rig.root.scale.multiplyScalar(Math.max(0.001, 1 - dt * 0.9));
        }
        continue;
      }

      if (enemy.flash > 0) {
        enemy.flash = Math.max(0, enemy.flash - dt * 4.5);
        applyFlash(enemy.rig, enemy.flash);
      }

      if (enemy.burn > 0) {
        enemy.burn -= dt;
        enemy.burnTick -= dt;
        if (enemy.burnTick <= 0) {
          enemy.burnTick = 0.5;
          enemy.hp -= 6;
          this.effects.burst(enemy.pos.clone().setY(1), '#ff8a3a', 5, 1.6, 0.4);
          if (enemy.hp <= 0) this.killEnemy(enemy);
        }
      }

      const stats = enemy.stats;
      const boss = stats.boss;
      const phase = 1 + Math.min(stats.phases - 1, Math.floor((1 - enemy.hp / enemy.maxHp) * stats.phases));
      if (phase > enemy.phase) {
        enemy.phase = phase;
        this.audio.play('roar');
        this.shake = Math.max(this.shake, 0.5);
        this.effects.ring(enemy.pos, '#ff8a4a', 9, 0.7, 0.9);
        this.callbacks.onEvent({
          type: 'announce',
          text: `${stats.name} — Phase ${phase === 2 ? 'II' : 'III'}`,
          sub: 'The battle deepens',
          tone: 'phase',
        });
      }

      if (enemy.state === 'spawn') {
        enemy.t += dt;
        const p = Math.min(1, enemy.t / 0.7);
        enemy.rig.root.position.y = -2.4 * (1 - p);
        if (p >= 1) {
          enemy.state = 'chase';
          enemy.rig.root.position.y = 0;
        }
        continue;
      }

      if (enemy.state === 'stagger') {
        enemy.t -= dt;
        enemy.rig.root.position.x += Math.sin(this.time * 40) * 0.005;
        if (enemy.t <= 0) enemy.state = 'chase';
        continue;
      }

      if (enemy.state === 'recover') {
        enemy.t += dt;
        if (enemy.t > 0.5) enemy.state = 'chase';
        enemy.attackCd = Math.max(0, enemy.attackCd - dt);
        this.faceEnemy(enemy, hero.pos, dt);
        enemy.rig.root.position.copy(enemy.pos);
        continue;
      }

      if (enemy.attackCd > 0) enemy.attackCd -= dt;
      if (enemy.specialCd > 0) enemy.specialCd -= dt;

      const bridge = this.world?.bridgeCore ?? null;
      const heroDistance = enemy.pos.distanceTo(hero.pos);
      const bridgeDistance = bridge ? enemy.pos.distanceTo(bridge) : Infinity;
      const defendBridge = !!(this.defence && bridge && bridgeDistance < 6.5 && heroDistance > 9);
      const targetPos = defendBridge && bridge ? bridge : hero.pos;

      if (enemy.state === 'windup') {
        enemy.t += dt;
        const p = Math.min(1, enemy.t / Math.max(0.2, stats.windup));
        enemy.rig.armR.rotation.x = 1.2 * p;
        enemy.rig.torso.rotation.y = Math.sin(p * Math.PI) * 0.3;
        if (enemy.t >= stats.windup) {
          enemy.state = 'recover';
          enemy.t = 0;
          enemy.attackCd = stats.cooldown;
          this.resolveEnemyStrike(enemy, defendBridge);
        }
        continue;
      }

      // Movement / targeting
      let move = new THREE.Vector3();
      if (defendBridge && bridge) {
        if (bridgeDistance > 3.4) {
          move.copy(bridge).sub(enemy.pos).setY(0).normalize();
        }
      } else if (stats.ranged && !boss) {
        const dx = hero.pos.x - enemy.pos.x;
        const dz = hero.pos.z - enemy.pos.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 12) move.set(dx, 0, dz).normalize();
        else if (distance < 7) move.set(-dx, 0, -dz).normalize();
        else {
          move.set(-dz, 0, dx).normalize().multiplyScalar(Math.sin(this.time + enemy.id) > 0 ? 0.5 : -0.5);
        }
      } else {
        const dx = targetPos.x - enemy.pos.x;
        const dz = targetPos.z - enemy.pos.z;
        const distance = Math.hypot(dx, dz);
        if (distance > stats.range * 0.88) {
          move.set(dx, 0, dz).normalize();
        }
      }

      const speed = stats.speed * (enemy.phase > 1 ? 1.12 : 1);
      if (move.lengthSq() > 0.001) {
        enemy.pos.addScaledVector(move, speed * dt);
      }

      const targetForFacing = defendBridge && bridge ? bridge : hero.pos;
      this.faceEnemy(enemy, targetForFacing, dt);
      enemy.rig.root.position.copy(enemy.pos);
      enemy.rig.root.rotation.y = enemy.facing;

      const facingHero =
        Math.abs(angleDelta(enemy.facing, Math.atan2(hero.pos.x - enemy.pos.x, hero.pos.z - enemy.pos.z))) < 0.8;

      if (defendBridge && bridgeDistance <= 3.6 && enemy.attackCd <= 0) {
        enemy.attackCd = stats.cooldown + 0.6;
        this.damageBridge(4 + (boss ? 8 : 0), bridge);
        enemy.rig.armR.rotation.x = -1.8;
        this.shake = Math.max(this.shake, 0.15);
        continue;
      }

      if (!defendBridge && stats.ranged && !boss) {
        if (heroDistance < 15 && enemy.attackCd <= 0 && facingHero) {
          enemy.attackCd = stats.cooldown;
          this.enemyVolley(enemy, 1);
        }
      } else if (heroDistance <= stats.range + 0.7 && enemy.attackCd <= 0 && facingHero) {
        enemy.state = 'windup';
        enemy.t = 0;
      }

      if (boss && enemy.specialCd <= 0) {
        enemy.specialCd = Math.max(2.4, 5.4 - enemy.phase * 0.9);
        this.bossAbility(enemy);
      }

      // Keep bodies apart so packs stay readable.
      for (const other of this.enemies) {
        if (other === enemy || other.dead) continue;
        const dx = enemy.pos.x - other.pos.x;
        const dz = enemy.pos.z - other.pos.z;
        const distance = Math.hypot(dx, dz);
        const minDistance = (enemy.rig.radius + other.rig.radius) * 0.9;
        if (distance > 0.001 && distance < minDistance) {
          const push = ((minDistance - distance) / minDistance) * dt * 6;
          enemy.pos.x += (dx / distance) * push;
          enemy.pos.z += (dz / distance) * push;
        }
      }

      this.resolveColliders(enemy.pos, enemy.rig.radius);
      animateIdle(enemy.rig, this.time, move.length() * speed * 2, false);
    }

    // Purge long-dead rigs.
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (enemy.dead && enemy.deathT > 1.7) {
        disposeRig(enemy.rig);
        enemy.rig.root.removeFromParent();
        this.enemies.splice(i, 1);
      }
    }
  }

  private faceEnemy(enemy: Enemy, target: THREE.Vector3, dt: number): void {
    const desired = Math.atan2(target.x - enemy.pos.x, target.z - enemy.pos.z);
    enemy.facing = lerpAngle(enemy.facing, desired, 1 - Math.exp(-10 * dt));
  }

  private resolveEnemyStrike(enemy: Enemy, defendingBridge: boolean): void {
    const hero = this.hero;
    if (!hero) return;
    if (!defendingBridge) {
      const distance = enemy.pos.distanceTo(hero.pos);
      if (distance <= enemy.stats.range + 1.2) {
        const result = this.damageHero(enemy.stats.damage, enemy.pos);
        if (result === 'parry') {
          enemy.state = 'stagger';
          enemy.t = 1.2;
        }
      }
      if (enemy.stats.boss) {
        this.effects.ring(enemy.pos, '#ff8a4a', 4.5, 0.4, 0.4);
        this.shake = Math.max(this.shake, 0.18);
      }
    }
    const color = enemy.stats.boss ? '#ff8a4a' : enemy.kind === 'vanara' ? '#e0a45e' : '#c43a2a';
    this.effects.slash(enemy.pos, enemy.facing, color, enemy.stats.boss ? 3.2 : 2.1);
    enemy.rig.armR.rotation.x = -1.8;
  }

  private bossAbility(enemy: Enemy): void {
    if (!this.hero) return;
    const hero = this.hero;
    const phase = enemy.phase;
    this.audio.play('roar');
    this.shake = Math.max(this.shake, 0.35);

    if (enemy.kind === 'vali') {
      const destination = hero.pos.clone().add(new THREE.Vector3(Math.sin(hero.facing) * -3.5, 0, Math.cos(hero.facing) * -3.5));
      enemy.pos.copy(destination);
      enemy.rig.root.position.copy(enemy.pos);
      this.spawnHazard(hero.pos, 4.2, 0.55, 22);
      this.effects.ring(enemy.pos, '#ffcc66', 7, 0.6, 0.6);
      this.effects.burst(enemy.pos, '#ffcc66', 24, 6, 0.7);
      animateIdle(enemy.rig, this.time, 0, false);
      return;
    }

    if (enemy.kind === 'kumbhakarna' || enemy.kind === 'dushana') {
      this.spawnHazard(hero.pos, enemy.kind === 'kumbhakarna' ? 6 : 4.6, 0.8, enemy.kind === 'kumbhakarna' ? 34 : 22);
      this.effects.ring(enemy.pos, '#ff8a4a', 8, 0.7, 0.7);
      if (enemy.kind === 'kumbhakarna' && !enemy.hasSummoned && enemy.hp < enemy.maxHp * 0.7) {
        enemy.hasSummoned = true;
        for (let i = 0; i < 2; i += 1) {
          const spot = enemy.pos.clone().add(new THREE.Vector3(i === 0 ? -3 : 3, 0, 2));
          const minion = this.spawnEnemyAt('asura', spot);
          this.effects.burst(spot, '#ff6a4a', 18, 4, 0.7);
          if (minion) minion.state = 'chase';
        }
        this.callbacks.onEvent({ type: 'announce', text: 'Kumbhakarna calls the horde', sub: 'Asuras rise', tone: 'phase' });
      }
      return;
    }

    if (enemy.kind === 'indrajit') {
      if (phase >= 2) {
        const behind = hero.pos.clone().add(new THREE.Vector3(Math.sin(hero.facing + Math.PI) * 6, 0, Math.cos(hero.facing + Math.PI) * 6));
        enemy.pos.copy(behind);
        enemy.rig.root.position.copy(enemy.pos);
        this.effects.burst(behind, '#9a7aff', 30, 6, 0.8);
      }
      this.enemyVolley(enemy, phase >= 2 ? 5 : 3);
      return;
    }

    if (enemy.kind === 'ravana') {
      if (phase === 1) {
        this.enemyVolley(enemy, 4);
        this.spawnHazard(hero.pos, 3.2, 0.75, 20);
      } else if (phase === 2) {
        for (let i = 0; i < 3; i += 1) {
          const spot = hero.pos.clone().add(new THREE.Vector3((i - 1) * 4, 0, (i % 2 === 0 ? 2 : -2)));
          this.spawnHazard(spot, 3.0, 1.1 + i * 0.22, 24);
        }
      } else {
        if (!enemy.hasSummoned) {
          enemy.hasSummoned = true;
          for (const offset of [-4, 4]) {
            const spot = enemy.pos.clone().add(new THREE.Vector3(offset, 0, 2));
            const minion = this.spawnEnemyAt('brute', spot);
            if (minion) minion.state = 'chase';
          }
          this.callbacks.onEvent({ type: 'announce', text: 'Ravana summons his guard', sub: 'Rakshasa Brutes', tone: 'phase' });
        }
        this.enemyVolley(enemy, 6);
        this.spawnHazard(hero.pos, 4, 0.8, 26);
      }
      return;
    }

    this.spawnHazard(hero.pos, 3.5, 0.7, 18);
  }

  private spawnEnemyAt(kind: EnemyKind, position: THREE.Vector3): Enemy | null {
    if (this.enemies.filter((enemy) => !enemy.dead).length > 10) return null;
    const stats = ENEMY_STATS[kind];
    const rig = createActor(kind);
    rig.root.position.copy(position);
    this.stageRoot.add(rig.root);
    const enemy: Enemy = {
      id: (this.enemyId += 1),
      kind,
      stats,
      rig,
      pos: position.clone(),
      facing: 0,
      hp: stats.hp,
      maxHp: stats.hp,
      state: 'spawn',
      t: 0,
      attackCd: 1,
      specialCd: 4,
      phase: 1,
      flash: 0,
      dead: false,
      deathT: 0,
      hasSummoned: false,
      burn: 0,
      burnTick: 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  private enemyVolley(enemy: Enemy, count: number): void {
    const hero = this.hero;
    if (!hero) return;
    const baseDirection = new THREE.Vector3().subVectors(hero.pos, enemy.pos).setY(0).normalize();
    const color = enemy.kind === 'indrajit' ? '#b39cff' : '#ff7a3a';
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * 0.16;
      const direction = baseDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
      const origin = enemy.pos.clone().add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(direction, 0.8);
      const geometry = new THREE.SphereGeometry(0.24, 8, 8);
      const material = new THREE.MeshBasicMaterial({ color });
      const orb = new THREE.Mesh(geometry, material);
      orb.position.copy(origin);
      this.stageRoot.add(orb);
      this.projectiles.push({
        mesh: orb,
        pos: origin.clone(),
        vel: direction.multiplyScalar(15),
        life: 3.2,
        damage: enemy.stats.damage * 0.75,
        friendly: false,
        radius: 0.28,
        target: null,
      });
    }
    this.audio.play('bow');
  }

  private spawnHazard(position: THREE.Vector3, radius: number, delay: number, damage: number): void {
    const geometry = new THREE.RingGeometry(0.92, 1, 44);
    const material = new THREE.MeshBasicMaterial({
      color: '#ff5a2a',
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y = 0.06;
    mesh.scale.setScalar(radius);
    this.stageRoot.add(mesh);
    this.hazards.push({ mesh, material, pos: position.clone(), radius, t: 0, delay, damage, fired: false });
  }

  private updateHazards(dt: number): void {
    const hero = this.hero;
    for (let i = this.hazards.length - 1; i >= 0; i -= 1) {
      const hazard = this.hazards[i];
      hazard.t += dt;
      hazard.material.opacity = 0.28 + Math.sin(hazard.t * 12) * 0.14;
      if (!hazard.fired && hazard.t >= hazard.delay) {
        hazard.fired = true;
        this.effects.burst(hazard.pos.clone().setY(0.3), '#ff7a3a', 30, 7, 0.7);
        this.effects.ring(hazard.pos, '#ff8a4a', hazard.radius * 1.6, 0.7, 0.55);
        this.shake = Math.max(this.shake, 0.4);
        this.audio.play('hit');
        if (hero && hero.pos.distanceTo(hazard.pos) <= hazard.radius) {
          this.damageHero(hazard.damage, hazard.pos, true);
        }
      }
      if (hazard.t > hazard.delay + 0.35) {
        hazard.mesh.removeFromParent();
        this.disposeObject(hazard.mesh);
        this.hazards.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Projectiles
  // ---------------------------------------------------------------------------

  private updateProjectiles(dt: number): void {
    const hero = this.hero;
    if (!hero) return;

    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      projectile.life -= dt;

      if (projectile.friendly && projectile.target && !projectile.target.dead) {
        const desired = new THREE.Vector3()
          .subVectors(projectile.target.pos.clone().setY(1.2), projectile.pos)
          .normalize()
          .multiplyScalar(42);
        projectile.vel.lerp(desired, 1 - Math.exp(-4 * dt));
      }
      projectile.pos.addScaledVector(projectile.vel, dt);
      projectile.mesh.position.copy(projectile.pos);
      if (projectile.friendly) {
        const vel = projectile.vel;
        if (vel.lengthSq() > 0.01) {
          projectile.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.clone().normalize());
        }
      }

      let remove = projectile.life <= 0 || projectile.pos.y < -1;
      if (!remove && projectile.friendly) {
        for (const enemy of this.enemies) {
          if (enemy.dead) continue;
          const dx = enemy.pos.x - projectile.pos.x;
          const dz = enemy.pos.z - projectile.pos.z;
          const distance = Math.hypot(dx, dz);
          if (distance < enemy.rig.radius + 0.5 && projectile.pos.y < enemy.rig.height + 0.4) {
            this.hitEnemy(
              enemy,
              projectile.damage,
              new THREE.Vector3(dx, 0, dz).normalize(),
              0.8,
              false,
            );
            this.audio.play('arrowHit');
            this.effects.burst(projectile.pos, '#ffe9a8', 16, 4, 0.5);
            remove = true;
            break;
          }
        }
      } else if (!remove) {
        const distance = projectile.pos.distanceTo(hero.pos.clone().setY(1.1));
        if (distance < 0.85) {
          this.damageHero(projectile.damage, projectile.pos);
          this.effects.burst(projectile.pos, '#ff7a3a', 12, 3, 0.45);
          remove = true;
        }
      }

      if (remove) {
        projectile.mesh.removeFromParent();
        this.disposeObject(projectile.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Damage
  // ---------------------------------------------------------------------------

  private hitEnemy(
    enemy: Enemy,
    damage: number,
    direction: THREE.Vector3,
    knockback: number,
    heavy: boolean,
  ): void {
    if (enemy.dead) return;
    const hero = this.hero;
    enemy.hp -= damage;
    enemy.flash = 1;
    this.score += Math.round(damage * 0.6);
    if (hero) {
      hero.combo += 1;
      hero.comboTimer = 3.6;
    }
    this.audio.play('hit');
    this.effects.burst(enemy.pos.clone().setY(1.1), enemy.stats.boss ? '#ff8a4a' : '#ffd8a0', enemy.stats.boss ? 12 : 8, 4.5, 0.5);

    if (!enemy.stats.boss || heavy || damage >= 100) {
      enemy.pos.addScaledVector(direction, knockback * (enemy.stats.boss ? 0.22 : 0.5));
      enemy.rig.root.position.copy(enemy.pos);
      if (!enemy.stats.boss) {
        enemy.state = 'stagger';
        enemy.t = 0.22;
      } else if (heavy) {
        enemy.state = 'stagger';
        enemy.t = 0.35;
      }
    }

    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Enemy): void {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.state = 'dead';
    enemy.deathT = 0;
    enemy.hp = 0;
    this.kills += 1;
    const hero = this.hero;
    this.score += enemy.stats.score + (hero ? hero.combo * 6 : 0);
    this.audio.play(enemy.stats.boss ? 'roar' : 'death');
    this.effects.burst(
      enemy.pos.clone().setY(1.2),
      enemy.stats.boss ? '#ffb066' : '#c46a3a',
      enemy.stats.boss ? 50 : 18,
      enemy.stats.boss ? 9 : 5,
      enemy.stats.boss ? 1.2 : 0.7,
    );
    if (enemy.stats.boss) {
      this.effects.ring(enemy.pos, '#ffd27a', 12, 0.9, 1.1);
      this.shake = Math.max(this.shake, 0.7);
      this.hitStop = 0.12;
    }
    this.emitHud();
  }

  private damageHero(amount: number, source: THREE.Vector3, ignoreBlock = false): 'hit' | 'block' | 'parry' {
    const hero = this.hero;
    if (!hero || this.mode !== 'playing') return 'hit';
    if (hero.invuln > 0) return 'block';

    const dx = source.x - hero.pos.x;
    const dz = source.z - hero.pos.z;
    const incoming = Math.atan2(dx, dz);
    const inFront = Math.abs(angleDelta(hero.facing, incoming)) < Math.PI * 0.68;

    let result: 'hit' | 'block' | 'parry' = 'hit';
    if (!ignoreBlock && hero.blocking && inFront) {
      if (hero.parryTimer > 0) {
        result = 'parry';
        hero.parryTimer = 0;
        hero.invuln = 0.35;
        hero.combo += 1;
        hero.comboTimer = 3.6;
        this.score += 75;
        this.audio.play('parry');
        this.effects.ring(hero.pos, '#ffe9a8', 4, 0.3, 0.4);
        this.effects.burst(hero.pos.clone().setY(1.3), '#fff3c8', 22, 6, 0.6);
        this.shake = Math.max(this.shake, 0.2);
        this.emitHud();
        return result;
      }
      result = 'block';
      amount *= 0.16;
      this.audio.play('block');
      this.effects.burst(hero.pos.clone().setY(1.3), '#9ac6ff', 10, 3, 0.4);
      this.shake = Math.max(this.shake, 0.12);
    }

    hero.hp = Math.max(0, hero.hp - amount);
    hero.noDamageTimer = 0;
    hero.invuln = 0.55;
    this.audio.play(result === 'block' ? 'block' : 'hurt');
    this.shake = Math.max(this.shake, result === 'block' ? 0.12 : 0.3);
    this.effects.burst(hero.pos.clone().setY(1.3), '#ff5a3a', 12, 3.5, 0.5);
    this.emitHud();

    if (hero.hp <= 0) this.die('hp');
    return result;
  }

  private damageBridge(amount: number, bridge: THREE.Vector3): void {
    if (!this.defence || this.mode !== 'playing') return;
    this.bridgeHp = Math.max(0, this.bridgeHp - amount);
    this.effects.burst(bridge.clone().setY(1.4), '#ffb066', 14, 4, 0.6);
    this.audio.play('block');
    if (this.bridgeHp > 0 && this.bridgeHp / this.defence.hp <= 0.35 && this.bridgeWarned < 2) {
      this.bridgeWarned = 2;
      this.callbacks.onEvent({ type: 'announce', text: 'The Setu is failing', sub: 'Defend the construction', tone: 'warn' });
    } else if (this.bridgeHp > 0 && this.bridgeHp / this.defence.hp <= 0.6 && this.bridgeWarned < 1) {
      this.bridgeWarned = 1;
      this.callbacks.onEvent({ type: 'announce', text: 'The navy presses the bridge', sub: 'Intercept them', tone: 'warn' });
    }
    this.emitHud();
    if (this.bridgeHp <= 0) this.die('bridge');
  }

  private die(reason: DeathReason): void {
    if (this.mode === 'dead') return;
    this.mode = 'dead';
    this.audio.play('death');
    this.keys.clear();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    if (this.chapter) {
      this.callbacks.onEvent({
        type: 'dead',
        chapterId: this.chapter.id,
        reason,
        score: Math.round(this.score),
      });
    }
    this.emitHud();
  }

  private win(): void {
    if (this.mode === 'victory' || !this.chapter) return;
    this.mode = 'victory';
    this.audio.play('victory');
    this.keys.clear();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    this.callbacks.onEvent({
      type: 'victory',
      chapterId: this.chapter.id,
      score: Math.round(this.score),
      time: Math.round(this.battleTime),
      kills: this.kills,
    });
    this.emitHud();
  }

  private updateStageFlow(dt: number): void {
    if (this.mode !== 'playing' || !this.chapter) return;
    const alive = this.enemies.some((enemy) => !enemy.dead);
    if (alive) return;

    if (this.pendingStage >= 0) {
      this.pendingStage -= dt;
      if (this.pendingStage <= 0) {
        const next = this.stageIndex + 1;
        this.pendingStage = -1;
        for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
          if (this.enemies[i].dead) {
            disposeRig(this.enemies[i].rig);
            this.enemies[i].rig.root.removeFromParent();
            this.enemies.splice(i, 1);
          }
        }
        if (next >= this.chapter.stages.length) this.win();
        else this.spawnStage(next);
      }
      return;
    }

    if (this.stageIndex >= this.chapter.stages.length - 1) {
      this.win();
      return;
    }

    this.pendingStage = 2.1;
    this.callbacks.onEvent({
      type: 'announce',
      text: 'Area clear',
      sub: 'Regroup, kshatriya',
      tone: 'wave',
    });
    if (this.hero) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + 18);
  }

  // ---------------------------------------------------------------------------
  // World collision + camera
  // ---------------------------------------------------------------------------

  private resolveColliders(position: THREE.Vector3, radius: number): void {
    const colliders = this.world?.colliders;
    if (!colliders) return;
    for (const collider of colliders) {
      const dx = position.x - collider.x;
      const dz = position.z - collider.z;
      const distance = Math.hypot(dx, dz);
      const minDistance = collider.radius + radius;
      if (distance > 0.0001 && distance < minDistance) {
        const push = (minDistance - distance) / distance;
        position.x += dx * push;
        position.z += dz * push;
      }
    }
  }

  private updateCamera(dt: number): void {
    const hero = this.hero;
    if (!hero) return;

    if (this.mode === 'attract' || this.mode === 'cinematic') {
      const cinematic = this.mode === 'cinematic';
      const radius = cinematic ? 17 : 22;
      const angle = this.time * (cinematic ? 0.1 : 0.045) + 0.7;
      this.camera.position.set(
        Math.sin(angle) * radius,
        (cinematic ? 4.6 : 5.4) + Math.sin(this.time * 0.25) * 0.5,
        Math.cos(angle) * radius,
      );
      this.camera.lookAt(0, cinematic ? 2.1 : 2.4, cinematic ? 2 : 0);
      this.camera.fov = 54;
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.mode === 'victory') {
      const angle = this.time * 0.18;
      const radius = 12;
      this.camera.position.set(
        hero.pos.x + Math.sin(angle) * radius,
        4.4,
        hero.pos.z + Math.cos(angle) * radius,
      );
      this.camera.lookAt(hero.pos.x, 1.6, hero.pos.z);
      this.camera.fov = 55;
      this.camera.updateProjectionMatrix();
      return;
    }

    const aiming = hero.aiming && this.mode === 'playing';
    const fovTarget = aiming ? 46 : 56;
    this.camera.fov += (fovTarget - this.camera.fov) * (1 - Math.exp(-6 * dt));
    this.camera.updateProjectionMatrix();

    const distanceTarget = aiming ? 3.4 : 7.4;
    this.camDist += (distanceTarget - this.camDist) * (1 - Math.exp(-8 * dt));
    const horizontal = Math.cos(this.camPitch) * this.camDist;
    const height = 2.0 + Math.sin(this.camPitch) * this.camDist;
    const offset = new THREE.Vector3(
      Math.sin(this.camYaw) * horizontal,
      height,
      Math.cos(this.camYaw) * horizontal,
    );
    if (aiming) {
      offset.add(new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)).multiplyScalar(0.9));
    }

    const desired = hero.pos.clone().add(offset);
    this.camera.position.lerp(desired, 1 - Math.exp(-14 * dt));

    const lookAt = hero.pos.clone().add(new THREE.Vector3(0, 1.55, 0));
    if (aiming) lookAt.addScaledVector(new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)), 6);
    this.camera.lookAt(lookAt);

    if (this.shake > 0.001) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const magnitude = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * magnitude;
      this.camera.position.y += (Math.random() - 0.5) * magnitude;
      this.camera.position.z += (Math.random() - 0.5) * magnitude;
    }
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private emitHud(): void {
    const chapter = this.chapter;
    const hero = this.hero;
    if (!chapter || !hero) return;
    const boss = this.enemies.find((enemy) => !enemy.dead && enemy.stats.boss);
    const hud: HudState = {
      chapterId: chapter.id,
      numeral: chapter.numeral,
      title: chapter.title,
      subtitle: chapter.subtitle,
      location: chapter.location,
      objective: chapter.objective,
      hp: Math.max(0, Math.round(hero.hp)),
      maxHp: hero.maxHp,
      astras: this.astras.map((astra) => ({ ...astra, cd: Math.round(astra.cd * 10) / 10 })),
      combo: hero.combo,
      score: Math.round(this.score),
      time: Math.round(this.battleTime),
      stageLabel: this.stageLabel,
      stageIndex: this.stageIndex,
      stageCount: chapter.stages.length,
      enemiesLeft: this.enemies.filter((enemy) => !enemy.dead).length,
      boss: boss
        ? {
            name: boss.stats.name,
            hp: Math.max(0, Math.round(boss.hp)),
            maxHp: boss.maxHp,
            phase: boss.phase,
            phases: boss.stats.phases,
          }
        : null,
      bridge: this.defence ? { hp: Math.max(0, Math.round(this.bridgeHp)), maxHp: this.defence.hp } : null,
      aiming: hero.aiming,
      blocking: hero.blocking,
      hanumanUnlocked: this.hanumanUnlocked,
    };
    this.callbacks.onHud(hud);
  }
}
