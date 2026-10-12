import { describe, expect, it, vi } from 'vitest';
import { AudioManager } from '../src/audio/AudioManager';

function fakeContext() {
  const start = vi.fn();
  const oscillator = { type: 'sine', frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), start, stop: vi.fn() };
  const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  return { context: { currentTime: 1, destination: {}, state: 'running', createOscillator: () => oscillator, createGain: () => gain, resume: vi.fn() }, start };
}

describe('AudioManager', () => {
  it('creates its context lazily and mute suppresses audio nodes', () => {
    const fake = fakeContext();
    const factory = vi.fn(() => fake.context as unknown as AudioContext);
    const audio = new AudioManager(factory, () => 1000);
    expect(factory).not.toHaveBeenCalled();
    audio.setMuted(true);
    audio.playClear();
    expect(factory).not.toHaveBeenCalled();
    audio.setMuted(false);
    audio.playClear();
    expect(factory).toHaveBeenCalledOnce();
    expect(fake.start).toHaveBeenCalledOnce();
  });

  it('rate-limits repeated collisions', () => {
    const fake = fakeContext();
    let now = 1000;
    const audio = new AudioManager(() => fake.context as unknown as AudioContext, () => now);
    audio.playCollision(0.8);
    audio.playCollision(0.8);
    now += 70;
    audio.playCollision(0.8);
    expect(fake.start).toHaveBeenCalledTimes(2);
  });
});
