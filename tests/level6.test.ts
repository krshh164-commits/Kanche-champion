import { describe, expect, it } from 'vitest';
import { LEVEL_LAYOUT_BOUNDS, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, TARGET_RADIUS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../src/config';
import { getRemainingObjectives } from '../src/game/Game';
import { calculateOutcome } from '../src/game/rules';
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

describe('Level 6 Narrow Gates', () => {
  it('defines four full-clear targets and the requested move thresholds', () => {
    const level = LEVELS.find((entry) => entry.id === 6);
    expect(level).toMatchObject({
      id: 6,
      name: 'Narrow Gates',
      moveLimit: 6,
      threeStarThreshold: 3,
      twoStarThreshold: 4,
      objectives: [{ color: 'blue', count: 1 }, { color: 'green', count: 3 }],
    });
    expect(level?.targets).toHaveLength(4);
    expect(level?.targets.filter(({ color }) => color === 'blue')).toHaveLength(1);
    expect(level?.targets.filter(({ color }) => color === 'green')).toHaveLength(3);

    const resolved = validateLevel(level!, geometry);
    expect(resolved.targets[0]?.x).toBe(VIRTUAL_WIDTH / 2);
    expect(resolved.targets[0]?.y).toBeCloseTo(72, 8);
  });

  it('loads four aligned static rectangles including two half-clipped edge blocks', () => {
    const resolved = validateLevel(LEVELS.find((entry) => entry.id === 6)!, geometry);
    expect(resolved.targets).toHaveLength(4);
    expect(resolved.obstacles).toHaveLength(4);
    expect(resolved.obstacles.every(({ shape }) => shape === 'rectangle')).toBe(true);

    const rectangles = resolved.obstacles.map((obstacle) => {
      if (obstacle.shape !== 'rectangle') throw new Error('Level 6 obstacles must be rectangles');
      return obstacle;
    });
    const expectedRectangles = [
      { x: 210, y: 187.2, width: 71.4, height: 24 },
      { x: 210, y: 319.8, width: 142.8, height: 24 },
      { x: 0, y: 390, width: 58.8, height: 132.6, edgeClipped: true },
      { x: 420, y: 390, width: 58.8, height: 132.6, edgeClipped: true },
    ];
    rectangles.forEach((rectangle, index) => {
      const expected = expectedRectangles[index]!;
      expect(rectangle.x).toBeCloseTo(expected.x, 8);
      expect(rectangle.y).toBeCloseTo(expected.y, 8);
      expect(rectangle.width).toBeCloseTo(expected.width, 8);
      expect(rectangle.height).toBeCloseTo(expected.height, 8);
      expect(rectangle.edgeClipped).toBe(expected.edgeClipped);
    });

    const physics = new PhysicsWorld();
    physics.loadLevel(resolved);
    expect(physics.getObstacleSnapshots()).toHaveLength(4);
    expect(physics.getObstacleSnapshots().every(({ isStatic }) => isStatic)).toBe(true);
  });

  it('keeps both objectives visible through zero and wins only when all four are cleared after settlement', () => {
    const resolved = validateLevel(LEVELS.find((entry) => entry.id === 6)!, geometry);
    const colors = new Map(resolved.targets.map(({ id, color }) => [id, color]));
    const requirements = new Map([['blue', 1], ['green', 3]] as const);
    const snapshots = resolved.targets.map((target) => ({ ...target, kind: 'target' as const, speed: 0, angle: 0, angularVelocity: 0 }));

    expect(getRemainingObjectives(snapshots, colors, ['blue', 'green'], requirements)).toEqual([
      { color: 'blue', remaining: 1 },
      { color: 'green', remaining: 3 },
    ]);
    expect(getRemainingObjectives([], colors, ['blue', 'green'], requirements)).toEqual([
      { color: 'blue', remaining: 0 },
      { color: 'green', remaining: 0 },
    ]);
    expect(calculateOutcome({ cleared: 4, originalTargetTotal: 4, movesLeft: 1, settled: false, terminal: false, objectivesComplete: true })).toBeNull();
    expect(calculateOutcome({ cleared: 4, originalTargetTotal: 4, movesLeft: 1, settled: true, terminal: false, objectivesComplete: true })).toBe('won');
  });
});
