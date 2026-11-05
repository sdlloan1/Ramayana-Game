import { CHAPTERS } from '../game/chapters';
import type { Progress } from '../game/progress';
import AdSlot from './AdSlot';

type MainMenuProps = {
  progress: Progress;
  onStart: (chapterId: number) => void;
  onChapters: () => void;
  onControls: () => void;
  onSettings: () => void;
};

export default function MainMenu({ progress, onStart, onChapters, onControls, onSettings }: MainMenuProps) {
  const continueId = Math.min(4, progress.unlocked);

  return (
    <div className="screen menu-screen">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">{'\u25C8'}</span>
          <div className="brand__text">
            <strong>Ramayana</strong>
            <small>Legend of the Dharma</small>
          </div>
        </div>
        <nav className="topbar__nav">
          <button type="button" onClick={onChapters}>
            Chapters
          </button>
          <button type="button" onClick={onControls}>
            Controls
          </button>
          <button type="button" onClick={onSettings}>
            Settings
          </button>
        </nav>
      </header>

      <main className="menu-hero">
        <section className="menu-hero__copy">
          <p className="eyebrow">A cinematic action RPG · Nitro by Overwolf</p>
          <h1 className="game-title">
            <span>Ramayana</span>
            <em>Legend of the Dharma</em>
          </h1>
          <p className="lede">
            The forest of Dandaka burns with dark ash. Take up the bow of a kshatriya, hold the line at
            Setu, and face the ten heads of Lanka — a third-person action RPG told across four chapters.
          </p>
          <div className="cta-row">
            <button type="button" className="btn btn--primary" onClick={() => onStart(continueId)}>
              {progress.completed.length > 0 ? 'Continue the journey' : 'Begin the journey'}
              <span aria-hidden="true">{'\u2192'}</span>
            </button>
            <button type="button" className="btn btn--ghost" onClick={onChapters}>
              Chapter select
            </button>
          </div>
          <ul className="feature-row">
            <li>
              <span>04</span> Chapters
            </li>
            <li>
              <span>03</span> Divya Astras
            </li>
            <li>
              <span>05</span> Boss duels
            </li>
            <li>
              <span>60</span> FPS target
            </li>
          </ul>
        </section>

        <aside className="menu-aside">
          <div className="aside-heading">
            <span>The Yatra</span>
            <small>{progress.completed.length}/4 complete</small>
          </div>
          <ol className="chapter-list">
            {CHAPTERS.map((chapter) => {
              const unlocked = chapter.id <= progress.unlocked;
              const done = progress.completed.includes(chapter.id);
              const best = progress.best[String(chapter.id)];
              return (
                <li key={chapter.id}>
                  <button
                    type="button"
                    className={`chapter-row${done ? ' is-done' : ''}${unlocked ? '' : ' is-locked'}`}
                    onClick={() => unlocked && onStart(chapter.id)}
                    disabled={!unlocked}
                  >
                    <span className="chapter-row__numeral">{chapter.numeral}</span>
                    <span className="chapter-row__body">
                      <strong>{chapter.title}</strong>
                      <small>{chapter.subtitle}</small>
                    </span>
                    <span className="chapter-row__state">
                      {done ? 'Cleared' : unlocked ? (best ? best.toLocaleString() : 'Enter') : 'Sealed'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <AdSlot label="Main menu — 970×250 leaderboard" />
          <p className="aside-note">
            Original score and ambience are synthesised in-engine. Full English voice-over and CDN audio
            streaming land with the production Unity/PlayCanvas build.
          </p>
        </aside>
      </main>

      <footer className="menu-footer">
        <span>WebGL 2.0 prototype</span>
        <span>Overwolf overlay hooks</span>
        <span>Keyboard + mouse</span>
        <span className="menu-footer__build">Build 0.1 · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
