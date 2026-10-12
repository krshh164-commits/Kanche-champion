import type { MarbleSnapshot } from '../game/rules';
import type { TargetColor } from '../levels/levelTypes';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: TargetColor;
  alpha: number;
  lifeMs: number;
}

export interface FadeMarble {
  x: number;
  y: number;
  radius: number;
  angle: number;
  initialAngle: number;
  color: TargetColor;
  alpha: number;
  lifeMs: number;
}

export class EffectSystem {
  private particles: Particle[] = [];
  private fades: FadeMarble[] = [];

  constructor(private readonly random: () => number = Math.random) {}

  spawnClearEffect(marble: MarbleSnapshot, color: TargetColor): void {
    this.fades.push({ x: marble.x, y: marble.y, radius: marble.radius, angle: marble.angle, initialAngle: marble.initialAngle ?? 0, color, alpha: 1, lifeMs: 420 });
    for (let index = 0; index < 10; index += 1) {
      const angle = this.random() * Math.PI * 2;
      const speed = 0.025 + this.random() * 0.035;
      this.particles.push({
        x: marble.x,
        y: marble.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + this.random() * 2,
        color,
        alpha: 1,
        lifeMs: 520 + this.random() * 180,
      });
    }
  }

  update(deltaMs: number): void {
    for (const particle of this.particles) {
      particle.x += particle.vx * deltaMs;
      particle.y += particle.vy * deltaMs;
      particle.lifeMs -= deltaMs;
      particle.alpha = Math.max(0, particle.lifeMs / 700);
    }
    for (const fade of this.fades) {
      fade.lifeMs -= deltaMs;
      fade.alpha = Math.max(0, fade.lifeMs / 420);
      fade.radius += deltaMs * 0.008;
    }
    this.particles = this.particles.filter((particle) => particle.lifeMs > 0);
    this.fades = this.fades.filter((fade) => fade.lifeMs > 0);
  }

  clearEffects(): void {
    this.particles = [];
    this.fades = [];
  }

  snapshot(): { particles: readonly Particle[]; fades: readonly FadeMarble[] } {
    return { particles: this.particles, fades: this.fades };
  }
}

export interface DebugPrimitive {
  id: string;
  x: number;
  y: number;
  radius: number;
  velocity?: { x: number; y: number };
}

export function getDebugPrimitives(snapshots: readonly MarbleSnapshot[], enabled: boolean): DebugPrimitive[] {
  if (!enabled) return [];
  return snapshots.map(({ id, x, y, radius, velocity }) => ({ id, x, y, radius, velocity }));
}
