import { AudioManager } from '../audio/AudioManager';
import { BOARD_BOUNDS, LEVEL_LAYOUT_BOUNDS, PHYSICS, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, TARGET_RADIUS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../config';
import { ShotController } from '../input/ShotController';
import type { AimPreview, ShotVector } from '../input/shotMath';
import { LEVELS } from '../levels/levels';
import type { ResolvedLevel, TargetColor } from '../levels/levelTypes';
import { validateLevel } from '../levels/validateLevel';
import { FixedStepClock } from '../physics/fixedStep';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CanvasRenderer } from '../render/CanvasRenderer';
import { Hud } from '../ui/Hud';
import type { ColorObjective } from '../ui/Hud';
import type { GameState, RoundOutcome } from './gameState';
import { loadProgress, saveLevelCompletion } from './progress';
import { calculateOutcome, calculateStars, isMarbleFullyOutside, isTargetCleared } from './rules';
import type { MarbleSnapshot } from './rules';

export function getRemainingObjectives(
  snapshots: readonly MarbleSnapshot[],
  targetColors: ReadonlyMap<string, TargetColor>,
  colorOrder: readonly TargetColor[],
  requirements?: ReadonlyMap<TargetColor, number>,
): ColorObjective[] {
  const remainingByColor = new Map<TargetColor, number>();
  for (const snapshot of snapshots) {
    if (snapshot.kind !== 'target') continue;
    const color = targetColors.get(snapshot.id);
    if (color) remainingByColor.set(color, (remainingByColor.get(color) ?? 0) + 1);
  }
  return colorOrder.flatMap((color) => {
    const startingTotal = [...targetColors.values()].filter((targetColor) => targetColor === color).length;
    if (startingTotal === 0) return [];
    const active = Math.min(startingTotal, Math.max(0, remainingByColor.get(color) ?? 0));
    const required = Math.min(startingTotal, Math.max(0, requirements?.get(color) ?? startingTotal));
    const remaining = Math.max(0, required - (startingTotal - active));
    return [{ color, remaining }];
  });
}

export interface GameModelSnapshot {
  state: GameState;
  movesLeft: number;
  movesUsed: number;
  cleared: number;
  originalTargetTotal: number;
  shooterX: number;
  outcome: RoundOutcome | null;
  paused: boolean;
}

export class GameModel {
  private data: GameModelSnapshot = { state: 'positioning', movesLeft: 0, movesUsed: 0, cleared: 0, originalTargetTotal: 0, shooterX: VIRTUAL_WIDTH / 2, outcome: null, paused: false };
  private clearedIds = new Set<string>();

  startRound(input: { moveLimit: number; targetTotal: number; shooterX: number }): void {
    this.clearedIds.clear();
    this.data = { state: 'positioning', movesLeft: input.moveLimit, movesUsed: 0, cleared: 0, originalTargetTotal: input.targetTotal, shooterX: input.shooterX, outcome: null, paused: false };
  }
  snapshot(): GameModelSnapshot { return { ...this.data }; }
  positionShooter(x: number): void { if (!this.data.paused && this.data.state === 'positioning') this.data.shooterX = x; }
  confirmPosition(): void { if (!this.data.paused && this.data.state === 'positioning') this.data.state = 'aiming'; }
  commitShot(): boolean {
    if (this.data.paused || this.data.state !== 'aiming' || this.data.movesLeft <= 0) return false;
    this.data.movesLeft -= 1; this.data.movesUsed += 1; this.data.state = 'shot'; return true;
  }
  beginSettling(): void { if (this.data.state === 'shot') this.data.state = 'settling'; }
  recordClear(id: string): boolean {
    if (this.clearedIds.has(id) || this.data.outcome) return false;
    this.clearedIds.add(id);
    this.data.cleared += 1;
    return true;
  }
  settle(clearedIds: readonly string[], objectivesComplete?: boolean): RoundOutcome | null {
    if (this.data.state !== 'settling' || this.data.outcome) return null;
    this.data.state = 'resetting';
    for (const id of clearedIds) this.recordClear(id);
    const outcome = calculateOutcome({ cleared: this.data.cleared, originalTargetTotal: this.data.originalTargetTotal, movesLeft: this.data.movesLeft, settled: true, terminal: false, objectivesComplete });
    if (outcome) { this.finishRound(outcome); return outcome; }
    this.data.state = 'positioning';
    return null;
  }
  finishRound(outcome: RoundOutcome): boolean { if (this.data.outcome) return false; this.data.outcome = outcome; return true; }
  pause(): void { if (!this.data.outcome) this.data.paused = true; }
  resume(): void { this.data.paused = false; }
}

