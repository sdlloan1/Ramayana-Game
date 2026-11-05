import type { HudState } from '../game/types';

type HudProps = {
  hud: HudState;
  onPause: () => void;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function Hud({ hud, onPause }: HudProps) {
  const hpPercent = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const low = hpPercent <= 30;
  const comboVisible = hud.combo >= 2;

  return (
    <div className="hud">
      <div className="hud__top-left">
        <div className="chapter-chip">
          <span className="chapter-chip__numeral">Chapter {hud.numeral}</span>
          <span className="chapter-chip__title">{hud.title}</span>
          <span className="chapter-chip__location">{hud.subtitle}</span>
        </div>

        <div className={`health-panel${low ? ' is-low' : ''}`}>
          <div className="health-panel__head">
            <span className="health-panel__name">Rama</span>
            <span className="health-panel__values">
              {hud.hp} / {hud.maxHp}
            </span>
          </div>
          <div className="bar bar--health">
            <div className="bar__fill" style={{ width: `${hpPercent}%` }} />
          </div>
          <div className="health-panel__guards">
            <span className={hud.blocking ? 'is-on' : ''}>Guard</span>
            <span className={hud.aiming ? 'is-on' : ''}>Kodanda</span>
          </div>
        </div>
      </div>

      <div className="hud__top-right">
        <div className="objective-panel">
          <span className="objective-panel__label">Objective</span>
          <p>{hud.objective}</p>
          <div className="objective-panel__meta">
            <span>
              {hud.stageLabel} · {hud.stageIndex + 1}/{hud.stageCount}
            </span>
            <span>{hud.enemiesLeft} hostile</span>
          </div>
        </div>
        <div className="run-stats">
          <span>
            <em>Score</em> {hud.score.toLocaleString()}
          </span>
          <span>
            <em>Time</em> {formatTime(hud.time)}
          </span>
          <button type="button" className="icon-button" onClick={onPause} aria-label="Pause">
            {'\u23F8'}
          </button>
        </div>
      </div>

      {hud.boss ? (
        <div className="boss-bar">
          <div className="boss-bar__head">
            <span className="boss-bar__name">{hud.boss.name}</span>
            <span className="boss-bar__phase">
              {hud.boss.phases > 1 ? `Phase ${hud.boss.phase} / ${hud.boss.phases}` : 'Commander'}
            </span>
          </div>
          <div className="bar bar--boss">
            <div
              className="bar__fill"
              style={{ width: `${Math.max(0, Math.min(100, (hud.boss.hp / hud.boss.maxHp) * 100))}%` }}
            />
          </div>
          <div className="boss-bar__pips">
            {Array.from({ length: hud.boss.phases }).map((_, index) => (
              <span key={index} className={index + 1 <= hud.boss!.phase ? 'is-on' : ''} />
            ))}
          </div>
        </div>
      ) : null}

      {hud.bridge ? (
        <div className={`defence-panel${hud.bridge.hp / hud.bridge.maxHp < 0.4 ? ' is-low' : ''}`}>
          <span className="defence-panel__label">Setu integrity</span>
          <div className="bar bar--defence">
            <div
              className="bar__fill"
              style={{ width: `${Math.max(0, Math.min(100, (hud.bridge.hp / hud.bridge.maxHp) * 100))}%` }}
            />
          </div>
          <span className="defence-panel__value">
            {hud.bridge.hp} / {hud.bridge.maxHp}
          </span>
        </div>
      ) : null}

      {comboVisible ? (
        <div className="combo-counter" key={hud.combo}>
          <strong>{hud.combo}</strong>
          <span>hit chain</span>
        </div>
      ) : null}

      {hud.aiming ? (
        <div className="crosshair" aria-hidden="true">
          <span />
          <span />
        </div>
      ) : null}

      <div className="hud__bottom-left">
        <div className="astra-rack">
          {hud.astras.map((astra) => {
            const ready = astra.cd <= 0 && !astra.locked;
            const progress = astra.cdMax > 0 ? astra.cd / astra.cdMax : 0;
            return (
              <div
                key={astra.id}
                className={`astra${ready ? ' is-ready' : ''}${astra.locked ? ' is-locked' : ''}`}
              >
                <div className="astra__key">{astra.key}</div>
                <div className="astra__body">
                  <span className="astra__name">{astra.name}</span>
                  <span className="astra__state">
                    {astra.locked ? 'Locked' : astra.cd > 0 ? `${astra.cd.toFixed(1)}s` : 'Ready'}
                  </span>
                </div>
                {astra.cd > 0 ? <div className="astra__cd" style={{ height: `${progress * 100}%` }} /> : null}
              </div>
            );
          })}
        </div>
        <p className="hint-line">
          <span>WASD</span> move <span>LMB</span> strike <span>RMB</span> heavy <span>Shift</span> guard{' '}
          <span>Q</span> aim <span>1–3</span> astras
        </p>
      </div>

      <button type="button" className="pause-corner" onClick={onPause} aria-label="Pause game">
        {'\u23F8'}
      </button>
    </div>
  );
}
