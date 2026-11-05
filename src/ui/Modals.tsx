import type { GameSettings, Quality } from '../game/types';
import { OVERLAY_HOTKEY } from '../game/platform';

const CONTROLS = [
  ['WASD', 'Move Rama through the arena'],
  ['Mouse', 'Orbit the camera — click the arena to capture the pointer'],
  ['Arrow keys', 'Orbit the camera without pointer lock'],
  ['Left click', 'Light attack; chains into a finisher'],
  ['Right click', 'Heavy attack; breaks guard and staggers commanders'],
  ['Shift / Space', 'Hold to guard. Press as a blow lands to parry'],
  ['Hold Q + left click', 'Draw Kodanda and loose a seeking arrow'],
  ['1', 'Agneyastra — fire wave in a forward cone'],
  ['2', 'Brahmastra — execution beam on the nearest commander'],
  ['3', "Hanuman's Aid — summons Hanuman after Chapter II"],
  ['Esc / P', 'Pause the battle'],
  [OVERLAY_HOTKEY.key.replace('+', ' + '), 'Overwolf overlay toggle (native hotkey)'],
];

type ModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ControlsModal({ open, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Controls">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel">
        <header>
          <p className="eyebrow">The kshatriya&rsquo;s discipline</p>
          <h2>Controls</h2>
        </header>
        <div className="controls-table">
          {CONTROLS.map(([key, label]) => (
            <div key={key}>
              <kbd>{key}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <footer>
          <button type="button" className="btn btn--primary btn--small" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

type SettingsProps = ModalProps & {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onResetProgress: () => void;
};

const QUALITIES: Quality[] = ['low', 'medium', 'high'];

export function SettingsModal({ open, onClose, settings, onChange, onResetProgress }: SettingsProps) {
  if (!open) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel">
        <header>
          <p className="eyebrow">Tune the experience</p>
          <h2>Settings</h2>
        </header>

        <label className="field">
          <span>
            Master volume <em>{Math.round(settings.volume * 100)}%</em>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(event) => onChange({ ...settings, volume: Number(event.target.value) })}
          />
        </label>

        <label className="field">
          <span>
            Camera sensitivity <em>{settings.sensitivity.toFixed(2)}×</em>
          </span>
          <input
            type="range"
            min={0.4}
            max={2}
            step={0.1}
            value={settings.sensitivity}
            onChange={(event) => onChange({ ...settings, sensitivity: Number(event.target.value) })}
          />
        </label>

        <div className="field">
          <span>Render quality</span>
          <div className="segmented">
            {QUALITIES.map((quality) => (
              <button
                key={quality}
                type="button"
                className={settings.quality === quality ? 'is-active' : ''}
                onClick={() => onChange({ ...settings, quality })}
              >
                {quality}
              </button>
            ))}
          </div>
        </div>

        <footer className="modal__footer">
          <button type="button" className="btn btn--quiet btn--small" onClick={onResetProgress}>
            Reset chapter progress
          </button>
          <button type="button" className="btn btn--primary btn--small" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
