import { describe, expect, it } from 'vitest';
import {
  calculateOutcome,
  calculateStars,
  isMarbleFullyOutside,
  isTargetCleared,
  type Bounds,
  type MarbleSnapshot,
} from '../src/game/rules';
import { BOARD_BOUNDS } from '../src/config';

const boundary: Bounds = { left: 44, right: 376, top: 116, bottom: 558 };

function marble(overrides: Partial<MarbleSnapshot> = {}): MarbleSnapshot {
  return {
    id: 'target-1',
    kind: 'target',
    x: 210,
    y: 300,
    radius: 13,
    speed: 0,
    angle: 0,
    angularVelocity: 0,
    ...overrides,
  };
}

describe('radius-aware clearing', () => {
  it('detects a shooter only after its full circle crosses each board edge', () => {
    const shooter = (overrides: Partial<MarbleSnapshot>): MarbleSnapshot => marble({ kind: 'shooter', radius: 24, ...overrides });
    expect(isMarbleFullyOutside(shooter({ x: -24.01 }), BOARD_BOUNDS)).toBe(true);
    expect(isMarbleFullyOutside(shooter({ x: 444.01 }), BOARD_BOUNDS)).toBe(true);
    expect(isMarbleFullyOutside(shooter({ y: -24.01 }), BOARD_BOUNDS)).toBe(true);
    expect(isMarbleFullyOutside(shooter({ y: 804.01 }), BOARD_BOUNDS)).toBe(true);
    expect(isMarbleFullyOutside(shooter({ x: -24 }), BOARD_BOUNDS)).toBe(false);
    expect(isMarbleFullyOutside(shooter({ x: 444 }), BOARD_BOUNDS)).toBe(false);
    expect(isMarbleFullyOutside(shooter({ y: -24 }), BOARD_BOUNDS)).toBe(false);
    expect(isMarbleFullyOutside(shooter({ y: 804 }), BOARD_BOUNDS)).toBe(false);
  });

  it('uses the board edge and waits for the entire circle to leave each side', () => {
    expect(isTargetCleared(marble({ x: 433 }), BOARD_BOUNDS)).toBe(false);
    expect(isTargetCleared(marble({ x: 433.01 }), BOARD_BOUNDS)).toBe(true);
    expect(isTargetCleared(marble({ x: -13 }), BOARD_BOUNDS)).toBe(false);
    expect(isTargetCleared(marble({ x: -13.01 }), BOARD_BOUNDS)).toBe(true);
    expect(isTargetCleared(marble({ y: 793 }), BOARD_BOUNDS)).toBe(false);
    expect(isTargetCleared(marble({ y: 793.01 }), BOARD_BOUNDS)).toBe(true);
    expect(isTargetCleared(marble({ y: -13 }), BOARD_BOUNDS)).toBe(false);
    expect(isTargetCleared(marble({ y: -13.01 }), BOARD_BOUNDS)).toBe(true);
    expect(isTargetCleared(marble({ kind: 'shooter', x: 434 }), BOARD_BOUNDS)).toBe(false);
  });
  it('requires the full radius to cross each boundary', () => {
    expect(isTargetCleared(marble({ x: 389 }), boundary)).toBe(false);
    expect(isTargetCleared(marble({ x: 389.01 }), boundary)).toBe(true);
    expect(isTargetCleared(marble({ x: 31 }), boundary)).toBe(false);
    expect(isTargetCleared(marble({ x: 30.99 }), boundary)).toBe(true);
    expect(isTargetCleared(marble({ y: 571 }), boundary)).toBe(false);
    expect(isTargetCleared(marble({ y: 571.01 }), boundary)).toBe(true);
    expect(isTargetCleared(marble({ y: 103 }), boundary)).toBe(false);
    expect(isTargetCleared(marble({ y: 102.99 }), boundary)).toBe(true);
  });

  it('never clears the shooter', () => {
    expect(isTargetCleared(marble({ kind: 'shooter', x: 400 }), boundary)).toBe(false);
  });
});

describe('round results', () => {
  it('awards stars at exact thresholds', () => {
    expect(calculateStars(4, 4, 6)).toBe(3);
    expect(calculateStars(5, 4, 6)).toBe(2);
    expect(calculateStars(6, 4, 6)).toBe(2);
    expect(calculateStars(7, 4, 6)).toBe(1);
  });

  it('loses only after the final settled shot', () => {
    const input = { cleared: 7, originalTargetTotal: 12, movesLeft: 0, settled: true, terminal: false };
    expect(calculateOutcome(input)).toBe('lost');
    expect(calculateOutcome({ ...input, settled: false })).toBeNull();
  });

  it('emits no outcome before settlement or after a terminal event', () => {
    expect(calculateOutcome({ cleared: 12, originalTargetTotal: 12, movesLeft: 1, settled: false, terminal: false })).toBeNull();
    expect(calculateOutcome({ cleared: 12, originalTargetTotal: 12, movesLeft: 1, settled: true, terminal: true })).toBeNull();
    expect(calculateOutcome({ cleared: 12, originalTargetTotal: 12, movesLeft: 1, settled: true, terminal: false })).toBe('won');
  });
});
