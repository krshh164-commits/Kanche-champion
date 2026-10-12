import { describe, expect, it } from 'vitest';
import { LEVEL_LAYOUT_BOUNDS, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, TARGET_RADIUS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../src/config';
import { LEVELS } from '../src/levels/levels';
import { validateLevel } from '../src/levels/validateLevel';
import type { LevelDefinition, LevelGeometry } from '../src/levels/levelTypes';

const geometry: LevelGeometry = {
  boundary: LEVEL_LAYOUT_BOUNDS,
  canvas: { left: 0, top: 0, right: VIRTUAL_WIDTH, bottom: VIRTUAL_HEIGHT },
  targetRadius: TARGET_RADIUS,
  shooter: { x: VIRTUAL_WIDTH / 2, y: SHOOTER_BASELINE_Y, radius: SHOOTER_RADIUS },
  safetyGap: 2,
};

interface TestObstacle {
  id: string;
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: '#1E1E1E';
}

interface ResolvedObstacle extends TestObstacle {}

function withObstacles(level: LevelDefinition, obstacles: TestObstacle[]): LevelDefinition {
  return { ...level, obstacles } as LevelDefinition;
}

function obstaclesOf(resolved: unknown): ResolvedObstacle[] | undefined {
  return (resolved as { obstacles?: ResolvedObstacle[] }).obstacles;
}

function fixture(): LevelDefinition {
  return {
    id: 99,
    name: 'Obstacle fixture',
    moveLimit: 6,
    threeStarThreshold: 3,
    twoStarThreshold: 5,
    targets: [{ x: 0.1, y: 0.1, color: 'teal' }],
  };
}

describe('Level 2 circular formation', () => {
  it('resolves six teal targets on the approved 80-unit ring', () => {
    const definition = LEVELS.find((level) => level.id === 2);
    expect(definition).toBeDefined();
    const resolved = validateLevel(definition!, geometry);
    const expected = [
      [210, 240],
      [279.28203230275506, 280],
      [279.28203230275506, 360],
      [210, 400],
      [140.71796769724492, 360],
      [140.71796769724492, 280],
    ] as const;

    expect(resolved.targets).toHaveLength(6);
    expect(new Set(resolved.targets.map((target) => target.color))).toEqual(new Set(['teal']));
    resolved.targets.forEach((target, index) => {
      expect(target.radius).toBe(24);
      expect(target.x).toBeCloseTo(expected[index]![0], 6);
      expect(target.y).toBeCloseTo(expected[index]![1], 6);
    });
    for (let first = 0; first < resolved.targets.length; first += 1) {
      for (let second = first + 1; second < resolved.targets.length; second += 1) {
        const a = resolved.targets[first]!;
        const b = resolved.targets[second]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(48);
      }
    }
  });

  it('resolves one exact top-center rectangle while Level 1 stays obstacle-free', () => {
    const level2 = validateLevel(LEVELS.find((level) => level.id === 2)!, geometry);
    expect(obstaclesOf(level2)).toEqual([{
      id: 'level-2-top-block',
      shape: 'rectangle',
      x: 210,
      y: 162,
      width: 132,
      height: 40,
      color: '#1E1E1E',
    }]);
    expect(obstaclesOf(validateLevel(LEVELS[0]!, geometry))).toEqual([]);

    const obstacle = obstaclesOf(level2)![0]!;
    for (const target of level2.targets) {
      const closestX = Math.max(obstacle.x - obstacle.width / 2, Math.min(target.x, obstacle.x + obstacle.width / 2));
      const closestY = Math.max(obstacle.y - obstacle.height / 2, Math.min(target.y, obstacle.y + obstacle.height / 2));
      expect(Math.hypot(target.x - closestX, target.y - closestY)).toBeGreaterThanOrEqual(target.radius);
    }
  });
});

describe('rectangle obstacle validation', () => {
  const valid: TestObstacle = { id: 'block', shape: 'rectangle', x: 0.8, y: 0.8, width: 0.1, height: 0.1, color: '#1E1E1E' };

  it('rejects empty and duplicate obstacle IDs', () => {
    expect(() => validateLevel(withObstacles(fixture(), [{ ...valid, id: '' }]), geometry)).toThrow(/obstacle.*id/i);
    expect(() => validateLevel(withObstacles(fixture(), [valid, { ...valid, x: 0.6 }]), geometry)).toThrow(/duplicate.*block/i);
  });

  it('rejects invalid and out-of-bounds rectangle geometry', () => {
    expect(() => validateLevel(withObstacles(fixture(), [{ ...valid, width: 0 }]), geometry)).toThrow(/obstacle.*geometry/i);
    expect(() => validateLevel(withObstacles(fixture(), [{ ...valid, x: Number.NaN }]), geometry)).toThrow(/obstacle.*geometry/i);
    expect(() => validateLevel(withObstacles(fixture(), [{ ...valid, x: 0, width: 0.2 }]), geometry)).toThrow(/obstacle.*bounds/i);
  });

  it('rejects circle penetration but allows clear rectangle corners', () => {
    const centered = { ...valid, x: 0.1, y: 0.1, width: 0.1, height: 0.1 };
    expect(() => validateLevel(withObstacles(fixture(), [centered]), geometry)).toThrow(/target 0.*obstacle block/i);
    expect(() => validateLevel(withObstacles(fixture(), [valid]), geometry)).not.toThrow();
  });
});
