import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../src/physics/fixedStep';

describe('FixedStepClock', () => {
  it('emits fixed steps and preserves a fractional remainder', () => {
    const clock = new FixedStepClock(1000 / 60, 5);
    expect(clock.consume(8)).toBe(0);
    expect(clock.consume(9)).toBe(1);
    expect(clock.consume(1000 / 60)).toBe(1);
  });

  it('caps catch-up after a suspended frame', () => {
    const clock = new FixedStepClock(1000 / 60, 5);
    expect(clock.consume(5000)).toBe(5);
    expect(clock.consume(0)).toBe(0);
  });

  it('can reset accumulated time', () => {
    const clock = new FixedStepClock(1000 / 60, 5);
    clock.consume(10);
    clock.reset();
    expect(clock.consume(7)).toBe(0);
  });
});
