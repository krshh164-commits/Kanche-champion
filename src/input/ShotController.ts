import { SHOOTER_BASELINE_Y, SHOOTER_MAX_X, SHOOTER_MIN_X, SHOOTER_RADIUS, SHOT, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../config';
import type { GameState } from '../game/gameState';
import type { Point } from '../game/rules';
import { calculateShot, clampShooterX, type AimPreview, type ShotVector } from './shotMath';

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
    return Math.hypot(point.x - shooter.x, point.y - shooter.y) <= SHOOTER_RADIUS * 1.8;
  }

  private hitsShooterPad(point: Point): boolean {
    return point.x >= SHOOTER_MIN_X - SHOOTER_RADIUS - 0.001
      && point.x <= SHOOTER_MAX_X + SHOOTER_RADIUS + 0.001
      && Math.abs(point.y - SHOOTER_BASELINE_Y) <= 28;
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.destroyed || this.activePointer !== null || event.button !== 0) return;
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
    this.canvas.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.activePointer) return;
    event.preventDefault();
    if (!this.gestureOrigin || !this.pointerOrigin) return;
    const point = this.toVirtual(event);
    if (this.gestureMode === 'pending') {
      const dx = point.x - this.pointerOrigin.x;
      const dy = point.y - this.pointerOrigin.y;
      if (Math.abs(dx) >= SHOT.minDrag && Math.abs(dx) > Math.abs(dy)) this.gestureMode = 'positioning';
      else if (calculateShot(this.gestureOrigin, point, event.timeStamp - this.gestureStartedAt, SHOT)) this.gestureMode = 'aiming';
    }
    if (this.gestureMode === 'positioning') {
      this.options.onPosition(clampShooterX(point.x - this.grabOffsetX, SHOOTER_MIN_X, SHOOTER_MAX_X));
      this.options.onAim(null);
      return;
    }
    const shot = calculateShot(this.gestureOrigin, point, event.timeStamp - this.gestureStartedAt, SHOT);
    this.options.onAim(shot ? { ...shot, origin: { ...this.gestureOrigin }, pointer: point } : null);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.activePointer) return;
    event.preventDefault();
    const shot = this.gestureMode !== 'positioning' && this.gestureOrigin
      ? calculateShot(this.gestureOrigin, this.toVirtual(event), event.timeStamp - this.gestureStartedAt, SHOT)
      : null;
    this.options.onAim(null);
    if (shot) {
      this.options.onPositionConfirmed();
      this.options.onShoot(shot);
    } else if (this.gestureMode !== 'positioning') this.options.onCancel();
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
  }

  reset(): void {
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
