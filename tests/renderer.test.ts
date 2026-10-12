import { describe, expect, it } from 'vitest';
import * as renderer from '../src/render/CanvasRenderer';
import type { ResolvedRectangleObstacle } from '../src/levels/levelTypes';

const obstacle: ResolvedRectangleObstacle = {
  id: 'level-2-top-block',
  shape: 'rectangle',
  x: 210,
  y: 162,
  width: 132,
  height: 40,
  color: '#1E1E1E',
};

describe('rectangle obstacle rendering contract', () => {
  it('uses a flat dark fill with no stroke, shadow, or corner radius', () => {
    const api = renderer as typeof renderer & { getObstaclePaint?: (value: ResolvedRectangleObstacle) => unknown };
    expect(api.getObstaclePaint).toBeTypeOf('function');
    expect(api.getObstaclePaint!(obstacle)).toEqual({
      fill: '#1E1E1E',
      stroke: null,
      shadowBlur: 0,
      cornerRadius: 0,
    });
  });

  it('converts the resolved center and size into exact canvas bounds', () => {
    const api = renderer as typeof renderer & { getObstacleRect?: (value: ResolvedRectangleObstacle) => unknown };
    expect(api.getObstacleRect).toBeTypeOf('function');
    expect(api.getObstacleRect!(obstacle)).toEqual({ x: 144, y: 142, width: 132, height: 40 });
  });
});

describe('triangle obstacle rendering contract', () => {
  it('uses the resolved polygon vertices as the exact visible path', () => {
    const triangle = {
      id: 'triangle',
      shape: 'triangle' as const,
      vertices: [{ x: 48, y: 150 }, { x: 105, y: 155 }, { x: 62, y: 232 }] as const,
      color: '#1E1E1E' as const,
    };

    expect(renderer.getTrianglePoints(triangle)).toEqual(triangle.vertices);
    expect(renderer.getObstaclePaint(triangle)).toEqual({
      fill: '#1E1E1E',
      stroke: null,
      shadowBlur: 0,
      cornerRadius: 0,
    });
  });
});

describe('target marble rendering contract', () => {
  it('uses the existing teal glass artwork for Level 3 green marbles', () => {
    expect(renderer.getTargetTextureColor('green')).toBe('teal');
    expect(renderer.getTargetTextureColor('teal')).toBe('teal');
    expect(renderer.getTargetTextureColor('blue')).toBe('blue');
    expect(renderer.getTargetTextureColor('violet')).toBeNull();
  });

  it('keeps the cached artwork centered exactly on the physics body', () => {
    const api = renderer as typeof renderer & {
      getMarbleDrawRect?: (x: number, y: number, radius: number) => unknown;
    };

    expect(api.getMarbleDrawRect).toBeTypeOf('function');
    expect(api.getMarbleDrawRect!(210, 320, 24)).toEqual({
      x: 186,
      y: 296,
      width: 48,
      height: 48,
    });
  });

  it('rotates the complete texture around the physics center', () => {
    const api = renderer as typeof renderer & {
      getMarbleDrawTransform?: (x: number, y: number, radius: number, angle: number, initialAngle: number) => unknown;
    };

    expect(api.getMarbleDrawTransform).toBeTypeOf('function');
    expect(api.getMarbleDrawTransform!(210, 320, 24, Math.PI / 2, Math.PI / 3)).toEqual({
      translateX: 210,
      translateY: 320,
      rotation: Math.PI / 3 + Math.PI / 6 * 1.75,
      x: -24,
      y: -24,
      width: 48,
      height: 48,
    });
    expect(api.getMarbleDrawTransform!(210, 320, 24, Math.PI / 3, Math.PI / 3)).toMatchObject({
      rotation: Math.PI / 3,
    });
  });
});
