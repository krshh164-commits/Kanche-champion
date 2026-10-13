import { describe, expect, it } from 'vitest';
import { LEVEL_LAYOUT_BOUNDS, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, TARGET_RADIUS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../src/config';
import { getRemainingObjectives } from '../src/game/Game';
import { calculateOutcome } from '../src/game/rules';
import { LEVELS } from '../src/levels/levels';
import { validateLevel } from '../src/levels/validateLevel';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { getObstaclePaint } from '../src/render/CanvasRenderer';

const geometry = {
  boundary: LEVEL_LAYOUT_BOUNDS,
  canvas: { left: 0, right: VIRTUAL_WIDTH, top: 0, bottom: VIRTUAL_HEIGHT },
  targetRadius: TARGET_RADIUS,
  shooter: { x: VIRTUAL_WIDTH / 2, y: SHOOTER_BASELINE_Y, radius: SHOOTER_RADIUS },
  safetyGap: 2,
} as const;

describe('Level 7 Hidden Center', () => {
  it('defines eight moves with one blue and three green full-clear targets', () => {
    const level = LEVELS.find((entry) => entry.id === 7);
    expect(level).toMatchObject({
      id: 7,
      name: 'Hidden Center',
      moveLimit: 8,
      objectives: [{ color: 'blue', count: 1 }, { color: 'green', count: 3 }],
    });
    expect(level?.targets).toHaveLength(4);
    expect(level?.targets.filter(({ color }) => color === 'blue')).toHaveLength(1);
    expect(level?.targets.filter(({ color }) => color === 'green')).toHaveLength(3);

    const resolved = validateLevel(level!, geometry);
    expect(resolved.targets.map(({ x, y, color }) => ({ x, y, color }))).toEqual([
      { x: 210, y: 90, color: 'green' },
      { x: 160, y: 145, color: 'blue' },
      { x: 268, y: 145, color: 'green' },
      { x: 210, y: 260, color: 'green' },
    ]);
  });

  it('keeps the screenshot obstacles static while hiding only the center square', () => {
    const resolved = validateLevel(LEVELS.find((entry) => entry.id === 7)!, geometry);
    expect(resolved.obstacles).toHaveLength(4);
    expect(resolved.obstacles.map(({ id }) => id)).toEqual([
      'level-7-top-bar',
      'level-7-left-block',
      'level-7-right-block',
      'level-7-hidden-center-square',
    ]);
    expect(resolved.obstacles[0]).toMatchObject({
      shape: 'rectangle',
      x: 210,
      y: 20,
      width: 420,
      height: 32,
    });
    const center = resolved.obstacles[3];
    expect(center).toMatchObject({
      shape: 'rectangle',
      x: 210,
      y: 380,
      width: 48,
      height: 48,
      hidden: true,
    });
    expect(getObstaclePaint(center!)).toBeNull();
    expect(resolved.obstacles.slice(0, 3).every((obstacle) => getObstaclePaint(obstacle) !== null)).toBe(true);

    const physics = new PhysicsWorld();
    physics.loadLevel(resolved);
    const bodies = physics.getObstacleSnapshots();
    expect(bodies).toHaveLength(4);
    expect(bodies.every(({ isStatic }) => isStatic)).toBe(true);
    expect(bodies[3]).toMatchObject({ x: 210, y: 380, width: 48, height: 48, isStatic: true });
  });

  it('tracks both color objectives to zero and wins only after all four clear', () => {
    const resolved = validateLevel(LEVELS.find((entry) => entry.id === 7)!, geometry);
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
