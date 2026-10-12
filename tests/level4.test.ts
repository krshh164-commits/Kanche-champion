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
  it('defines five blue, two green, and the two-per-color objective in five moves', () => {
    const level = LEVELS.find((entry) => entry.id === 4);
    expect(level).toBeDefined();
    expect(level).toMatchObject({
      moveLimit: 5,
      objectives: [{ color: 'blue', count: 2 }, { color: 'green', count: 2 }],
    });
    expect(level?.targets.filter((target) => target.color === 'blue')).toHaveLength(5);
    expect(level?.targets.filter((target) => target.color === 'green')).toHaveLength(2);
  });

  it('loads seven non-overlapping targets and exactly five static triangles', () => {
    const level = LEVELS.find((entry) => entry.id === 4)!;
    const resolved = validateLevel(level, geometry);
    expect(resolved.targets).toHaveLength(7);
    expect(resolved.obstacles).toHaveLength(5);
    expect(resolved.obstacles.every((obstacle) => obstacle.shape === 'triangle')).toBe(true);
    expect(resolved.obstacles.every((obstacle) => obstacle.color === '#1E1E1E')).toBe(true);

    const physics = new PhysicsWorld();
    physics.loadLevel(resolved);
    expect(physics.getObstacleSnapshots()).toHaveLength(5);
    expect(physics.getObstacleSnapshots().every((obstacle) => obstacle.isStatic)).toBe(true);
    expect(physics.getSnapshots().filter((body) => body.kind === 'target')).toHaveLength(7);
  });

  it('scales every triangle to 70 percent and places one at board center', () => {
    const resolved = validateLevel(LEVELS.find((entry) => entry.id === 4)!, geometry);
    const triangles = resolved.obstacles.map((obstacle) => {
      if (obstacle.shape !== 'triangle') throw new Error('Level 4 obstacle must be triangular');
      const xs = obstacle.vertices.map(({ x }) => x);
      const ys = obstacle.vertices.map(({ y }) => y);
      return {
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        centerX: xs.reduce((sum, value) => sum + value, 0) / 3,
        centerY: ys.reduce((sum, value) => sum + value, 0) / 3,
      };
    });

    expect(triangles.map(({ width, height }) => [Number(width.toFixed(8)), Number(height.toFixed(8))])).toEqual([
      [38.5, 42],
      [38.5, 52.5],
      [35, 49],
      [49, 70],
      [42, 49],
    ]);
    expect(triangles[4]?.centerX).toBeCloseTo(210, 8);
    expect(triangles[4]?.centerY).toBeCloseTo(350, 8);
  });
});
