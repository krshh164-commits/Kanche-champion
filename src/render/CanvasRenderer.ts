import { COLORS, DEBUG_PHYSICS, SHOOTER_BASELINE_Y, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../config';
import type { GameState } from '../game/gameState';
import type { MarbleSnapshot } from '../game/rules';
import type { TargetColor } from '../levels/levelTypes';
import type { ResolvedObstacle, ResolvedRectangleObstacle, ResolvedTriangleObstacle } from '../levels/levelTypes';
import type { AimPreview } from '../input/shotMath';
import { EffectSystem, getDebugPrimitives } from './effects';

const TARGET_MARBLE_SOURCE_SIZE = 54;
const TARGET_MARBLE_TEXTURE_SIZE = 216;
const TARGET_MARBLE_WIDE_RIBBON =
  'M24.4847 6C24.4845 6.27815 27.5832 6.83444 30.3173 17.1258C31.0466 21.5762 31.3923 24.7108 30.3173 27.1391C30.1174 29.3062 27.4015 32.3678 27.4015 36.3179C27.4015 47.0707 31.0285 47.9997 30.6819 48C30.3353 48.0003 25.2139 45.7748 23.3911 36.3179C22.8444 31.5894 22.7893 28.4945 23.7557 26.3046C24.0602 23.9843 26.1253 20.9154 26.1253 17.1258C26.1253 6.37353 24.1202 6.00051 24.4847 6Z';
const TARGET_MARBLE_INNER_RIBBON =
  'M25.9279 7C25.9278 7.2649 27.8645 7.7947 29.5733 17.596C30.0291 21.8344 30.2452 24.8198 29.5733 27.1324C29.4484 29.1963 27.7509 32.1122 27.7509 35.8742C27.7509 46.1149 30.0178 46.9997 29.8012 47C29.5846 47.0003 26.3837 44.8808 25.2444 35.8742C24.9028 31.3709 24.8683 28.4233 25.4723 26.3377C25.6627 24.1279 26.9533 21.2052 26.9533 17.596C26.9533 7.35574 25.7002 7.00048 25.9279 7Z';

let targetMarbleTexture: HTMLCanvasElement | null = null;
let blueMarbleTexture: HTMLCanvasElement | null = null;
let shooterMarbleTexture: HTMLCanvasElement | null = null;

export interface RenderFrame {
  snapshots: readonly MarbleSnapshot[];
  obstacles: readonly ResolvedObstacle[];
  targetColors: ReadonlyMap<string, TargetColor>;
  aim: AimPreview | null;
  state: GameState;
  deltaMs: number;
  paused: boolean;
}

export function getMarblePaint(color: string) {
  return {
    fill: color,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    highlight: false,
  } as const;
}

export function getMarbleDrawRect(x: number, y: number, radius: number) {
  return {
    x: x - radius,
    y: y - radius,
    width: radius * 2,
    height: radius * 2,
  } as const;
}

export function getMarbleDrawTransform(x: number, y: number, radius: number, angle: number, initialAngle = 0) {
  return {
    translateX: x,
    translateY: y,
    rotation: initialAngle + (angle - initialAngle) * 1.75,
    x: -radius,
    y: -radius,
    width: radius * 2,
    height: radius * 2,
  } as const;
}

export function getTargetTextureColor(color: TargetColor): 'teal' | 'blue' | null {
  if (color === 'teal' || color === 'green') return 'teal';
  return color === 'blue' ? 'blue' : null;
}

function getTargetMarbleTexture(): HTMLCanvasElement {
  if (targetMarbleTexture) return targetMarbleTexture;

  const texture = document.createElement('canvas');
  texture.width = TARGET_MARBLE_TEXTURE_SIZE;
  texture.height = TARGET_MARBLE_TEXTURE_SIZE;
  const context = texture.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available for the target marble texture');

  const scale = TARGET_MARBLE_TEXTURE_SIZE / TARGET_MARBLE_SOURCE_SIZE;
  context.scale(scale, scale);
  const gradient = context.createRadialGradient(27, 27, 0, 27, 27, 27);
  gradient.addColorStop(0.408641, '#37907E');
  gradient.addColorStop(0.572097, '#2D8675');
  gradient.addColorStop(0.735552, '#247D6B');
  gradient.addColorStop(0.966346, '#1F6F5F');
  gradient.addColorStop(1, '#B1E7DD');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(27, 27, 27, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#E3A45C';
  context.fill(new Path2D(TARGET_MARBLE_WIDE_RIBBON));
  context.fillStyle = '#D78D39';
  context.fill(new Path2D(TARGET_MARBLE_INNER_RIBBON));

  targetMarbleTexture = texture;
  return texture;
}

function getBlueMarbleTexture(): HTMLCanvasElement {
  if (blueMarbleTexture) return blueMarbleTexture;

  const texture = document.createElement('canvas');
  texture.width = TARGET_MARBLE_TEXTURE_SIZE;
  texture.height = TARGET_MARBLE_TEXTURE_SIZE;
  const context = texture.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available for the blue marble texture');

  context.scale(TARGET_MARBLE_TEXTURE_SIZE / TARGET_MARBLE_SOURCE_SIZE, TARGET_MARBLE_TEXTURE_SIZE / TARGET_MARBLE_SOURCE_SIZE);
  const gradient = context.createRadialGradient(27, 27, 0, 27, 27, 27);
  gradient.addColorStop(0.408641, '#176FC2');
  gradient.addColorStop(0.572097, '#1268BC');
  gradient.addColorStop(0.735552, '#0E60B5');
  gradient.addColorStop(0.966346, '#0956A7');
  gradient.addColorStop(1, '#9DE5EC');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(27, 27, 27, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#78DBE5';
  context.fill(new Path2D(TARGET_MARBLE_WIDE_RIBBON));
  context.fillStyle = '#2BC4D8';
  context.fill(new Path2D(TARGET_MARBLE_INNER_RIBBON));

  blueMarbleTexture = texture;
  return texture;
}

function getShooterMarbleTexture(): HTMLCanvasElement {
  if (shooterMarbleTexture) return shooterMarbleTexture;

  const texture = document.createElement('canvas');
  texture.width = TARGET_MARBLE_TEXTURE_SIZE;
  texture.height = TARGET_MARBLE_TEXTURE_SIZE;
  const context = texture.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available for the shooter marble texture');

  context.scale(TARGET_MARBLE_TEXTURE_SIZE / TARGET_MARBLE_SOURCE_SIZE, TARGET_MARBLE_TEXTURE_SIZE / TARGET_MARBLE_SOURCE_SIZE);
  const gradient = context.createRadialGradient(27, 27, 0, 27, 27, 27);
  gradient.addColorStop(0, '#3B4240');
  gradient.addColorStop(0.42, '#383F3D');
  gradient.addColorStop(0.7, '#2C3230');
  gradient.addColorStop(0.96, '#151817');
  gradient.addColorStop(1, '#727A76');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(27, 27, 27, 0, Math.PI * 2);
  context.fill();

  shooterMarbleTexture = texture;
  return texture;
}

export function getObstaclePaint(obstacle: ResolvedObstacle) {
  return {
    fill: obstacle.color,
    stroke: null,
    shadowBlur: 0,
    cornerRadius: 0,
  } as const;
}

export function getTrianglePoints(obstacle: ResolvedTriangleObstacle) {
  return obstacle.vertices;
}

export function getObstacleRect(obstacle: ResolvedRectangleObstacle) {
  return {
    x: obstacle.x - obstacle.width / 2,
    y: obstacle.y - obstacle.height / 2,
    width: obstacle.width,
    height: obstacle.height,
  } as const;
}

export class CanvasRenderer {
  readonly effects = new EffectSystem();
  private readonly context: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    this.context = context;
  }

  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    const ratio = Math.max(1, devicePixelRatio);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.round(cssWidth * ratio);
    this.canvas.height = Math.round(cssHeight * ratio);
  }

  render(frame: RenderFrame): void {
    const context = this.context;
    const scaleX = this.canvas.width / VIRTUAL_WIDTH;
    const scaleY = this.canvas.height / VIRTUAL_HEIGHT;
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    context.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    context.fillStyle = COLORS.background;
    context.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    this.drawBaseline();
    this.drawObstacles(frame.obstacles);

    for (const snapshot of frame.snapshots) {
      if (snapshot.kind === 'shooter') {
        this.drawShooterMarble(snapshot.x, snapshot.y, snapshot.radius);
        continue;
      }

      const targetColor = frame.targetColors.get(snapshot.id) ?? 'teal';
      const textureColor = getTargetTextureColor(targetColor);
      if (textureColor) {
        this.drawTargetMarble(snapshot.x, snapshot.y, snapshot.radius, snapshot.angle, snapshot.initialAngle ?? 0, 1, textureColor);
      } else {
        this.drawMarble(snapshot.x, snapshot.y, snapshot.radius, COLORS[targetColor], 1);
      }
    }

    if (frame.aim && frame.state === 'aiming') this.drawAim(frame.aim);
    this.effects.update(frame.deltaMs);
    const effects = this.effects.snapshot();
    for (const fade of effects.fades) {
      const textureColor = getTargetTextureColor(fade.color);
      if (textureColor) this.drawTargetMarble(fade.x, fade.y, fade.radius, fade.angle, fade.initialAngle, fade.alpha, textureColor);
      else this.drawMarble(fade.x, fade.y, fade.radius, COLORS[fade.color], fade.alpha);
    }
    for (const particle of effects.particles) {
      context.globalAlpha = particle.alpha;
      context.fillStyle = COLORS[particle.color];
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    this.drawDebug(frame.snapshots);
    if (frame.paused) {
      context.fillStyle = 'rgba(19,31,39,.58)';
      context.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      context.fillStyle = COLORS.text;
      context.font = '700 24px system-ui';
      context.textAlign = 'center';
      context.fillText('PAUSED', VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    }
  }

  spawnClearEffect(snapshot: MarbleSnapshot, color: TargetColor): void {
    this.effects.spawnClearEffect(snapshot, color);
  }

  clearEffects(): void {
    this.effects.clearEffects();
  }

  private drawBaseline() {
    const c = this.context;
    c.fillStyle = COLORS.shooterPad;
    c.beginPath();
    c.roundRect(54, SHOOTER_BASELINE_Y - 28, 312, 56, 22);
    c.fill();
  }

  private drawObstacles(obstacles: readonly ResolvedObstacle[]) {
    const c = this.context;
    c.save();
    c.beginPath();
    c.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    c.clip();
    for (const obstacle of obstacles) {
      const paint = getObstaclePaint(obstacle);
      c.save();
      c.shadowColor = 'transparent';
      c.shadowBlur = paint.shadowBlur;
      c.fillStyle = paint.fill;
      if (obstacle.shape === 'rectangle') {
        const rect = getObstacleRect(obstacle);
        c.fillRect(rect.x, rect.y, rect.width, rect.height);
      } else if (obstacle.shape === 'arc') {
        c.beginPath();
        c.arc(obstacle.x, obstacle.y, obstacle.outerRadius, obstacle.startAngle, obstacle.endAngle);
        c.arc(obstacle.x, obstacle.y, obstacle.innerRadius, obstacle.endAngle, obstacle.startAngle, true);
        c.closePath();
        c.fill();
      } else {
        const points = obstacle.vertices;
        c.beginPath();
        c.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length; index += 1) c.lineTo(points[index]!.x, points[index]!.y);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    c.restore();
  }

  private drawMarble(x: number, y: number, radius: number, color: string, alpha: number) {
    const c = this.context;
    const paint = getMarblePaint(color);
    c.save();
    c.globalAlpha = alpha;
    c.shadowColor = 'transparent';
    c.shadowBlur = paint.shadowBlur;
    c.shadowOffsetX = paint.shadowOffsetX;
    c.shadowOffsetY = paint.shadowOffsetY;
    c.fillStyle = paint.fill;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  private drawShooterMarble(x: number, y: number, radius: number) {
    const rect = getMarbleDrawRect(x, y, radius);
    this.context.save();
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
    this.context.drawImage(getShooterMarbleTexture(), rect.x, rect.y, rect.width, rect.height);
    this.context.restore();
  }

  private drawTargetMarble(x: number, y: number, radius: number, angle: number, initialAngle: number, alpha: number, color: 'teal' | 'blue') {
    const c = this.context;
    const transform = getMarbleDrawTransform(x, y, radius, angle, initialAngle);
    c.save();
    c.globalAlpha = alpha;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.translate(transform.translateX, transform.translateY);
    c.rotate(transform.rotation);
    c.drawImage(color === 'blue' ? getBlueMarbleTexture() : getTargetMarbleTexture(), transform.x, transform.y, transform.width, transform.height);
    c.restore();
  }

  private drawAim(aim: AimPreview) {
    const c = this.context;
    const length = 45 + aim.power * 120;
    const ux = aim.velocity.x / aim.speed;
    const uy = aim.velocity.y / aim.speed;
    c.strokeStyle = 'rgba(31,31,31,.78)';
    c.lineWidth = 1.5;
    c.setLineDash([4, 8]);
    c.beginPath();
    c.moveTo(aim.origin.x + ux * 22, aim.origin.y + uy * 22);
    c.lineTo(aim.origin.x + ux * length, aim.origin.y + uy * length);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = `rgba(31,31,31,${0.25 + aim.power * 0.6})`;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(aim.origin.x, aim.origin.y, 23, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * aim.power);
    c.stroke();
  }

  private drawDebug(snapshots: readonly MarbleSnapshot[]) {
    const c = this.context;
    c.font = '10px monospace';
    c.textAlign = 'left';
    for (const item of getDebugPrimitives(snapshots, DEBUG_PHYSICS)) {
      c.strokeStyle = '#FF6B6B';
      c.lineWidth = 1;
      c.strokeRect(item.x - item.radius, item.y - item.radius, item.radius * 2, item.radius * 2);
      c.fillStyle = '#FFFFFF';
      c.fillText(item.id, item.x + item.radius, item.y);
      if (item.velocity) {
        c.beginPath();
        c.moveTo(item.x, item.y);
        c.lineTo(item.x + item.velocity.x * 8, item.y + item.velocity.y * 8);
        c.stroke();
      }
    }
  }
}
