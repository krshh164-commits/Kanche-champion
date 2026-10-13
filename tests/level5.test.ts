// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { LEVEL_LAYOUT_BOUNDS, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, TARGET_RADIUS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../src/config';
import { LEVELS } from '../src/levels/levels';
import { validateLevel } from '../src/levels/validateLevel';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { getRemainingObjectives } from '../src/game/Game';
import { calculateOutcome } from '../src/game/rules';
import { Hud } from '../src/ui/Hud';

const geometry = {
  boundary: LEVEL_LAYOUT_BOUNDS,
  canvas: { left: 0, right: VIRTUAL_WIDTH, top: 0, bottom: VIRTUAL_HEIGHT },
  targetRadius: TARGET_RADIUS,
  shooter: { x: VIRTUAL_WIDTH / 2, y: SHOOTER_BASELINE_Y, radius: SHOOTER_RADIUS },
  safetyGap: 2,
} as const;

describe('Level 5 Arc Maze', () => {
  it('defines the requested level, marble colors, and full-clear objectives', () => {
    const level = LEVELS.find((entry) => entry.id === 5);
    if (!level) throw new Error('Level 5 must exist');
    expect(level).toMatchObject({
      id: 5,
      name: 'Arc Maze',
      moveLimit: 5,
      threeStarThreshold: 3,
      twoStarThreshold: 4,
      objectives: [{ color: 'blue', count: 3 }, { color: 'green', count: 3 }],
    });
    expect(level.targets).toHaveLength(6);
    expect(level.targets.filter(({ color }) => color === 'blue')).toHaveLength(3);
    expect(level.targets.filter(({ color }) => color === 'green')).toHaveLength(3);

    const rowCounts = [...new Set(level.targets.map(({ y }) => y))]
      .map((y) => level.targets.filter((target) => target.y === y).length)
      .sort((a, b) => b - a);
    expect(rowCounts).toEqual([3, 2, 1]);
  });

  it('validates the new three-obstacle layout with clipped edge geometry', () => {
    const resolved = validateLevel(LEVELS.find((entry) => entry.id === 5)!, geometry);
    expect(resolved.targets).toHaveLength(6);
    expect(resolved.obstacles.map(({ shape }) => shape)).toEqual(['polygon', 'polygon', 'polygon']);
    expect(resolved.obstacles.map(({ id }) => id)).toEqual([
      'level-5-top-left-square',
      'level-5-left-wedge',
      'level-5-right-block',
    ]);

    const topSquare = resolved.obstacles[0];
    const leftWedge = resolved.obstacles[1];
    const rightBlock = resolved.obstacles[2];
    expect(topSquare?.shape).toBe('polygon');
    expect(leftWedge?.shape).toBe('polygon');
    expect(rightBlock?.shape).toBe('polygon');
    if (topSquare?.shape !== 'polygon' || leftWedge?.shape !== 'polygon' || rightBlock?.shape !== 'polygon') throw new Error('Expected Level 5 obstacle geometry');

    expect(topSquare.vertices).toEqual([
      { x: 64, y: 120 },
      { x: 104, y: 120 },
      { x: 104, y: 160 },
      { x: 64, y: 160 },
    ]);

    const expectedLeftVertices = [[-21, 171.6], [117.6, 296.4], [-12.6, 436.8]];
    leftWedge.vertices.forEach((vertex, index) => {
      expect(vertex.x).toBeCloseTo(expectedLeftVertices[index]![0]!, 8);
      expect(vertex.y).toBeCloseTo(expectedLeftVertices[index]![1]!, 8);
    });
    const expectedRightVertices = [[273, 39], [441, -23.4], [441, 179.4], [352.8, 218.4]];
    rightBlock.vertices.forEach((vertex, index) => {
      expect(vertex.x).toBeCloseTo(expectedRightVertices[index]![0]!, 8);
      expect(vertex.y).toBeCloseTo(expectedRightVertices[index]![1]!, 8);
    });

    const physics = new PhysicsWorld();
    physics.loadLevel(resolved);
    const obstacleSnapshots = physics.getObstacleSnapshots();
    expect(obstacleSnapshots).toHaveLength(3);
    expect(obstacleSnapshots.every(({ isStatic }) => isStatic)).toBe(true);
    expect(obstacleSnapshots.some((obstacle) => obstacle.segments)).toBe(false);
  });

  it('tracks both color objectives to zero and wins only when all six are cleared after settlement', () => {
    const resolved = validateLevel(LEVELS.find((entry) => entry.id === 5)!, geometry);
    const colors = new Map(resolved.targets.map(({ id, color }) => [id, color]));
    const requirements = new Map([['blue', 3], ['green', 3]] as const);
    const snapshots = resolved.targets.map((target) => ({
      ...target,
      kind: 'target' as const,
      speed: 0,
      angle: 0,
      angularVelocity: 0,
    }));

    expect(getRemainingObjectives(snapshots, colors, ['blue', 'green'], requirements)).toEqual([
      { color: 'blue', remaining: 3 },
      { color: 'green', remaining: 3 },
    ]);
    expect(getRemainingObjectives([], colors, ['blue', 'green'], requirements)).toEqual([
      { color: 'blue', remaining: 0 },
      { color: 'green', remaining: 0 },
    ]);
    expect(calculateOutcome({ cleared: 6, originalTargetTotal: 6, movesLeft: 1, settled: false, terminal: false, objectivesComplete: true })).toBeNull();
    expect(calculateOutcome({ cleared: 5, originalTargetTotal: 6, movesLeft: 1, settled: true, terminal: false, objectivesComplete: false })).toBeNull();
    expect(calculateOutcome({ cleared: 6, originalTargetTotal: 6, movesLeft: 1, settled: true, terminal: false, objectivesComplete: true })).toBe('won');
  });

  it('shows the actual current level in the existing level control', () => {
    const root = document.createElement('div');
    const hud = new Hud(root, { levels: LEVELS, onSelectLevel: vi.fn() });
    hud.update({
      movesLeft: 5,
      cleared: 0,
      targetTotal: 6,
      paused: false,
      currentLevelId: 5,
      objectives: [{ color: 'blue', remaining: 3 }, { color: 'green', remaining: 3 }],
    });
    expect(root.querySelector('.level-button')?.textContent).toContain('LEVEL 5');
    expect(root.textContent).not.toContain('LEVEL 22');
  });
});
