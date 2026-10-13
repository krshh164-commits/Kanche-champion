import { describe, expect, it } from 'vitest';
import { BOARD_BOUNDS, LEVEL_LAYOUT_BOUNDS, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, TARGET_RADIUS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../src/config';
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

describe('shipped level data', () => {
  it('preserves the easy first level alongside later levels', () => {
    expect(LEVELS).toHaveLength(7);
    expect(LEVELS[0]).toMatchObject({ id: 1, name: 'First Break', moveLimit: 6 });
    expect(LEVELS[0]?.targets).toHaveLength(6);
    expect(new Set(LEVELS[0]?.targets.map((target) => target.color))).toEqual(new Set(['teal']));
  });

  it('validates every target, threshold, color, and normalized coordinate', () => {
    for (const level of LEVELS) {
      expect(level.threeStarThreshold).toBeLessThanOrEqual(level.twoStarThreshold);
      expect(level.twoStarThreshold).toBeLessThanOrEqual(level.moveLimit);
      expect(level.targets.length).toBe(level.id === 3 || level.id === 6 || level.id === 7 ? 4 : level.id >= 4 ? 7 : 6);
      const resolved = validateLevel(level, geometry);
      expect(resolved.targets).toHaveLength(level.targets.length);
      for (const [index, target] of resolved.targets.entries()) {
        const bounds = level.targets[index]?.placement === 'board' ? BOARD_BOUNDS : LEVEL_LAYOUT_BOUNDS;
        expect(target.x - target.radius).toBeGreaterThanOrEqual(bounds.left);
        expect(target.x + target.radius).toBeLessThanOrEqual(bounds.right);
        expect(target.y - target.radius).toBeGreaterThanOrEqual(bounds.top);
        expect(target.y + target.radius).toBeLessThanOrEqual(bounds.bottom);
      }
    }
  });
});

function fixture(overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    id: 99,
    name: 'Fixture',
    moveLimit: 4,
    threeStarThreshold: 2,
    twoStarThreshold: 3,
    targets: [{ x: 0.5, y: 0.5, color: 'teal' }],
    ...overrides,
  };
}

describe('level validation failures', () => {
  it('rejects non-finite and out-of-range coordinates', () => {
    expect(() => validateLevel(fixture({ targets: [{ x: Number.NaN, y: 0.5, color: 'teal' }] }), geometry)).toThrow(/level 99.*target 0/i);
    expect(() => validateLevel(fixture({ targets: [{ x: 1.1, y: 0.5, color: 'teal' }] }), geometry)).toThrow(/level 99.*target 0/i);
  });

  it('rejects overlapping targets with their indexes', () => {
    const level = fixture({ targets: [
      { x: 0.5, y: 0.5, color: 'teal' },
      { x: 0.51, y: 0.5, color: 'blue' },
    ] });
    expect(() => validateLevel(level, geometry)).toThrow(/level 99.*targets 0 and 1/i);
  });

  it('rejects invalid thresholds and colors', () => {
    expect(() => validateLevel(fixture({ threeStarThreshold: 4, twoStarThreshold: 2 }), geometry)).toThrow(/threshold/i);
    const invalidColor = fixture({ targets: [{ x: 0.5, y: 0.5, color: 'red' as never }] });
    expect(() => validateLevel(invalidColor, geometry)).toThrow(/color/i);
  });
});
