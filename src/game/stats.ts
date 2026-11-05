import type { EnemyKind } from './chapters';

export type EnemyStats = {
  name: string;
  hp: number;
  speed: number;
  damage: number;
  range: number;
  windup: number;
  cooldown: number;
  score: number;
  boss: boolean;
  ranged: boolean;
  phases: number;
};

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  asura: {
    name: 'Asura',
    hp: 58,
    speed: 3.15,
    damage: 9,
    range: 2.1,
    windup: 0.45,
    cooldown: 1.55,
    score: 100,
    boss: false,
    ranged: false,
    phases: 1,
  },
  brute: {
    name: 'Rakshasa Brute',
    hp: 155,
    speed: 2.25,
    damage: 18,
    range: 2.9,
    windup: 0.8,
    cooldown: 2.35,
    score: 250,
    boss: false,
    ranged: false,
    phases: 1,
  },
  vanara: {
    name: 'Vanara Warrior',
    hp: 95,
    speed: 3.7,
    damage: 12,
    range: 2.2,
    windup: 0.42,
    cooldown: 1.35,
    score: 160,
    boss: false,
    ranged: false,
    phases: 1,
  },
  rakshasa: {
    name: 'Rakshasa Archer',
    hp: 85,
    speed: 2.7,
    damage: 12,
    range: 11,
    windup: 0.68,
    cooldown: 2.1,
    score: 180,
    boss: false,
    ranged: true,
    phases: 1,
  },
  dushana: {
    name: 'Dushana',
    hp: 560,
    speed: 2.75,
    damage: 21,
    range: 3.4,
    windup: 0.65,
    cooldown: 1.9,
    score: 900,
    boss: true,
    ranged: false,
    phases: 2,
  },
  vali: {
    name: 'Vali',
    hp: 880,
    speed: 4.15,
    damage: 24,
    range: 3.1,
    windup: 0.5,
    cooldown: 1.45,
    score: 1200,
    boss: true,
    ranged: false,
    phases: 2,
  },
  kumbhakarna: {
    name: 'Kumbhakarna',
    hp: 1220,
    speed: 1.95,
    damage: 32,
    range: 4.3,
    windup: 0.95,
    cooldown: 2.3,
    score: 1500,
    boss: true,
    ranged: false,
    phases: 2,
  },
  indrajit: {
    name: 'Indrajit',
    hp: 1020,
    speed: 3.1,
    damage: 26,
    range: 3.2,
    windup: 0.58,
    cooldown: 1.7,
    score: 1500,
    boss: true,
    ranged: true,
    phases: 2,
  },
  ravana: {
    name: 'Ravana',
    hp: 1760,
    speed: 3.25,
    damage: 30,
    range: 3.8,
    windup: 0.7,
    cooldown: 1.5,
    score: 2600,
    boss: true,
    ranged: false,
    phases: 3,
  },
};
