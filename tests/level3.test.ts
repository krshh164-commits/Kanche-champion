import { describe, expect, it } from 'vitest';
import { LEVEL_LAYOUT_BOUNDS, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, TARGET_RADIUS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../src/config';
import { LEVELS } from '../src/levels/levels';
import { validateLevel } from '../src/levels/validateLevel';

describe('Level 3', () => {
  it('loads six moves, two green and two blue targets between two large edge-clipped blocks', () => {
    const level = LEVELS.find((entry) => entry.id === 3);
    expect(level).toMatchObject({
      moveLimit: 6,
      threeStarThreshold: 4,
      twoStarThreshold: 6,
    });
    const resolved = validateLevel(level!, {
      boundary: LEVEL_LAYOUT_BOUNDS,
      canvas: { left: 0, right: VIRTUAL_WIDTH, top: 0, bottom: VIRTUAL_HEIGHT },
      targetRadius: TARGET_RADIUS,
      shooter: { x: VIRTUAL_WIDTH / 2, y: SHOOTER_BASELINE_Y, radius: SHOOTER_RADIUS },
      safetyGap: 2,
    });
    expect(resolved.targets).toHaveLength(4);
    expect(resolved.targets.filter((target) => target.color === 'green')).toHaveLength(2);
    expect(resolved.targets.filter((target) => target.color === 'blue')).toHaveLength(2);
    expect(resolved.targets.map(({ x, y, color }) => ({ x, y, color }))).toEqual([
      { x: 100, y: 170, color: 'blue' },
      { x: 190, y: 250, color: 'green' },
      { x: 270, y: 380, color: 'blue' },
      { x: 150, y: 440, color: 'green' },
    ]);
    expect(resolved.obstacles).toEqual([
      {
        id: 'level-3-upper-right-block',
        shape: 'polygon',
        vertices: [{ x: 134, y: 138 }, { x: 400, y: 134 }, { x: 400, y: 330 }],
        edgeClipped: true,
        color: '#1E1E1E',
      },
      {
        id: 'level-3-left-wedge',
        shape: 'polygon',
        vertices: [{ x: 20, y: 205 }, { x: 205, y: 333 }, { x: 20, y: 462 }],
        edgeClipped: true,
        color: '#1E1E1E',
      },
    ]);
  });
});
