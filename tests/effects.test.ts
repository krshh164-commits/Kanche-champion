import { describe, expect, it } from 'vitest';
import { EffectSystem, getDebugPrimitives } from '../src/render/effects';
import { getMarblePaint } from '../src/render/CanvasRenderer';

const marble = { id: 'target-1', kind: 'target' as const, x: 100, y: 100, radius: 13, speed: 0, angle: 0.75, angularVelocity: 0 };

describe('EffectSystem', () => {
  it('creates one finite burst and one fading marble per clear', () => {
    const effects = new EffectSystem(() => 0.5);
    effects.spawnClearEffect(marble, 'teal');
    expect(effects.snapshot().particles).toHaveLength(10);
    expect(effects.snapshot().fades).toHaveLength(1);
    effects.update(250);
    expect(effects.snapshot().fades[0]?.alpha).toBeLessThan(1);
    effects.update(1000);
    expect(effects.snapshot()).toEqual({ particles: [], fades: [] });
  });

  it('reset removes every effect', () => {
    const effects = new EffectSystem();
    effects.spawnClearEffect(marble, 'blue');
    effects.clearEffects();
    expect(effects.snapshot()).toEqual({ particles: [], fades: [] });
  });

  it('emits debug primitives only when explicitly enabled', () => {
    expect(getDebugPrimitives([marble], false)).toEqual([]);
    expect(getDebugPrimitives([marble], true)).toHaveLength(1);
  });

  it('uses a flat circular marble paint with no glow or highlight', () => {
    expect(getMarblePaint('#51B69A')).toEqual({
      fill: '#51B69A',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      highlight: false,
    });
  });
});
