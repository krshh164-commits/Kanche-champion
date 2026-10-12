const PROGRESS_KEY = 'kanche-progress';

export interface SavedProgress {
  completedLevels: Record<string, number>;
  highestUnlockedLevel: number;
}

export function loadProgress(): SavedProgress {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') as Partial<SavedProgress>;
    return {
      completedLevels: parsed.completedLevels ?? {},
      highestUnlockedLevel: Number.isInteger(parsed.highestUnlockedLevel) ? parsed.highestUnlockedLevel! : 1,
    };
  } catch {
    return { completedLevels: {}, highestUnlockedLevel: 1 };
  }
}

export function saveLevelCompletion(levelId: number, stars: 1 | 2 | 3, nextLevelId?: number): void {
  const progress = loadProgress();
  const key = String(levelId);
  progress.completedLevels[key] = Math.max(progress.completedLevels[key] ?? 0, stars);
  progress.highestUnlockedLevel = Math.max(progress.highestUnlockedLevel, nextLevelId ?? levelId);
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}
