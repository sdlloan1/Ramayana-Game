import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { getChapter } from './game/chapters';
import {
  completeChapter,
  isHanumanUnlocked,
  loadProgress,
  resetProgress,
  saveProgress,
  type Progress,
} from './game/progress';
import { logError, registerOverlayHotkey, unregisterOverlayHotkey } from './game/platform';
import type { DeathReason, GameEvent, GameSettings, HudState } from './game/types';
import MainMenu from './ui/MainMenu';
import ChapterSelect from './ui/ChapterSelect';
import Hud from './ui/Hud';
import { Announce, ChapterComplete, Cinematic, GameOver, OverlayHidden, PauseMenu, Taunt, TouchNotice } from './ui/Overlays';
import { ControlsModal, SettingsModal } from './ui/Modals';

type Screen = 'menu' | 'chapters' | 'game';
type Overlay = 'none' | 'cinematic' | 'paused' | 'dead' | 'victory';

type Announcement = { text: string; sub?: string; tone?: 'wave' | 'boss' | 'phase' | 'warn' };
type TauntLine = { speaker: string; line: string };
type DeathInfo = { reason: DeathReason; score: number };
type VictoryInfo = { score: number; time: number; kills: number };

const SETTINGS_KEY = 'ramayana.settings.v1';
const DEFAULT_SETTINGS: GameSettings = { volume: 0.7, sensitivity: 1, quality: 'high' };

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULT_SETTINGS.volume,
      sensitivity:
        typeof parsed.sensitivity === 'number'
          ? Math.min(2, Math.max(0.4, parsed.sensitivity))
          : DEFAULT_SETTINGS.sensitivity,
      quality:
        parsed.quality === 'low' || parsed.quality === 'medium' || parsed.quality === 'high'
          ? parsed.quality
          : DEFAULT_SETTINGS.quality,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const announceTimer = useRef<number | null>(null);
  const tauntTimer = useRef<number | null>(null);

  const [screen, setScreen] = useState<Screen>('menu');
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [chapterId, setChapterId] = useState(1);
  const [hud, setHud] = useState<HudState | null>(null);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [taunt, setTaunt] = useState<TauntLine | null>(null);
  const [deathInfo, setDeathInfo] = useState<DeathInfo | null>(null);
  const [victoryInfo, setVictoryInfo] = useState<VictoryInfo | null>(null);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [touchDevice, setTouchDevice] = useState(false);

  const flashAnnouncement = useCallback((next: Announcement) => {
    setAnnouncement(next);
    if (announceTimer.current) window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncement(null), 3600);
  }, []);

  const flashTaunt = useCallback((next: TauntLine) => {
    setTaunt(next);
    if (tauntTimer.current) window.clearTimeout(tauntTimer.current);
    tauntTimer.current = window.setTimeout(() => setTaunt(null), 6200);
  }, []);

  const handleEvent = useCallback(
    (event: GameEvent) => {
      if (event.type === 'pause') {
        setOverlay(event.paused ? 'paused' : 'none');
        return;
      }
      if (event.type === 'dead') {
        setDeathInfo({ reason: event.reason, score: event.score });
        setOverlay('dead');
        return;
      }
      if (event.type === 'victory') {
        setVictoryInfo({ score: event.score, time: event.time, kills: event.kills });
        setOverlay('victory');
        setProgress((previous) => {
          const next = completeChapter(previous, event.chapterId, event.score);
          saveProgress(next);
          return next;
        });
        return;
      }
      if (event.type === 'announce') {
        flashAnnouncement({ text: event.text, sub: event.sub, tone: event.tone });
        return;
      }
      if (event.type === 'taunt') {
        flashTaunt({ speaker: event.speaker, line: event.line });
      }
    },
    [flashAnnouncement, flashTaunt],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let game: Game | null = null;
    try {
      game = new Game(canvas, { onHud: setHud, onEvent: handleEvent });
      gameRef.current = game;
    } catch (error) {
      logError('Unable to start the WebGL renderer', error);
      flashAnnouncement({ text: 'WebGL unavailable', sub: 'Enable hardware acceleration', tone: 'warn' });
    }

    return () => {
      game?.dispose();
      gameRef.current = null;
    };
  }, [handleEvent, flashAnnouncement]);

  useEffect(() => {
    gameRef.current?.setHanumanUnlocked(isHanumanUnlocked(progress));
  }, [progress]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* settings stay in memory */
    }
    gameRef.current?.applySettings(settings);
  }, [settings]);

  useEffect(() => {
    setTouchDevice(window.matchMedia('(pointer: coarse)').matches);
    const onError = (event: ErrorEvent) => logError(event.message, event.filename);
    window.addEventListener('error', onError);
    return () => window.removeEventListener('error', onError);
  }, []);

  useEffect(() => {
    const toggle = () => setOverlayHidden((value) => !value);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && (event.key === 'Tab' || event.code === 'Tab')) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const native = registerOverlayHotkey(toggle);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (native) unregisterOverlayHotkey();
    };
  }, []);

  useEffect(
    () => () => {
      if (announceTimer.current) window.clearTimeout(announceTimer.current);
      if (tauntTimer.current) window.clearTimeout(tauntTimer.current);
    },
    [],
  );

  const startChapter = useCallback((id: number) => {
    const game = gameRef.current;
    if (!game) return;
    game.audio.init();
    setChapterId(id);
    setScreen('game');
    setOverlay('cinematic');
    setHud(null);
    setDeathInfo(null);
    setVictoryInfo(null);
    setAnnouncement(null);
    setTaunt(null);
    setOverlayHidden(false);
    game.startChapter(id);
  }, []);

  const beginBattle = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.audio.init();
    game.beginBattle();
    setOverlay('none');
  }, []);

  const goToMenu = useCallback(() => {
    gameRef.current?.attract();
    setScreen('menu');
    setOverlay('none');
    setHud(null);
    setAnnouncement(null);
    setTaunt(null);
  }, []);

  const goToChapters = useCallback(() => {
    gameRef.current?.attract();
    setScreen('chapters');
    setOverlay('none');
    setHud(null);
    setAnnouncement(null);
    setTaunt(null);
  }, []);

  const retryChapter = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.retry();
    setOverlay('cinematic');
    setDeathInfo(null);
    setVictoryInfo(null);
    setHud(null);
  }, []);

  const resume = useCallback(() => {
    gameRef.current?.setPaused(false);
    setOverlay('none');
  }, []);

  const pause = useCallback(() => {
    gameRef.current?.setPaused(true);
  }, []);

  const abandon = useCallback(() => {
    gameRef.current?.attract();
    setScreen('menu');
    setOverlay('none');
    setHud(null);
    setAnnouncement(null);
    setTaunt(null);
  }, []);

  // Dev-only QA bridge so chapter arenas can be inspected without replaying the
  // whole campaign. Stripped from production builds by Vite's DEV flag.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const holder = window as unknown as { __ramayana?: Record<string, unknown> };
    const api = (holder.__ramayana ??= {});
    api.state = () => gameRef.current?.debugState();
    api.game = gameRef.current;
    api.startChapter = startChapter;
    api.beginBattle = beginBattle;
    api.attract = goToMenu;
  }, [startChapter, beginBattle, goToMenu]);

  const chapter = getChapter(chapterId);
  const nextChapter = chapterId < 4 ? chapterId + 1 : null;
  const hudVisible = screen === 'game' && overlay === 'none' && hud !== null && !overlayHidden;

  return (
    <div className={`app${overlayHidden ? ' app--overlay-hidden' : ''}${screen === 'game' ? ' app--in-game' : ''}`}>
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="scene-vignette" aria-hidden="true" />

      {screen === 'menu' ? (
        <MainMenu
          progress={progress}
          onStart={startChapter}
          onChapters={goToChapters}
          onControls={() => setControlsOpen(true)}
          onSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      {screen === 'chapters' ? (
        <ChapterSelect progress={progress} onPlay={startChapter} onBack={goToMenu} />
      ) : null}

      {screen === 'game' && !overlayHidden ? (
        <>
          {hudVisible && hud ? <Hud hud={hud} onPause={pause} /> : null}

          {overlay === 'cinematic' ? (
            <Cinematic chapter={chapter} onBegin={beginBattle} />
          ) : null}

          {overlay === 'none' && announcement ? (
            <Announce text={announcement.text} sub={announcement.sub} tone={announcement.tone} />
          ) : null}

          {overlay === 'none' && taunt ? <Taunt speaker={taunt.speaker} line={taunt.line} /> : null}

          {overlay === 'paused' ? (
            <PauseMenu
              hud={hud}
              onResume={resume}
              onRestart={retryChapter}
              onAbandon={abandon}
              onSettings={() => setSettingsOpen(true)}
            />
          ) : null}

          {overlay === 'dead' && deathInfo ? (
            <GameOver
              chapter={chapter}
              reason={deathInfo.reason}
              score={deathInfo.score}
              onRetry={retryChapter}
              onMenu={goToChapters}
            />
          ) : null}

          {overlay === 'victory' && victoryInfo ? (
            <ChapterComplete
              chapter={chapter}
              score={victoryInfo.score}
              time={victoryInfo.time}
              kills={victoryInfo.kills}
              nextChapter={nextChapter}
              onNext={() => nextChapter && startChapter(nextChapter)}
              onReplay={() => startChapter(chapterId)}
              onChapters={goToChapters}
            />
          ) : null}
        </>
      ) : null}

      {overlayHidden ? <OverlayHidden /> : null}

      {screen === 'menu' && touchDevice ? <TouchNotice /> : null}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={setSettings}
        onResetProgress={() => {
          if (window.confirm('Reset all chapter progress on this device?')) {
            setProgress(resetProgress());
          }
        }}
      />

      <ControlsModal open={controlsOpen} onClose={() => setControlsOpen(false)} />
    </div>
  );
}
