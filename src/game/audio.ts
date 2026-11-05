import type { EnvKind } from './chapters';

export type SfxName =
  | 'swing'
  | 'heavy'
  | 'hit'
  | 'block'
  | 'parry'
  | 'bow'
  | 'arrowHit'
  | 'astra'
  | 'brahma'
  | 'summon'
  | 'roar'
  | 'death'
  | 'victory'
  | 'ui'
  | 'hurt';

const MOOD_ROOT: Record<string, number> = {
  menu: 110,
  forest: 116.54,
  canyon: 98,
  ocean: 87.31,
  lanka: 73.42,
};

/**
 * Fully procedural audio: the prototype ships no external audio files, so the
 * ambience and every combat sound are synthesised with the Web Audio API.
 * This keeps the initial client bundle tiny (the PRD's <150 MB streaming budget
 * has nothing to stream) and needs no CDN credentials. Swapping in recorded
 * voice-overs and OST later means replacing the `play`/`setMood` internals only.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private droneNodes: AudioNode[] = [];
  private droneGains: GainNode[] = [];
  private chimeTimer: number | null = null;
  private volume = 0.75;
  private mood: EnvKind | 'menu' = 'menu';

  get ready(): boolean {
    return this.ctx !== null;
  }

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.volume * 0.9;
    master.connect(ctx.destination);

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.85;
    sfxBus.connect(master);

    const musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    musicBus.connect(master);

    this.master = master;
    this.sfxBus = sfxBus;
    this.musicBus = musicBus;
    this.noise = this.makeNoise(ctx, 2);
    this.setMood(this.mood);
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume * 0.9, this.ctx.currentTime, 0.05);
    }
  }

  setMood(mood: EnvKind | 'menu'): void {
    this.mood = mood;
    if (!this.ctx || !this.musicBus) return;
    this.stopDrone();
    const ctx = this.ctx;
    const bus = this.musicBus;
    const root = MOOD_ROOT[mood] ?? 110;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood === 'lanka' ? 420 : mood === 'ocean' ? 620 : 520;
    filter.Q.value = 0.8;
    filter.connect(bus);

    const tones: { freq: number; gain: number; type: OscillatorType }[] = [
      { freq: root, gain: 0.16, type: 'sine' },
      { freq: root * 1.5, gain: 0.09, type: 'sine' },
      { freq: root * 0.5, gain: 0.12, type: 'triangle' },
    ];
    for (const t of tones) {
      const osc = ctx.createOscillator();
      osc.type = t.type;
      osc.frequency.value = t.freq;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(t.gain, ctx.currentTime, 1.6);
      osc.connect(gain).connect(filter);
      osc.start();
      this.droneNodes.push(osc);
      this.droneGains.push(gain);
    }

    // Slow breathing of the drone so it never feels like a flat test tone.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = mood === 'lanka' ? 180 : 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    this.droneNodes.push(lfo);

    // Wind / surf bed.
    if (this.noise) {
      const wind = ctx.createBufferSource();
      wind.buffer = this.noise;
      wind.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = mood === 'ocean' ? 460 : 320;
      band.Q.value = 0.6;
      const windGain = ctx.createGain();
      windGain.gain.value = 0.05;
      wind.connect(band).connect(windGain).connect(bus);
      wind.start();
      this.droneNodes.push(wind);
      this.droneGains.push(windGain);
    }

    if (this.chimeTimer) window.clearInterval(this.chimeTimer);
    const scale = mood === 'lanka' ? [1, 1.2, 1.5, 1.8] : [1, 1.125, 1.333, 1.5, 2];
    this.chimeTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const step = scale[Math.floor(Math.random() * scale.length)];
      this.chime(root * 4 * step, 0.035);
    }, 7000);
  }

  stopDrone(): void {
    for (const gain of this.droneGains) {
      try {
        gain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.2);
      } catch {
        /* ignore */
      }
    }
    for (const node of this.droneNodes) {
      try {
        (node as OscillatorNode & AudioBufferSourceNode).stop(this.ctx ? this.ctx.currentTime + 0.4 : 0);
      } catch {
        /* ignore */
      }
    }
    this.droneNodes = [];
    this.droneGains = [];
    if (this.chimeTimer) {
      window.clearInterval(this.chimeTimer);
      this.chimeTimer = null;
    }
  }

  dispose(): void {
    this.stopDrone();
    try {
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (name) {
      case 'swing': {
        this.noiseSweep(t, 1600, 380, 0.2, 0.16, 900);
        break;
      }
      case 'heavy': {
        this.noiseSweep(t, 900, 180, 0.38, 0.24, 500);
        this.tone(t, 120, 55, 0.32, 0.16, 'sine');
        break;
      }
      case 'hit': {
        this.tone(t, 180, 60, 0.18, 0.28, 'triangle');
        this.noiseSweep(t, 2200, 500, 0.12, 0.14, 1400);
        break;
      }
      case 'arrowHit': {
        this.tone(t, 420, 160, 0.1, 0.16, 'sine');
        this.noiseSweep(t, 2600, 900, 0.08, 0.1, 1800);
        break;
      }
      case 'block': {
        this.tone(t, 260, 200, 0.14, 0.2, 'square');
        this.noiseSweep(t, 900, 300, 0.12, 0.12, 700);
        break;
      }
      case 'parry': {
        this.tone(t, 1400, 1400, 0.22, 0.12, 'sine');
        this.tone(t + 0.03, 2100, 1800, 0.2, 0.08, 'sine');
        break;
      }
      case 'bow': {
        this.noiseSweep(t, 2400, 700, 0.18, 0.12, 1500);
        this.tone(t, 300, 180, 0.14, 0.1, 'triangle');
        break;
      }
      case 'astra': {
        this.noiseSweep(t, 300, 2400, 0.7, 0.22, 900);
        this.tone(t, 90, 220, 0.75, 0.18, 'sawtooth');
        this.tone(t + 0.06, 180, 440, 0.6, 0.1, 'triangle');
        break;
      }
      case 'brahma': {
        this.noiseSweep(t, 200, 3200, 0.9, 0.2, 1200);
        this.tone(t, 60, 30, 0.9, 0.3, 'sine');
        this.tone(t + 0.08, 880, 1760, 0.5, 0.1, 'sine');
        break;
      }
      case 'summon': {
        this.tone(t, 140, 420, 0.5, 0.2, 'triangle');
        this.tone(t + 0.1, 210, 630, 0.4, 0.12, 'sine');
        break;
      }
      case 'roar': {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(95, t);
        osc.frequency.linearRampToValueAtTime(60, t + 0.8);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 13;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 16;
        lfo.connect(lfoGain).connect(osc.frequency);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.32, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        osc.connect(filter).connect(gain).connect(bus);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + 1.15);
        lfo.stop(t + 1.15);
        this.noiseSweep(t, 700, 180, 0.8, 0.1, 300);
        break;
      }
      case 'death': {
        this.tone(t, 320, 70, 1.1, 0.2, 'triangle');
        this.noiseSweep(t, 600, 120, 1.0, 0.1, 400);
        break;
      }
      case 'hurt': {
        this.tone(t, 240, 90, 0.24, 0.22, 'sawtooth');
        break;
      }
      case 'victory': {
        const notes = [261.63, 329.63, 392, 523.25];
        notes.forEach((f, i) => this.tone(t + i * 0.16, f, f, 1.6, 0.1, 'sine'));
        break;
      }
      case 'ui': {
        this.tone(t, 660, 880, 0.08, 0.07, 'sine');
        break;
      }
      default:
        break;
    }
  }

  private chime(freq: number, gain: number): void {
    if (!this.ctx || !this.musicBus) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    osc.connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 3.3);
  }

  private tone(
    t: number,
    f0: number,
    f1: number,
    duration: number,
    gainValue: number,
    type: OscillatorType,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainValue, t + Math.min(0.03, duration / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noiseSweep(
    t: number,
    f0: number,
    f1: number,
    duration: number,
    gainValue: number,
    q: number,
  ): void {
    if (!this.ctx || !this.sfxBus || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = Math.max(0.3, q / 600);
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainValue, t + Math.min(0.04, duration / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  private makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }
}
