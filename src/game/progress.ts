export type Progress = {
  unlocked: number;
  completed: number[];
  best: Record<string, number>;
};

const KEY = 'ramayana.progress.v1';

const DEFAULT_PROGRESS: Progress = { unlocked: 1, completed: [], best: {} };

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      unlocked: Math.min(4, Math.max(1, Number(parsed.unlocked) || 1)),
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter((n) => typeof n === 'number') : [],
      best: parsed.best && typeof parsed.best === 'object' ? parsed.best : {},
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable — progress simply stays in memory */
  }
}

export function completeChapter(progress: Progress, chapterId: number, score: number): Progress {
  const completed = progress.completed.includes(chapterId)
    ? progress.completed
    : [...progress.completed, chapterId];
  const best = { ...progress.best };
  const key = String(chapterId);
  if (!best[key] || score > best[key]) best[key] = score;
  return {
    unlocked: Math.min(4, Math.max(progress.unlocked, chapterId + 1)),
    completed,
    best,
  };
}

export function isHanumanUnlocked(progress: Progress): boolean {
  return progress.completed.includes(2) || progress.unlocked > 2;
}

export function resetProgress(): Progress {
  const fresh = { ...DEFAULT_PROGRESS, completed: [] as number[], best: {} as Record<string, number> };
  saveProgress(fresh);
  return fresh;
}
