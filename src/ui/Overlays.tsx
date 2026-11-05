import { useEffect, useState } from 'react';
import type { Chapter } from '../game/chapters';
import type { DeathReason, HudState } from '../game/types';
import AdSlot from './AdSlot';

const CONTROLS = [
  ['WASD', 'Move'],
  ['Mouse', 'Orbit camera (click to capture)'],
  ['Left click', 'Light attack — chain three'],
  ['Right click', 'Heavy attack'],
  ['Shift / Space', 'Guard — time it for a parry'],
  ['Hold Q', 'Draw Kodanda, click to loose'],
  ['1 · 2 · 3', 'Agneyastra · Brahmastra · Hanuman'],
  ['Esc / P', 'Pause'],
];

type CinematicProps = {
  chapter: Chapter;
  onBegin: () => void;
};

export function Cinematic({ chapter, onBegin }: CinematicProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const line = chapter.intro[Math.min(lineIndex, chapter.intro.length - 1)];
  const last = lineIndex >= chapter.intro.length - 1;

  useEffect(() => {
    setLineIndex(0);
  }, [chapter.id]);

  useEffect(() => {
    if (last) return;
    const timer = window.setTimeout(() => setLineIndex((index) => Math.min(chapter.intro.length - 1, index + 1)), 5200);
    return () => window.clearTimeout(timer);
  }, [lineIndex, last, chapter.intro.length]);

  return (
    <div className="cinematic" aria-live="polite">
      <div className="cinematic__letterbox cinematic__letterbox--top" />
      <div className="cinematic__content">
        <p className="cinematic__chapter">
          Chapter {chapter.numeral} <span>·</span> {chapter.location}
        </p>
        <h2 className="cinematic__title">{chapter.title}</h2>
        <p className="cinematic__subtitle">{chapter.subtitle}</p>

        <div className="cinematic__dialogue" key={lineIndex}>
          <span className="cinematic__speaker">{line.speaker}</span>
          <p>{line.line}</p>
        </div>

        <div className="cinematic__dots" aria-hidden="true">
          {chapter.intro.map((_, index) => (
            <span key={index} className={index <= lineIndex ? 'is-on' : ''} />
          ))}
        </div>

        <div className="cinematic__objective">
          <span>Objective</span>
          {chapter.objective}
        </div>

        <div className="cinematic__actions">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => setLineIndex((index) => Math.min(chapter.intro.length - 1, index + 1))}
            disabled={last}
          >
            Next line
          </button>
          <button type="button" className="btn btn--primary" onClick={onBegin}>
            Begin the battle
          </button>
        </div>
        <button type="button" className="cinematic__skip" onClick={onBegin}>
          Skip cinematic
        </button>
      </div>
      <div className="cinematic__letterbox cinematic__letterbox--bottom" />
    </div>
  );
}

type PauseProps = {
  hud: HudState | null;
  onResume: () => void;
  onRestart: () => void;
  onAbandon: () => void;
  onSettings: () => void;
};

