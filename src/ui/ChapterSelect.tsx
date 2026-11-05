import { CHAPTERS } from '../game/chapters';
import type { Progress } from '../game/progress';

type ChapterSelectProps = {
  progress: Progress;
  onPlay: (chapterId: number) => void;
  onBack: () => void;
};

export default function ChapterSelect({ progress, onPlay, onBack }: ChapterSelectProps) {
  return (
    <div className="screen chapters-screen">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">{'\u25C8'}</span>
          <div className="brand__text">
            <strong>Ramayana</strong>
            <small>Legend of the Dharma</small>
          </div>
        </div>
        <nav className="topbar__nav">
          <button type="button" onClick={onBack}>
            Back to menu
          </button>
        </nav>
      </header>

      <main className="chapters-main">
        <div className="section-heading">
          <p className="eyebrow">The path of the kshatriya</p>
          <h2>Choose your chapter</h2>
          <p>
            Each chapter carries its own arena, enemy composition and commander. Progress is stored on this
            device.
          </p>
        </div>

        <div className="chapter-grid">
          {CHAPTERS.map((chapter) => {
            const unlocked = chapter.id <= progress.unlocked;
            const done = progress.completed.includes(chapter.id);
            const best = progress.best[String(chapter.id)];
            return (
              <article
                key={chapter.id}
                className={`chapter-card${unlocked ? '' : ' is-locked'}`}
                style={{ ['--accent' as string]: chapter.accent }}
              >
                <div className="chapter-card__art">
                  <span className="chapter-card__numeral">{chapter.numeral}</span>
                  <span className="chapter-card__location">{chapter.location}</span>
                </div>
                <div className="chapter-card__body">
                  <h3>{chapter.title}</h3>
                  <p className="chapter-card__subtitle">{chapter.subtitle}</p>
                  <p className="chapter-card__objective">{chapter.objective}</p>
                  <div className="chapter-card__meta">
                    <span>{chapter.stages.length} encounters</span>
                    {done ? <span className="tag tag--done">Cleared</span> : null}
                    {best ? <span className="tag">{best.toLocaleString()} pts</span> : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={!unlocked}
                    onClick={() => onPlay(chapter.id)}
                  >
                    {unlocked ? (done ? 'Replay chapter' : 'Enter chapter') : 'Sealed'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="chapters-hint">
          Locked chapters open as you finish the previous one. Hanuman answers Rama&rsquo;s call from Chapter
          II onward.
        </p>
      </main>
    </div>
  );
}
