import { describe, expect, it } from 'vitest';
import { LEVEL_LAYOUT_BOUNDS, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, TARGET_RADIUS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../src/config';
import { LEVELS } from '../src/levels/levels';
import { validateLevel } from '../src/levels/validateLevel';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

const geometry = {
  boundary: LEVEL_LAYOUT_BOUNDS,
  canvas: { left: 0, right: VIRTUAL_WIDTH, top: 0, bottom: VIRTUAL_HEIGHT },
  targetRadius: TARGET_RADIUS,
  shooter: { x: VIRTUAL_WIDTH / 2, y: SHOOTER_BASELINE_Y, radius: SHOOTER_RADIUS },
  safetyGap: 2,
} as const;

describe('Level 4', () => {
  it('defines three blue, two green, and the two-per-color objective in four moves', () => {
    const level = LEVELS.find((entry) => entry.id === 4);
    expect(level).toBeDefined();
    expect(level).toMatchObject({
      moveLimit: 4,
      threeStarThreshold: 3,
      twoStarThreshold: 4,
      objectives: [{ color: 'blue', count: 2 }, { color: 'green', count: 2 }],
    });
    expect(level?.targets).toHaveLength(5);
    expect(level?.targets.filter((target) => target.color === 'blue')).toHaveLength(3);
    expect(level?.targets.filter((target) => target.color === 'green')).toHaveLength(2);
  });

  it('loads five safely spaced targets with no obstacles', () => {
    const level = LEVELS.find((entry) => entry.id === 4)!;
    const resolved = validateLevel(level, geometry);
    expect(resolved.targets).toHaveLength(5);
    expect(resolved.obstacles).toHaveLength(0);

    for (let first = 0; first < resolved.targets.length; first += 1) {
      for (let second = first + 1; second < resolved.targets.length; second += 1) {
        const a = resolved.targets[first]!;
        const b = resolved.targets[second]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(110);
      }
    }

    const physics = new PhysicsWorld();
    physics.loadLevel(resolved);
    expect(physics.getObstacleSnapshots()).toHaveLength(0);
    expect(physics.getSnapshots().filter((body) => body.kind === 'target')).toHaveLength(5);
  });
});
