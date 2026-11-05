export type Quality = 'low' | 'medium' | 'high';

export type GameSettings = {
  volume: number;
  sensitivity: number;
  quality: Quality;
};

export type HudAstra = {
  id: string;
  key: string;
  name: string;
  short: string;
  cd: number;
  cdMax: number;
  locked: boolean;
};

export type BossHud = {
  name: string;
  hp: number;
  maxHp: number;
  phase: number;
  phases: number;
};

export type HudState = {
  chapterId: number;
  numeral: string;
  title: string;
  subtitle: string;
  location: string;
  objective: string;
  hp: number;
  maxHp: number;
  astras: HudAstra[];
  combo: number;
  score: number;
  time: number;
  stageLabel: string;
  stageIndex: number;
  stageCount: number;
  enemiesLeft: number;
  boss: BossHud | null;
  bridge: { hp: number; maxHp: number } | null;
  aiming: boolean;
  blocking: boolean;
  hanumanUnlocked: boolean;
};

export type DeathReason = 'hp' | 'bridge';

export type GameEvent =
  | { type: 'pause'; paused: boolean }
  | { type: 'dead'; chapterId: number; reason: DeathReason; score: number }
  | { type: 'victory'; chapterId: number; score: number; time: number; kills: number }
  | { type: 'announce'; text: string; sub?: string; tone?: 'wave' | 'boss' | 'phase' | 'warn' }
  | { type: 'taunt'; speaker: string; line: string };

export type GameCallbacks = {
  onHud: (hud: HudState) => void;
  onEvent: (event: GameEvent) => void;
};
