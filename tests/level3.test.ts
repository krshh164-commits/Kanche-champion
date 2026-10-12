import { describe, expect, it } from 'vitest';
import { LEVEL_LAYOUT_BOUNDS, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, TARGET_RADIUS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../src/config';
import { LEVELS } from '../src/levels/levels';
import { validateLevel } from '../src/levels/validateLevel';

describe('Level 3', () => {
  it('loads two green and two blue targets with two non-overlapping triangles', () => {
    const level = LEVELS.find((entry) => entry.id === 3);
    expect(level).toBeDefined();
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
    expect(resolved.obstacles).toEqual([
      {
        id: 'level-3-left-triangle',
        shape: 'triangle',
        vertices: [{ x: 48, y: 150 }, { x: 105, y: 155 }, { x: 62, y: 232 }],
        color: '#1E1E1E',
      },
      {
        id: 'level-3-right-triangle',
        shape: 'triangle',
        vertices: [{ x: 270, y: 128 }, { x: 370, y: 150 }, { x: 330, y: 235 }],
        color: '#1E1E1E',
      },
    ]);
  });
});
