import { SHOOTER_BASELINE_Y, SHOOTER_MAX_X, SHOOTER_MIN_X, SHOOTER_RADIUS, SHOT, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../config';
import type { GameState } from '../game/gameState';
import type { Point } from '../game/rules';
import { calculateAimPreview, calculateShot, clampShooterX, smoothSwipeDirection, type AimPreview, type ShotVector } from './shotMath';

interface Options {
  getState(): GameState;
  getShooter(): Point;
  onPosition(x: number): void;
  onPositionConfirmed(): void;
  onAim(preview: AimPreview | null): void;
  onShoot(shot: ShotVector): void;
  onCancel(): void;
}

export class ShotController {
  private activePointer: number | null = null;
  private gestureOrigin: Point | null = null;
  private pointerOrigin: Point | null = null;
  private gestureMode: 'pending' | 'positioning' | 'aiming' | null = null;
  private grabOffsetX = 0;
  private gestureStartedAt = 0;
  private smoothedDirection: Point | null = null;
  private launchFrame: number | null = null;
  private destroyed = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: Options) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
  }

  private toVirtual(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width * VIRTUAL_WIDTH,
      y: (event.clientY - rect.top) / rect.height * VIRTUAL_HEIGHT,
    };
  }

  private hitsShooter(point: Point): boolean {
    const shooter = this.options.getShooter();
    return Math.hypot(point.x - shooter.x, point.y - shooter.y) <= SHOOTER_RADIUS * 2.75;
  }

  private hitsShooterPad(point: Point): boolean {
    return point.x >= SHOOTER_MIN_X - SHOOTER_RADIUS - 0.001
      && point.x <= SHOOTER_MAX_X + SHOOTER_RADIUS + 0.001
      && Math.abs(point.y - SHOOTER_BASELINE_Y) <= 28;
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.destroyed || this.activePointer !== null || this.launchFrame !== null || event.button !== 0) return;
    const state = this.options.getState();
    if (state !== 'positioning' && state !== 'aiming') return;
    const point = this.toVirtual(event);
    if (state === 'positioning' ? !this.hitsShooterPad(point) : !this.hitsShooter(point)) return;
    event.preventDefault();
    if (state === 'positioning') {
      this.options.onPosition(clampShooterX(point.x, SHOOTER_MIN_X, SHOOTER_MAX_X));
    }
    this.activePointer = event.pointerId;
    this.gestureOrigin = { ...this.options.getShooter() };
    this.pointerOrigin = point;
    this.gestureMode = state === 'positioning' ? 'pending' : 'aiming';
    this.grabOffsetX = point.x - this.gestureOrigin.x;
    this.gestureStartedAt = event.timeStamp;
    this.smoothedDirection = null;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.activePointer) return;
    event.preventDefault();
    if (!this.gestureOrigin || !this.pointerOrigin) return;
    const point = this.toVirtual(event);
    const dx = point.x - this.pointerOrigin.x;
    const dy = point.y - this.pointerOrigin.y;
    const distance = Math.hypot(dx, dy);
    if (this.gestureMode === 'pending') {
      if (Math.abs(dx) >= SHOT.aimThreshold && Math.abs(dx) > Math.abs(dy) * 1.5) this.gestureMode = 'positioning';
    }
    if (this.gestureMode === 'positioning') {
      this.options.onPosition(clampShooterX(point.x - this.grabOffsetX, SHOOTER_MIN_X, SHOOTER_MAX_X));
      this.options.onAim(null);
      return;
    }
    if (distance < SHOT.deadZone) return;

    const direction = smoothSwipeDirection(this.smoothedDirection, { x: dx, y: dy }, SHOT.directionSmoothing);
    const projectedPointer = {
      x: this.gestureOrigin.x + dx,
      y: this.gestureOrigin.y + dy,
    };
    const duration = event.timeStamp - this.gestureStartedAt;
    const preview = calculateAimPreview(this.gestureOrigin, projectedPointer, duration, SHOT, direction);
    if (!preview) {
      this.smoothedDirection = null;
      this.options.onAim(null);
      return;
    }

    this.smoothedDirection = direction;
    this.gestureMode = 'aiming';
    const shot = calculateShot(this.gestureOrigin, projectedPointer, duration, SHOT, direction);
    if (!shot) {
      this.options.onAim({ ...preview, pointer: point, locked: false });
      return;
    }

    this.options.onAim({ ...shot, origin: { ...this.gestureOrigin }, pointer: point, locked: true });
    if (this.options.getState() === 'positioning') this.options.onPositionConfirmed();
    const pointerId = event.pointerId;
    this.finishCapture(pointerId);
    this.launchFrame = requestAnimationFrame(() => {
      this.launchFrame = null;
      this.options.onAim(null);
      this.options.onShoot(shot);
    });
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.activePointer) return;
    event.preventDefault();
    this.options.onAim(null);
    if (this.gestureMode !== 'positioning') this.options.onCancel();
    this.finishCapture(event.pointerId);
  };

  private onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== this.activePointer) return;
    event.preventDefault();
    this.options.onAim(null);
    this.options.onCancel();
    this.finishCapture(event.pointerId);
  };

  private finishCapture(pointerId: number) {
    if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
    this.activePointer = null;
    this.gestureOrigin = null;
    this.pointerOrigin = null;
    this.gestureMode = null;
    this.grabOffsetX = 0;
    this.gestureStartedAt = 0;
    this.smoothedDirection = null;
  }

  reset(): void {
    if (this.launchFrame !== null) {
      cancelAnimationFrame(this.launchFrame);
      this.launchFrame = null;
      this.options.onAim(null);
      this.options.onCancel();
    }
    if (this.activePointer !== null) {
      const pointerId = this.activePointer;
      this.options.onAim(null);
      this.options.onCancel();
      this.finishCapture(pointerId);
    }
  }

  destroy(): void {
    this.reset();
    this.destroyed = true;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
  }
}
