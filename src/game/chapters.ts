export type EnemyKind =
  | 'asura'
  | 'brute'
  | 'vanara'
  | 'rakshasa'
  | 'dushana'
  | 'vali'
  | 'kumbhakarna'
  | 'indrajit'
  | 'ravana';

export type EnvKind = 'forest' | 'canyon' | 'ocean' | 'lanka';

export type Stage =
  | { type: 'wave'; label: string; enemies: { kind: EnemyKind; count: number }[] }
  | { type: 'boss'; label: string; boss: EnemyKind; taunt?: { speaker: string; line: string } };

export type CinematicLine = { speaker: string; line: string };

export type Chapter = {
  id: number;
  numeral: string;
  title: string;
  subtitle: string;
  location: string;
  env: EnvKind;
  objective: string;
  accent: string;
  intro: CinematicLine[];
  outro: CinematicLine[];
  stages: Stage[];
  defense?: { label: string; hp: number };
};

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    numeral: 'I',
    title: 'The Exile',
    subtitle: 'The Forest of Dandaka',
    location: 'Dandaka',
    env: 'forest',
    accent: '#6fcf97',
    objective: "Protect the sages' yagna. Break the Asura ambush.",
    intro: [
      {
        speaker: 'NARRATOR',
        line: 'Fourteen years of exile. The forest of Dandaka remembers every oath spoken beneath its canopy.',
      },
      {
        speaker: 'SITA',
        line: 'The sages have kindled their fires, my lord. Yet the shadows between the trees move against the wind.',
      },
      {
        speaker: 'LAKSHMANA',
        line: 'Asuras, brother. They come to break the sages\u2019 yagnas — and they come armed.',
      },
      {
        speaker: 'RAMA',
        line: 'Then let the forest witness dharma. Not with wrath, but with resolve.',
      },
    ],
    outro: [
      {
        speaker: 'NARRATOR',
        line: 'The Asuras broke. But the sky grew cold, and a chariot of black iron descended.',
      },
      { speaker: 'SITA', line: 'Rama — the deer... it was never a deer.' },
      { speaker: 'RAVANA', line: 'A kshatriya who lives in a hut. How far the Raghu line has fallen.' },
      { speaker: 'RAMA', line: 'Sita!' },
    ],
    stages: [
      { type: 'wave', label: 'Asura Scouts', enemies: [{ kind: 'asura', count: 3 }] },
      {
        type: 'wave',
        label: 'Rakshasa Raiders',
        enemies: [
          { kind: 'asura', count: 4 },
          { kind: 'brute', count: 1 },
        ],
      },
      {
        type: 'wave',
        label: 'The Dandaka Horde',
        enemies: [
          { kind: 'asura', count: 4 },
          { kind: 'brute', count: 2 },
        ],
      },
      {
        type: 'boss',
        label: 'Dushana',
        boss: 'dushana',
        taunt: { speaker: 'DUSHANA', line: 'Sages bleat prayers. I answer with iron.' },
      },
    ],
  },
  {
    id: 2,
    numeral: 'II',
    title: 'The Alliance',
    subtitle: 'Kishkindha',
    location: 'Kishkindha',
    env: 'canyon',
    accent: '#e0a45e',
    objective: 'Defeat Vali and forge the alliance with Sugriva.',
    intro: [
      {
        speaker: 'NARRATOR',
        line: 'Southward, the mountains of Kishkindha hold a kingdom split by a brother\u2019s quarrel.',
      },
      {
        speaker: 'HANUMAN',
        line: 'Rama of Ayodhya. Sugriva has need of your bow — and Vali has need of humility.',
      },
      {
        speaker: 'RAMA',
        line: 'I do not raise my bow for thrones. I raise it for a friend who was wronged.',
      },
      {
        speaker: 'SUGRIVA',
        line: 'Vali took my kingdom and my wife. End his tyranny, and my vanaras will search every shore of the world.',
      },
    ],
    outro: [
      {
        speaker: 'NARRATOR',
        line: 'Vali fell, and with his last breath he named Sugriva heir. The mountain kingdom knelt.',
      },
      {
        speaker: 'HANUMAN',
        line: 'My lord, I am yours — my strength, my speed, my life. Call, and I shall answer.',
      },
    ],
    stages: [
      {
        type: 'wave',
        label: "Vali's Vanara Guard",
        enemies: [{ kind: 'vanara', count: 4 }],
      },
      {
        type: 'wave',
        label: 'Mountain Ambush',
        enemies: [
          { kind: 'vanara', count: 3 },
          { kind: 'brute', count: 2 },
        ],
      },
      {
        type: 'boss',
        label: 'Vali',
        boss: 'vali',
        taunt: { speaker: 'VALI', line: 'Brotherhood is a story the weak tell. Here is the truth of strength.' },
      },
    ],
  },
  {
    id: 3,
    numeral: 'III',
    title: 'The Ocean Bridge',
    subtitle: 'Setu',
    location: 'Setu',
    env: 'ocean',
    accent: '#5fb6d9',
    objective: 'Hold the shore. Do not let the bridge fall.',
    intro: [
      {
        speaker: 'NARRATOR',
        line: 'A hundred yojanas of salt water. Rocks carried by monkeys. A bridge that must not fall.',
      },
      {
        speaker: 'HANUMAN',
        line: 'The vanaras are building, my lord. But Ravana\u2019s navy comes with the tide.',
      },
      {
        speaker: 'RAMA',
        line: 'Then the sea will learn what devotion builds. Hold the line — the bridge is our dharma.',
      },
    ],
    outro: [
      {
        speaker: 'NARRATOR',
        line: 'Stone by stone, the impossible became a road. Lanka\u2019s golden walls rose from the mist.',
      },
      {
        speaker: 'RAMA',
        line: 'One bridge. One purpose. Dharma does not negotiate with fear.',
      },
    ],
    defense: { label: 'Setu Integrity', hp: 160 },
    stages: [
      {
        type: 'wave',
        label: 'The First Tide',
        enemies: [{ kind: 'asura', count: 4 }],
      },
      {
        type: 'wave',
        label: "Ravana's Marines",
        enemies: [
          { kind: 'rakshasa', count: 2 },
          { kind: 'asura', count: 3 },
        ],
      },
      {
        type: 'wave',
        label: 'The Iron Fleet',
        enemies: [
          { kind: 'brute', count: 2 },
          { kind: 'rakshasa', count: 2 },
          { kind: 'asura', count: 3 },
        ],
      },
      {
        type: 'wave',
        label: "Admiral's Vanguard",
        enemies: [
          { kind: 'brute', count: 3 },
          { kind: 'rakshasa', count: 2 },
        ],
      },
    ],
  },
  {
    id: 4,
    numeral: 'IV',
    title: 'The War for Lanka',
    subtitle: 'The Golden Citadel',
    location: 'Lanka',
    env: 'lanka',
    accent: '#e2683c',
    objective: 'Defeat the three commanders of Lanka and end the war.',
    intro: [
      {
        speaker: 'NARRATOR',
        line: 'Lanka burned at the edges, but its heart was iron.',
      },
      {
        speaker: 'RAMA',
        line: 'Whatever waits behind those gates, it will not be met with hatred. Only with the bow that dharma gives me.',
      },
    ],
    outro: [
      {
        speaker: 'NARRATOR',
        line: 'The war ended where it began: with a bow, a promise, and a name spoken in prayer.',
      },
      { speaker: 'RAMA', line: 'The dharma is not in victory. It is in what we refuse to become.' },
      { speaker: 'NARRATOR', line: 'The legend of the Dharma is written — and the Ramayana endures.' },
    ],
    stages: [
      {
        type: 'boss',
        label: 'Kumbhakarna',
        boss: 'kumbhakarna',
        taunt: {
          speaker: 'KUMBHAKARNA',
          line: 'I sleep, and the world forgets me. Wake me, prince, and learn why the devas did not.',
        },
      },
      {
        type: 'boss',
        label: 'Indrajit',
        boss: 'indrajit',
        taunt: { speaker: 'INDRAJIT', line: 'You cannot see me, Rama. You cannot see the arrow that ends you.' },
      },
      {
        type: 'boss',
        label: 'Ravana',
        boss: 'ravana',
        taunt: {
          speaker: 'RAVANA',
          line: 'Ten heads, ten minds, ten thousand years of study — and still you stand before me with a single bow.',
        },
      },
    ],
  },
];

export const getChapter = (id: number): Chapter =>
  CHAPTERS.find((chapter) => chapter.id === id) ?? CHAPTERS[0];