export class Game {
  private readonly model = new GameModel();
  private readonly physics = new PhysicsWorld();
  private readonly clock = new FixedStepClock(PHYSICS.fixedStepMs, PHYSICS.maxCatchUpSteps);
  private readonly renderer: CanvasRenderer;
  private readonly audio = new AudioManager();
  private readonly controller: ShotController;
  private readonly hud: Hud;
  private readonly transitionRoot: HTMLElement;
  private currentLevel: ResolvedLevel | null = null;
  private targetColors = new Map<string, TargetColor>();
  private aim: AimPreview | null = null;
  private shooterResetDuringShot = false;
  private lastFrame = performance.now();
  private frameId = 0;
  private transitionInProgress = false;
  private transitionTimer: number | null = null;
  private transitionEndTimer: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    hudRoot: HTMLElement,
  ) {
    this.renderer = new CanvasRenderer(canvas);
    this.transitionRoot = canvas.closest<HTMLElement>('.game-screen') ?? canvas;
    this.hud = new Hud(hudRoot, {
      levels: LEVELS,
      onSelectLevel: (levelId) => this.startLevel(levelId),
      getProgress: loadProgress,
    });
    this.controller = new ShotController(canvas, {
      getState: () => this.model.snapshot().paused ? 'settling' : this.model.snapshot().state,
      getShooter: () => ({ x: this.model.snapshot().shooterX, y: SHOOTER_BASELINE_Y }),
      onPosition: (x) => { this.model.positionShooter(x); this.physics.setShooterX(x); },
      onPositionConfirmed: () => this.model.confirmPosition(),
      onAim: (preview) => { this.aim = preview; },
      onShoot: (shot) => this.shoot(shot),
      onCancel: () => { this.aim = null; },
    });
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);
    this.frameId = requestAnimationFrame(this.loop);
  }

  startLevel(levelId: number): void {
    const definition = LEVELS.find((level) => level.id === levelId);
    if (!definition) throw new Error(`Unknown level ${levelId}`);
    this.currentLevel = validateLevel(definition, {
      boundary: LEVEL_LAYOUT_BOUNDS,
      canvas: BOARD_BOUNDS,
      targetRadius: TARGET_RADIUS,
      shooter: { x: VIRTUAL_WIDTH / 2, y: SHOOTER_BASELINE_Y, radius: SHOOTER_RADIUS },
      safetyGap: 2,
    });
    this.targetColors = new Map(this.currentLevel.targets.map((target) => [target.id, target.color]));
    this.model.startRound({ moveLimit: definition.moveLimit, targetTotal: this.currentLevel.targets.length, shooterX: VIRTUAL_WIDTH / 2 });
    this.physics.loadLevel(this.currentLevel);
    this.shooterResetDuringShot = false;
    this.resizeCanvas();
    this.clock.reset(); this.controller.reset(); this.renderer.clearEffects(); this.aim = null;
    this.lastFrame = performance.now(); this.syncHud();
  }

  restart(): void { if (this.currentLevel) this.startLevel(this.currentLevel.definition.id); }
  pause(): void { this.model.pause(); this.clock.reset(); this.controller.reset(); this.syncHud(); }
  resume(): void { this.model.resume(); this.clock.reset(); this.lastFrame = performance.now(); this.syncHud(); }
  finishRound(outcome: RoundOutcome): boolean { return this.model.finishRound(outcome); }

  private shoot(shot: ShotVector) {
    if (!this.model.commitShot()) return;
    this.shooterResetDuringShot = false;
    this.physics.applyShot(shot.velocity);
    this.audio.playShot();
    this.aim = null;
    this.syncHud();
  }

  private loop = (timestamp: number) => {
    const frameDelta = Math.min(250, Math.max(0, timestamp - this.lastFrame));
    this.lastFrame = timestamp;
    const state = this.model.snapshot();
    if (!state.paused && this.currentLevel) {
      const steps = this.clock.consume(frameDelta);
      for (let index = 0; index < steps; index += 1) this.physicsTick();
    } else this.clock.reset();
    this.renderer.render({ snapshots: this.physics.getSnapshots(), obstacles: this.currentLevel?.obstacles ?? [], targetColors: this.targetColors, aim: this.aim, state: this.model.snapshot().state, deltaMs: frameDelta, paused: this.model.snapshot().paused });
    this.frameId = requestAnimationFrame(this.loop);
  };

  private physicsTick() {
    if (this.model.snapshot().state === 'shot') this.model.beginSettling();
    for (const event of this.physics.step(PHYSICS.fixedStepMs)) {
      if (event.type === 'collision') {
        this.audio.playCollision(event.intensity);
        continue;
      }
      const obstacle = this.currentLevel?.obstacles.find(({ id }) => id === event.obstacleId);
      if (obstacle?.shape === 'rectangle' && obstacle.hidden) this.renderer.revealObstacle(event.obstacleId);
    }
    let cleared = false;
    for (const snapshot of this.physics.getSnapshots()) {
      if (
        snapshot.kind === 'shooter'
        && this.model.snapshot().state === 'settling'
        && !this.shooterResetDuringShot
        && isMarbleFullyOutside(snapshot, BOARD_BOUNDS)
      ) {
        this.physics.resetShooter(this.getShooterResetX(), false);
        this.renderer.clearEffects();
        this.aim = null;
        this.shooterResetDuringShot = true;
        continue;
      }
      if (!isTargetCleared(snapshot, BOARD_BOUNDS)) continue;
      if (this.physics.removeTarget(snapshot.id)) {
        this.model.recordClear(snapshot.id);
        cleared = true;
        this.audio.playClear();
      }
    }
    if (cleared) this.syncHud();
    if (this.model.snapshot().state === 'settling' && this.physics.allBodiesSettled()) this.completeShot();
  }

  private completeShot() {
    const objectives = this.getCurrentObjectives();
    const outcome = this.model.settle([], objectives.length > 0 ? objectives.every(({ remaining }) => remaining === 0) : undefined);
    const shooter = this.physics.getSnapshots().find((body) => body.kind === 'shooter');
    const shooterOutside = shooter ? isMarbleFullyOutside(shooter, BOARD_BOUNDS) : false;
    if (!outcome || shooterOutside || this.shooterResetDuringShot) this.physics.resetShooter(this.getShooterResetX(), true);
    this.shooterResetDuringShot = false;
    this.syncHud();
    if (outcome) this.beginOutcomeTransition(outcome);
  }

  private getShooterResetX(): number {
    const savedX = this.model.snapshot().shooterX;
    return Number.isFinite(savedX) ? savedX : VIRTUAL_WIDTH / 2;
  }

  private beginOutcomeTransition(outcome: RoundOutcome) {
    if (this.transitionInProgress || !this.currentLevel) return;
    this.transitionInProgress = true;
    const currentDefinition = this.currentLevel.definition;
    const currentIndex = LEVELS.findIndex((level) => level.id === currentDefinition.id);
    const nextLevel = outcome === 'won' ? LEVELS[currentIndex + 1] : undefined;
    if (outcome === 'won') {
      const state = this.model.snapshot();
      const stars = calculateStars(state.movesUsed, currentDefinition.threeStarThreshold, currentDefinition.twoStarThreshold);
      saveLevelCompletion(currentDefinition.id, stars, nextLevel?.id);
    }

    this.controller?.reset();
    this.transitionRoot.classList.add('is-level-fading');
    this.transitionTimer = window.setTimeout(() => {
      if (outcome === 'lost') this.restart();
      else if (nextLevel) this.startLevel(nextLevel.id);
      else this.hud.openLevelSelector();
      this.transitionRoot.classList.remove('is-level-fading');
      this.transitionEndTimer = window.setTimeout(() => {
        this.transitionInProgress = false;
        this.transitionEndTimer = null;
      }, 120);
      this.transitionTimer = null;
    }, 120);
  }

  private resizeCanvas = () => {
    const wrap = this.canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(1, wrap?.width ?? VIRTUAL_WIDTH);
    this.renderer.resize(width, width * VIRTUAL_HEIGHT / VIRTUAL_WIDTH, window.devicePixelRatio || 1);
  };
  private syncHud() {
    const state = this.model.snapshot();
    const objectives = this.getCurrentObjectives();
    this.hud.update({
      movesLeft: state.movesLeft,
      cleared: state.cleared,
      targetTotal: state.originalTargetTotal,
      paused: state.paused,
      currentLevelId: this.currentLevel?.definition.id ?? 1,
      objectives,
    });
  }

  private getCurrentObjectives(): ColorObjective[] {
    const definition = this.currentLevel?.definition;
    const colorOrder = definition?.objectives?.map(({ color }) => color)
      ?? [...new Set(definition?.targets.map((target) => target.color) ?? [])];
    const requirements = definition?.objectives
      ? new Map(definition.objectives.map(({ color, count }) => [color, count]))
      : undefined;
    return getRemainingObjectives(this.physics.getSnapshots(), this.targetColors, colorOrder, requirements);
  }

  destroy(): void {
    cancelAnimationFrame(this.frameId);
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    if (this.transitionEndTimer !== null) window.clearTimeout(this.transitionEndTimer);
    this.controller.destroy();
  }
}
