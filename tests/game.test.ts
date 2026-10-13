// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/game/Game';
import * as GameModule from '../src/game/Game';
import { LEVELS } from '../src/levels/levels';
import type { MarbleSnapshot } from '../src/game/rules';

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('GameModel', () => {
  it('counts a clear at removal, only once, while leaving the outcome until settlement', () => {
    const game = new GameModel();
    game.startRound({ moveLimit: 1, targetTotal: 2, shooterX: 210 });
    game.confirmPosition(); game.commitShot(); game.beginSettling();
    expect(game.recordClear('target-a')).toBe(true);
    expect(game.recordClear('target-a')).toBe(false);
    expect(game.snapshot()).toMatchObject({ cleared: 1, outcome: null, state: 'settling' });
    expect(game.recordClear('target-b')).toBe(true);
    expect(game.snapshot()).toMatchObject({ cleared: 2, outcome: null });
    expect(game.settle([])).toBe('won');
    expect(game.snapshot().cleared).toBe(2);
  });
  it('counts only active targets in each current color objective', () => {
    const bodies: MarbleSnapshot[] = [
      { id: 'teal-1', kind: 'target', x: 0, y: 0, radius: 24, speed: 0, angle: 0, angularVelocity: 0 },
      { id: 'teal-2', kind: 'target', x: 0, y: 0, radius: 24, speed: 0, angle: 0, angularVelocity: 0 },
      { id: 'blue-1', kind: 'target', x: 0, y: 0, radius: 24, speed: 0, angle: 0, angularVelocity: 0 },
      { id: 'shooter', kind: 'shooter', x: 0, y: 0, radius: 24, speed: 0, angle: 0, angularVelocity: 0 },
    ];
    const colors = new Map([['teal-1', 'teal'], ['teal-2', 'teal'], ['blue-1', 'blue']] as const);

    const getRemainingObjectives = (GameModule as typeof GameModule & { getRemainingObjectives?: Function }).getRemainingObjectives;
    expect(typeof getRemainingObjectives).toBe('function');
    if (!getRemainingObjectives) return;
    expect(getRemainingObjectives(bodies, colors, ['teal', 'blue', 'violet'])).toEqual([
      { color: 'teal', remaining: 2 },
      { color: 'blue', remaining: 1 },
    ]);
  });

  it('keeps both Level 3 colors visible at zero and clamps counts to their starting totals', () => {
    const colors = new Map([
      ...Array.from({ length: 4 }, (_, index) => [`green-${index}`, 'green'] as const),
      ...Array.from({ length: 4 }, (_, index) => [`blue-${index}`, 'blue'] as const),
    ]);
    const snapshot = (id: string): MarbleSnapshot => ({ id, kind: 'target', x: 0, y: 0, radius: 24, speed: 0, angle: 0, angularVelocity: 0 });
    const objectives = (ids: string[]) => GameModule.getRemainingObjectives(ids.map(snapshot), colors, ['green', 'blue']);

    expect(objectives([...colors.keys()])).toEqual([{ color: 'green', remaining: 4 }, { color: 'blue', remaining: 4 }]);
    expect(objectives(['blue-0', 'blue-1', 'blue-2'])).toEqual([{ color: 'green', remaining: 0 }, { color: 'blue', remaining: 3 }]);
    expect(objectives([])).toEqual([{ color: 'green', remaining: 0 }, { color: 'blue', remaining: 0 }]);
    expect(objectives(['green-0', 'green-0', 'green-1', 'green-2', 'green-3'])).toEqual([{ color: 'green', remaining: 4 }, { color: 'blue', remaining: 0 }]);
  });

  it('tracks Level 4 color quotas and ignores extra blue clears after zero', () => {
    const colors = new Map([
      ...Array.from({ length: 5 }, (_, index) => [`blue-${index}`, 'blue'] as const),
      ...Array.from({ length: 2 }, (_, index) => [`green-${index}`, 'green'] as const),
    ]);
    const requirements = new Map([['blue', 2], ['green', 2]] as const);
    const snapshot = (id: string): MarbleSnapshot => ({ id, kind: 'target', x: 0, y: 0, radius: 24, speed: 0, angle: 0, angularVelocity: 0 });
    const objectives = (ids: string[]) => GameModule.getRemainingObjectives(ids.map(snapshot), colors, ['blue', 'green'], requirements);

    expect(objectives([...colors.keys()])).toEqual([{ color: 'blue', remaining: 2 }, { color: 'green', remaining: 2 }]);
    expect(objectives(['blue-1', 'blue-2', 'blue-3', 'blue-4', 'green-0', 'green-1'])).toEqual([{ color: 'blue', remaining: 1 }, { color: 'green', remaining: 2 }]);
    expect(objectives(['blue-3', 'blue-4', 'green-0', 'green-1'])).toEqual([{ color: 'blue', remaining: 0 }, { color: 'green', remaining: 2 }]);
    expect(objectives(['blue-3', 'blue-4'])).toEqual([{ color: 'blue', remaining: 0 }, { color: 'green', remaining: 0 }]);
  });

  it('wins a settled round when its color objectives are complete with targets remaining', () => {
    const game = new GameModel();
    game.startRound({ moveLimit: 5, targetTotal: 7, shooterX: 210 });
    game.confirmPosition();
    game.commitShot();
    game.beginSettling();
    expect(game.settle([], true)).toBe('won');
    expect(game.snapshot()).toMatchObject({ cleared: 0, originalTargetTotal: 7, outcome: 'won' });
  });

  it('owns the exact state sequence and consumes a move only for a shot', () => {
    const game = new GameModel();
    game.startRound({ moveLimit: 3, targetTotal: 2, shooterX: 210 });
    expect(game.snapshot().state).toBe('positioning');
    game.positionShooter(120);
    expect(game.snapshot().movesLeft).toBe(3);
    game.confirmPosition();
    expect(game.snapshot().state).toBe('aiming');
    expect(game.commitShot()).toBe(true);
    expect(game.snapshot()).toMatchObject({ state: 'shot', movesLeft: 2, movesUsed: 1 });
    game.beginSettling();
    expect(game.snapshot().state).toBe('settling');
    game.settle([]);
    expect(game.snapshot().state).toBe('positioning');
    expect(game.snapshot().shooterX).toBe(120);
  });

  it('processes simultaneous clears before one terminal outcome', () => {
    const game = new GameModel();
    game.startRound({ moveLimit: 1, targetTotal: 2, shooterX: 210 });
    game.confirmPosition(); game.commitShot(); game.beginSettling();
    expect(game.settle(['a', 'b'])).toBe('won');
    expect(game.snapshot()).toMatchObject({ cleared: 2, originalTargetTotal: 2, outcome: 'won' });
    expect(game.settle(['a', 'b'])).toBeNull();
    expect(game.finishRound('lost')).toBe(false);
  });

  it('loses only after the final shot settles with targets remaining', () => {
    const game = new GameModel();
    game.startRound({ moveLimit: 1, targetTotal: 2, shooterX: 210 });
    game.confirmPosition(); game.commitShot();
    expect(game.snapshot().outcome).toBeNull();
    game.beginSettling();
    expect(game.settle(['a'])).toBe('lost');
  });

  it('routes one settled loss through the guarded outcome transition', () => {
    const model = new GameModel();
    model.startRound({ moveLimit: 1, targetTotal: 2, shooterX: 210 });
    model.confirmPosition();
    model.commitShot();
    model.beginSettling();

    const restart = vi.fn();
    const beginOutcomeTransition = vi.fn();
    const showOutcome = vi.fn();
    const game = Object.create(GameModule.Game.prototype) as {
      completeShot(): void;
      model: GameModel;
      physics: { getSnapshots(): MarbleSnapshot[]; resetShooter(x: number): void };
      syncHud(): void;
      beginOutcomeTransition(outcome: 'won' | 'lost'): void;
      showOutcome(outcome: 'won' | 'lost'): void;
    };
    Object.assign(game, {
      model,
      physics: { getSnapshots: () => [], resetShooter: vi.fn() },
      restart,
      beginOutcomeTransition,
      syncHud: vi.fn(),
      showOutcome,
    });

    game.completeShot();
    game.completeShot();

    expect(beginOutcomeTransition).toHaveBeenCalledOnce();
    expect(beginOutcomeTransition).toHaveBeenCalledWith('lost');
    expect(restart).not.toHaveBeenCalled();
    expect(showOutcome).not.toHaveBeenCalled();
  });

  it('saves a win once, fades for 240ms, and advances through the existing level loader', () => {
    vi.useFakeTimers();
    const transitionRoot = document.createElement('section');
    const startLevel = vi.fn();
    const game = Object.create(GameModule.Game.prototype) as {
      beginOutcomeTransition?(outcome: 'won' | 'lost'): void;
      currentLevel: { definition: typeof LEVELS[number] };
      model: { snapshot(): { movesUsed: number } };
      transitionRoot: HTMLElement;
      transitionInProgress: boolean;
      startLevel(levelId: number): void;
      restart(): void;
      hud: { openLevelSelector(): void };
    };
    Object.assign(game, {
      currentLevel: { definition: LEVELS[0]! },
      model: { snapshot: () => ({ movesUsed: 3 }) },
      transitionRoot,
      transitionInProgress: false,
      startLevel,
      restart: vi.fn(),
      hud: { openLevelSelector: vi.fn() },
    });

    game.beginOutcomeTransition?.('won');
    game.beginOutcomeTransition?.('won');
    expect(transitionRoot.classList.contains('is-level-fading')).toBe(true);
    vi.advanceTimersByTime(119);
    expect(startLevel).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(startLevel).toHaveBeenCalledOnce();
    expect(startLevel).toHaveBeenCalledWith(2);
    expect(JSON.parse(localStorage.getItem('kanche-progress') ?? '{}')).toMatchObject({
      completedLevels: { '1': 3 },
      highestUnlockedLevel: 2,
    });
    vi.advanceTimersByTime(120);
    expect(transitionRoot.classList.contains('is-level-fading')).toBe(false);
  });

  it('opens the level selector after winning the final available level', () => {
    vi.useFakeTimers();
    const openLevelSelector = vi.fn();
    const game = Object.create(GameModule.Game.prototype) as {
      beginOutcomeTransition?(outcome: 'won' | 'lost'): void;
      currentLevel: { definition: typeof LEVELS[number] };
      model: { snapshot(): { movesUsed: number } };
      transitionRoot: HTMLElement;
      transitionInProgress: boolean;
      startLevel(levelId: number): void;
      restart(): void;
      hud: { openLevelSelector(): void };
    };
    Object.assign(game, {
      currentLevel: { definition: LEVELS.at(-1)! },
      model: { snapshot: () => ({ movesUsed: 4 }) },
      transitionRoot: document.createElement('section'),
      transitionInProgress: false,
      startLevel: vi.fn(),
      restart: vi.fn(),
      hud: { openLevelSelector },
    });

    game.beginOutcomeTransition?.('won');
    vi.advanceTimersByTime(120);
    expect(openLevelSelector).toHaveBeenCalledOnce();
  });

  it('restarts a failed level once without changing saved progress', () => {
    vi.useFakeTimers();
    localStorage.setItem('kanche-progress', JSON.stringify({ completedLevels: { '1': 2 }, highestUnlockedLevel: 2 }));
    const restart = vi.fn();
    const game = Object.create(GameModule.Game.prototype) as {
      beginOutcomeTransition?(outcome: 'won' | 'lost'): void;
      currentLevel: { definition: typeof LEVELS[number] };
      model: { snapshot(): { movesUsed: number } };
      transitionRoot: HTMLElement;
      transitionInProgress: boolean;
      startLevel(levelId: number): void;
      restart(): void;
      hud: { openLevelSelector(): void };
    };
    Object.assign(game, {
      currentLevel: { definition: LEVELS[1]! },
      model: { snapshot: () => ({ movesUsed: 5 }) },
      transitionRoot: document.createElement('section'),
      transitionInProgress: false,
      startLevel: vi.fn(),
      restart,
      hud: { openLevelSelector: vi.fn() },
    });
    const savedBefore = localStorage.getItem('kanche-progress');

    game.beginOutcomeTransition?.('lost');
    game.beginOutcomeTransition?.('lost');
    vi.advanceTimersByTime(120);

    expect(restart).toHaveBeenCalledOnce();
    expect(localStorage.getItem('kanche-progress')).toBe(savedBefore);
  });

  it('immediately resets an escaped shooter once while targets keep moving', () => {
    const model = new GameModel();
    model.startRound({ moveLimit: 2, targetTotal: 1, shooterX: 143 });
    model.confirmPosition();
    model.commitShot();
    model.beginSettling();
    const resetShooter = vi.fn();
    const clearEffects = vi.fn();
    const snapshots: MarbleSnapshot[] = [
      { id: 'shooter', kind: 'shooter', x: 445, y: 300, radius: 24, speed: 10, angle: 1, angularVelocity: 0.2 },
      { id: 'target-1', kind: 'target', x: 210, y: 300, radius: 24, speed: 2, angle: 0, angularVelocity: 0 },
    ];
    const game = Object.create(GameModule.Game.prototype) as {
      physicsTick(): void;
      model: GameModel;
      physics: {
        step(): [];
        getSnapshots(): MarbleSnapshot[];
        removeTarget(): boolean;
        resetShooter(x: number, collisionsEnabled?: boolean): void;
        allBodiesSettled(): boolean;
      };
      renderer: { clearEffects(): void };
      audio: { playCollision(): void; playClear(): void };
      targetColors: Map<string, string>;
      shooterResetDuringShot: boolean;
      aim: unknown;
    };
    Object.assign(game, {
      model,
      physics: {
        step: () => [],
        getSnapshots: () => snapshots,
        removeTarget: () => false,
        resetShooter,
        allBodiesSettled: () => false,
      },
      renderer: { clearEffects },
      audio: { playCollision: vi.fn(), playClear: vi.fn() },
      targetColors: new Map([['target-1', 'teal']]),
      shooterResetDuringShot: false,
      aim: null,
    });

    game.physicsTick();
    game.physicsTick();

    expect(resetShooter).toHaveBeenCalledOnce();
    expect(resetShooter).toHaveBeenCalledWith(143, false);
    expect(clearEffects).toHaveBeenCalledOnce();
    expect(model.snapshot().state).toBe('settling');
  });

  it('reveals only the hidden obstacle named by a striker collision event', () => {
    const model = new GameModel();
    model.startRound({ moveLimit: 8, targetTotal: 4, shooterX: 210 });
    model.confirmPosition();
    model.commitShot();
    const revealObstacle = vi.fn();
    const playCollision = vi.fn();
    const game = Object.create(GameModule.Game.prototype) as {
      physicsTick(): void;
      model: GameModel;
      physics: {
        step(): Array<{ type: string; intensity?: number; obstacleId?: string }>;
        getSnapshots(): MarbleSnapshot[];
        removeTarget(): boolean;
        allBodiesSettled(): boolean;
      };
      renderer: { revealObstacle(id: string): void };
      audio: { playCollision(intensity: number): void; playClear(): void };
      currentLevel: { obstacles: Array<{ id: string; shape: 'rectangle'; hidden?: boolean }> };
      targetColors: Map<string, string>;
      shooterResetDuringShot: boolean;
    };
    Object.assign(game, {
      model,
      physics: {
        step: () => [
          { type: 'collision', intensity: 2 },
          { type: 'shooter-obstacle-collision', obstacleId: 'level-7-hidden-center-square' },
          { type: 'shooter-obstacle-collision', obstacleId: 'level-7-left-block' },
        ],
        getSnapshots: () => [],
        removeTarget: () => false,
        allBodiesSettled: () => false,
      },
      renderer: { revealObstacle },
      audio: { playCollision, playClear: vi.fn() },
      currentLevel: {
        obstacles: [
          { id: 'level-7-hidden-center-square', shape: 'rectangle', hidden: true },
          { id: 'level-7-left-block', shape: 'rectangle' },
        ],
      },
      targetColors: new Map(),
      shooterResetDuringShot: false,
    });

    game.physicsTick();

    expect(playCollision).toHaveBeenCalledOnce();
    expect(playCollision).toHaveBeenCalledWith(2);
    expect(revealObstacle).toHaveBeenCalledOnce();
    expect(revealObstacle).toHaveBeenCalledWith('level-7-hidden-center-square');
  });

  it('pause is orthogonal and restart creates a clean equivalent round', () => {
    const game = new GameModel();
    game.startRound({ moveLimit: 4, targetTotal: 3, shooterX: 210 });
    game.pause();
    expect(game.commitShot()).toBe(false);
    game.resume();
    game.positionShooter(150); game.confirmPosition(); game.commitShot(); game.beginSettling(); game.settle(['a']);
    game.startRound({ moveLimit: 4, targetTotal: 3, shooterX: 210 });
    expect(game.snapshot()).toMatchObject({ state: 'positioning', movesLeft: 4, cleared: 0, shooterX: 210, outcome: null, paused: false });
  });
});
