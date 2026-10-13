import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { LEVEL_LAYOUT_BOUNDS, PHYSICS, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, TARGET_RADIUS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../src/config';
import { LEVELS } from '../src/levels/levels';
import { validateLevel } from '../src/levels/validateLevel';
import type { LevelGeometry } from '../src/levels/levelTypes';
import type { LevelDefinition } from '../src/levels/levelTypes';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

const geometry: LevelGeometry = {
  boundary: LEVEL_LAYOUT_BOUNDS,
  canvas: { left: 0, top: 0, right: VIRTUAL_WIDTH, bottom: VIRTUAL_HEIGHT },
  targetRadius: TARGET_RADIUS,
  shooter: { x: VIRTUAL_WIDTH / 2, y: SHOOTER_BASELINE_Y, radius: SHOOTER_RADIUS },
  safetyGap: 2,
};

function world() {
  const physics = new PhysicsWorld();
  physics.loadLevel(validateLevel(LEVELS[0]!, geometry));
  return physics;
}

type SpinSnapshot = ReturnType<PhysicsWorld['getSnapshots']>[number] & {
  angle?: number;
  angularVelocity?: number;
};

const impactLevel: LevelDefinition = {
  id: 99,
  name: 'Impact Test',
  moveLimit: 1,
  threeStarThreshold: 1,
  twoStarThreshold: 1,
  targets: [{ x: 0.5, y: 0.6598984771573604, color: 'teal' }],
};

function runGlancingImpact(shooterX: number, speed: number): { peak: number; signedPeak: number; final: SpinSnapshot[] } {
  const physics = new PhysicsWorld();
  physics.loadLevel(validateLevel(impactLevel, geometry));
  physics.setShooterX(shooterX);
  physics.applyShot({ x: 0, y: -speed });
  let signedPeak = 0;
  for (let frame = 0; frame < 45; frame += 1) {
    physics.step(PHYSICS.fixedStepMs);
    const target = physics.getSnapshots().find((body) => body.kind === 'target') as SpinSnapshot;
    if (Math.abs(target.angularVelocity ?? 0) > Math.abs(signedPeak)) signedPeak = target.angularVelocity ?? 0;
  }
  return { peak: Math.abs(signedPeak), signedPeak, final: physics.getSnapshots() as SpinSnapshot[] };
}

describe('PhysicsWorld', () => {
  it('resets the existing shooter completely and can suspend collisions', () => {
    const physics = world();
    const inspectable = physics as unknown as { shooter: Matter.Body | null };
    const shooter = inspectable.shooter!;
    Matter.Body.setAngle(shooter, 1.2);
    Matter.Body.setAngularVelocity(shooter, 0.4);
    shooter.force.x = 3;
    shooter.force.y = -2;
    shooter.torque = 5;

    physics.resetShooter(137, false);

    expect(physics.getSnapshots().find((body) => body.kind === 'shooter')).toMatchObject({
      x: 137,
      y: SHOOTER_BASELINE_Y,
      speed: 0,
      angle: 0,
      angularVelocity: 0,
    });
    expect(shooter.force).toEqual({ x: 0, y: 0 });
    expect(shooter.torque).toBe(0);
    expect(shooter.collisionFilter.mask).toBe(0);

    physics.resetShooter(137, true);
    expect(shooter.collisionFilter.mask).not.toBe(0);
  });

  it('lets moving marbles travel past every board edge without a wall bounce', () => {
    const directions = [
      { velocity: { x: -18, y: 0 }, crossed: (x: number, y: number) => x < -24 },
      { velocity: { x: 18, y: 0 }, crossed: (x: number, y: number) => x > VIRTUAL_WIDTH + 24 },
      { velocity: { x: 0, y: -18 }, crossed: (x: number, y: number) => y < -24 },
      { velocity: { x: 0, y: 18 }, crossed: (x: number, y: number) => y > VIRTUAL_HEIGHT + 24 },
    ];
    for (const { velocity, crossed } of directions) {
      const physics = new PhysicsWorld();
      physics.loadLevel({
        definition: { id: 99, name: 'Open Board', moveLimit: 1, threeStarThreshold: 1, twoStarThreshold: 1, targets: [] },
        targets: [],
        obstacles: [],
      });
      physics.applyShot(velocity);
      for (let frame = 0; frame < 160; frame += 1) physics.step(PHYSICS.fixedStepMs);
      const shooter = physics.getSnapshots()[0]!;
      expect(crossed(shooter.x, shooter.y)).toBe(true);
    }
  });
  it('creates 48px marbles with no target overlaps', () => {
    const physics = world();
    const targets = physics.getSnapshots().filter((body) => body.kind === 'target');
    const shooter = physics.getSnapshots().find((body) => body.kind === 'shooter');
    expect(targets).toHaveLength(6);
    expect(new Set(targets.map((target) => target.radius))).toEqual(new Set([24]));
    expect(shooter?.radius).toBe(24);
    expect(new Set(physics.getTargetMasses().map((mass) => mass.toFixed(8))).size).toBe(1);
    for (let a = 0; a < targets.length; a += 1) {
      for (let b = a + 1; b < targets.length; b += 1) {
        expect(Math.hypot(targets[a]!.x - targets[b]!.x, targets[a]!.y - targets[b]!.y)).toBeGreaterThanOrEqual(TARGET_RADIUS * 2);
      }
    }
  });

  it('transfers momentum and decelerates smoothly', () => {
    const physics = world();
    physics.setShooterX(VIRTUAL_WIDTH / 2);
    physics.applyShot({ x: 0, y: -18 });
    let peakTargetSpeed = 0;
    for (let frame = 0; frame < 80; frame += 1) {
      physics.step(PHYSICS.fixedStepMs);
      peakTargetSpeed = Math.max(peakTargetSpeed, ...physics.getSnapshots().filter((b) => b.kind === 'target').map((b) => b.speed));
    }
    const speedAfterContact = physics.getSnapshots().reduce((sum, body) => sum + body.speed, 0);
    for (let frame = 0; frame < 180; frame += 1) physics.step(PHYSICS.fixedStepMs);
    const laterSpeed = physics.getSnapshots().reduce((sum, body) => sum + body.speed, 0);
    expect(peakTargetSpeed).toBeGreaterThan(0.1);
    expect(laterSpeed).toBeLessThan(speedAfterContact);
  });

  it('settles a maximum-speed striker within four seconds at 60 Hz', () => {
    const physics = new PhysicsWorld();
    physics.loadLevel({
      definition: { id: 99, name: 'Stopping Test', moveLimit: 1, threeStarThreshold: 1, twoStarThreshold: 1, targets: [] },
      targets: [],
      obstacles: [],
    });
    physics.applyShot({ x: 20, y: 0 });

    for (let frame = 0; frame < 240; frame += 1) physics.step(PHYSICS.fixedStepMs);

    expect(physics.allBodiesSettled()).toBe(true);
    expect(physics.getSnapshots()[0]?.speed).toBe(0);
  });

  it('replays identical shots deterministically within tolerance', () => {
    const run = () => {
      const physics = world();
      physics.applyShot({ x: 1.25, y: -16 });
      for (let frame = 0; frame < 120; frame += 1) physics.step(PHYSICS.fixedStepMs);
      return physics.getSnapshots().map(({ id, x, y, speed }) => ({ id, x, y, speed }));
    };
    const first = run();
    const second = run();
    first.forEach((body, index) => {
      expect(body.id).toBe(second[index]!.id);
      expect(body.x).toBeCloseTo(second[index]!.x, 8);
      expect(body.y).toBeCloseTo(second[index]!.y, 8);
      expect(body.speed).toBeCloseTo(second[index]!.speed, 8);
    });
  });

  it('assigns varied deterministic target angles that survive a restart', () => {
    const first = world().getSnapshots().filter((body) => body.kind === 'target') as SpinSnapshot[];
    const second = world().getSnapshots().filter((body) => body.kind === 'target') as SpinSnapshot[];
    const firstAngles = first.map((body) => body.angle);
    const secondAngles = second.map((body) => body.angle);

    expect(firstAngles.every((angle) => Number.isFinite(angle))).toBe(true);
    expect(new Set(firstAngles.map((angle) => angle!.toFixed(4))).size).toBeGreaterThanOrEqual(5);
    expect(secondAngles).toEqual(firstAngles);
    const steps = firstAngles.slice(1).map((angle, index) => (angle! - firstAngles[index]!).toFixed(4));
    expect(new Set(steps).size).toBeGreaterThan(2);
  });

  it('creates little target spin for a center hit and more for a glancing hit', () => {
    const centered = runGlancingImpact(210, 14);
    const glancing = runGlancingImpact(190, 14);

    expect(glancing.peak).toBeGreaterThan(0.001);
    expect(centered.peak).toBeLessThan(glancing.peak * 0.2);
  });

  it('reverses spin direction on opposite sides and scales spin with impact strength', () => {
    const leftWeak = runGlancingImpact(190, 8);
    const leftStrong = runGlancingImpact(190, 16);
    const rightStrong = runGlancingImpact(230, 16);

    expect(leftStrong.peak).toBeGreaterThan(leftWeak.peak * 1.4);
    expect(leftStrong.signedPeak * rightStrong.signedPeak).toBeLessThan(0);
  });

  it('damps impact rotation naturally and stops it when the round settles', () => {
    const physics = new PhysicsWorld();
    physics.loadLevel(validateLevel(impactLevel, geometry));
    physics.setShooterX(190);
    physics.applyShot({ x: 0, y: -16 });
    for (let frame = 0; frame < 45; frame += 1) physics.step(PHYSICS.fixedStepMs);
    const afterImpact = Math.abs((physics.getSnapshots().find((body) => body.kind === 'target') as SpinSnapshot).angularVelocity ?? 0);
    for (let frame = 0; frame < 15; frame += 1) physics.step(PHYSICS.fixedStepMs);
    const afterDamping = Math.abs((physics.getSnapshots().find((body) => body.kind === 'target') as SpinSnapshot).angularVelocity ?? 0);

    expect(afterImpact).toBeGreaterThan(0.001);
    expect(afterDamping).toBeLessThan(afterImpact);

    for (let frame = 0; frame < 1200 && !physics.allBodiesSettled(); frame += 1) physics.step(PHYSICS.fixedStepMs);
    expect(physics.allBodiesSettled()).toBe(true);
    expect((physics.getSnapshots() as SpinSnapshot[]).every((body) => body.angularVelocity === 0)).toBe(true);
  });

  it('requires consecutive slow frames and safely removes a target once', () => {
    const physics = world();
    for (let frame = 0; frame < PHYSICS.settleFrames - 1; frame += 1) physics.step(PHYSICS.fixedStepMs);
    expect(physics.allBodiesSettled()).toBe(false);
    physics.step(PHYSICS.fixedStepMs);
    expect(physics.allBodiesSettled()).toBe(true);
    const targetId = physics.getSnapshots().find((body) => body.kind === 'target')!.id;
    expect(physics.removeTarget(targetId)).toBe(true);
    expect(physics.removeTarget(targetId)).toBe(false);
    expect(physics.getSnapshots().some((body) => body.id === targetId)).toBe(false);
  });

  it('settles nearly still bodies quickly without stopping bodies that are still moving', () => {
    const physics = new PhysicsWorld();
    physics.loadLevel({
      definition: { id: 99, name: 'Settlement Test', moveLimit: 1, threeStarThreshold: 1, twoStarThreshold: 1, targets: [] },
      targets: [],
      obstacles: [],
    });
    const inspectable = physics as unknown as { shooter: Matter.Body };

    Matter.Body.setVelocity(inspectable.shooter, { x: PHYSICS.settleSpeed * 0.8, y: 0 });
    for (let frame = 0; frame < PHYSICS.settleFrames - 1; frame += 1) physics.step(PHYSICS.fixedStepMs);
    expect(physics.allBodiesSettled()).toBe(false);
    physics.step(PHYSICS.fixedStepMs);
    expect(physics.allBodiesSettled()).toBe(true);

    physics.resetShooter();
    for (let frame = 0; frame < PHYSICS.settleFrames * 2; frame += 1) {
      Matter.Body.setVelocity(inspectable.shooter, { x: PHYSICS.settleSpeed * 4, y: 0 });
      physics.step(PHYSICS.fixedStepMs);
    }
    expect(physics.allBodiesSettled()).toBe(false);
    expect(physics.getSnapshots()[0]!.speed).toBeGreaterThan(PHYSICS.settleSpeed);
  });

  it('creates one immovable Level 2 obstacle without counting it as a marble', () => {
    const physics = new PhysicsWorld();
    physics.loadLevel(validateLevel(LEVELS.find((level) => level.id === 2)!, geometry));
    const inspectable = physics as unknown as {
      getObstacleSnapshots?: () => Array<{ id: string; x: number; y: number; width: number; height: number; isStatic: boolean }>;
    };

    expect(inspectable.getObstacleSnapshots).toBeTypeOf('function');
    expect(inspectable.getObstacleSnapshots!()).toEqual([{
      id: 'level-2-top-block',
      x: 210,
      y: 162,
      width: 132,
      height: 40,
      isStatic: true,
    }]);
    expect(physics.getSnapshots().filter((body) => body.kind === 'target')).toHaveLength(6);
    expect(physics.getSnapshots().filter((body) => body.kind === 'shooter')).toHaveLength(1);
    expect(physics.getTargetMasses()).toHaveLength(6);

    for (let frame = 0; frame < 30; frame += 1) physics.step(PHYSICS.fixedStepMs);
    expect(inspectable.getObstacleSnapshots!()[0]).toMatchObject({ x: 210, y: 162, isStatic: true });
  });

  it('creates two immovable Level 3 polygon bodies without counting them as marbles', () => {
    const physics = new PhysicsWorld();
    physics.loadLevel(validateLevel(LEVELS.find((level) => level.id === 3)!, geometry));
    const obstacles = physics.getObstacleSnapshots();

    expect(obstacles).toHaveLength(2);
    expect(obstacles.every((obstacle) => obstacle.isStatic)).toBe(true);
    expect(obstacles.map((obstacle) => obstacle.id)).toEqual([
      'level-3-left-triangle',
      'level-3-right-triangle',
    ]);
    expect(obstacles.map((obstacle) => obstacle.vertices)).toEqual([
      [{ x: 48, y: 150 }, { x: 105, y: 155 }, { x: 62, y: 232 }],
      [{ x: 270, y: 128 }, { x: 370, y: 150 }, { x: 330, y: 235 }],
    ]);
    expect(physics.getSnapshots().filter((body) => body.kind === 'target')).toHaveLength(4);
    expect(physics.getTargetMasses()).toHaveLength(4);
  });

  it('removes Level 2 obstacles when Level 1 loads', () => {
    const physics = new PhysicsWorld();
    const inspectable = physics as unknown as { getObstacleSnapshots?: () => unknown[] };
    physics.loadLevel(validateLevel(LEVELS.find((level) => level.id === 2)!, geometry));
    expect(inspectable.getObstacleSnapshots).toBeTypeOf('function');
    expect(inspectable.getObstacleSnapshots!()).toHaveLength(1);

    physics.loadLevel(validateLevel(LEVELS[0]!, geometry));
    expect(inspectable.getObstacleSnapshots!()).toEqual([]);
  });
});