export function PauseMenu({ hud, onResume, onRestart, onAbandon, onSettings }: PauseProps) {
  return (
    <div className="overlay overlay--pause">
      <div className="panel panel--pause">
        <p className="eyebrow">The battle holds its breath</p>
        <h2>Paused</h2>
        {hud ? (
          <div className="pause-stats">
            <span>
              <em>Chapter</em> {hud.numeral} · {hud.title}
            </span>
            <span>
              <em>Encounter</em> {hud.stageLabel}
            </span>
            <span>
              <em>Score</em> {hud.score.toLocaleString()}
            </span>
          </div>
        ) : null}
        <div className="pause-controls">
          {CONTROLS.map(([key, label]) => (
            <div key={key}>
              <kbd>{key}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="panel__actions">
          <button type="button" className="btn btn--primary" onClick={onResume}>
            Resume
          </button>
          <button type="button" className="btn btn--ghost" onClick={onSettings}>
            Settings
          </button>
          <button type="button" className="btn btn--ghost" onClick={onRestart}>
            Restart chapter
          </button>
          <button type="button" className="btn btn--quiet" onClick={onAbandon}>
            Abandon to menu
          </button>
        </div>
      </div>
    </div>
  );
}

type DeathProps = {
  chapter: Chapter;
  reason: DeathReason;
  score: number;
  onRetry: () => void;
  onMenu: () => void;
};

export function GameOver({ chapter, reason, score, onRetry, onMenu }: DeathProps) {
  return (
    <div className="overlay overlay--death">
      <div className="panel panel--death">
        <p className="eyebrow">Chapter {chapter.numeral} · {chapter.title}</p>
        <h2 className="panel__title-serif">Dharma unfulfilled</h2>
        <p className="panel__lede">
          {reason === 'bridge'
            ? 'The Setu broke beneath the tide. Without the bridge, Lanka cannot be reached — and the vanaras cannot follow.'
            : 'Rama has fallen. The forest keeps its silence, and the bow lies still in the ash.'}
        </p>
        <div className="result-stats">
          <div>
            <span>Score</span>
            <strong>{score.toLocaleString()}</strong>
          </div>
          <div>
            <span>Chapter</span>
            <strong>{chapter.numeral}</strong>
          </div>
        </div>
        <div className="panel__actions">
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            Rise again
          </button>
          <button type="button" className="btn btn--ghost" onClick={onMenu}>
            Chapter select
          </button>
        </div>
        <AdSlot label="Game over — 728×90 banner" />
      </div>
    </div>
  );
}

type VictoryProps = {
  chapter: Chapter;
  score: number;
  time: number;
  kills: number;
  nextChapter: number | null;
  onNext: () => void;
  onReplay: () => void;
  onChapters: () => void;
};

export function ChapterComplete({ chapter, score, time, kills, nextChapter, onNext, onReplay, onChapters }: VictoryProps) {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return (
    <div className="overlay overlay--victory">
      <div className="panel panel--victory">
        <p className="eyebrow">Chapter {chapter.numeral} complete</p>
        <h2 className="panel__title-serif">{chapter.title}</h2>
        <p className="panel__lede">{chapter.outro[0]?.line}</p>

        <div className="outro-lines">
          {chapter.outro.slice(1).map((entry, index) => (
            <p key={index}>
              <span>{entry.speaker}</span>
              {entry.line}
            </p>
          ))}
        </div>

        <div className="result-stats result-stats--four">
          <div>
            <span>Score</span>
            <strong>{score.toLocaleString()}</strong>
          </div>
          <div>
            <span>Time</span>
            <strong>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </strong>
          </div>
          <div>
            <span>Felled</span>
            <strong>{kills}</strong>
          </div>
          <div>
            <span>Dharma</span>
            <strong>Kept</strong>
          </div>
        </div>

        <div className="panel__actions">
          {nextChapter ? (
            <button type="button" className="btn btn--primary" onClick={onNext}>
              Continue to Chapter {nextChapter}
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={onChapters}>
              Return to the Yatra
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onReplay}>
            Replay chapter
          </button>
          <button type="button" className="btn btn--quiet" onClick={onChapters}>
            Chapter select
          </button>
        </div>
      </div>
    </div>
  );
}

type AnnounceProps = {
  text: string;
  sub?: string;
  tone?: 'wave' | 'boss' | 'phase' | 'warn';
};

export function Announce({ text, sub, tone = 'wave' }: AnnounceProps) {
  return (
    <div className={`announce announce--${tone}`} key={`${text}-${sub ?? ''}`}>
      <span className="announce__rule" />
      <strong>{text}</strong>
      {sub ? <small>{sub}</small> : null}
      <span className="announce__rule" />
    </div>
  );
}

export function Taunt({ speaker, line }: { speaker: string; line: string }) {
  return (
    <div className="taunt" key={line}>
      <span>{speaker}</span>
      <p>{line}</p>
    </div>
  );
}

export function OverlayHidden() {
  return (
    <div className="overlay-hidden">
      <div>
        <span className="overlay-hidden__mark">{'\u25C8'}</span>
        <p>Overlay hidden</p>
        <small>Press Ctrl + Tab to return to the battle</small>
      </div>
    </div>
  );
}

export function TouchNotice() {
  return (
    <div className="touch-notice">
      <strong>Desktop controls required</strong>
      <span>This prototype is built for keyboard and mouse — connect a desktop browser to play.</span>
    </div>
  );
}
