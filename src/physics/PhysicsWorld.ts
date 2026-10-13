import Matter from 'matter-js';
import {
  PHYSICS,
  SHOOTER_BASELINE_Y,
  SHOOTER_RADIUS,
  VIRTUAL_WIDTH,
} from '../config';
import type { MarbleSnapshot, Point } from '../game/rules';
import { getArcSegmentVertices } from '../levels/obstacleGeometry';
import type { ResolvedLevel } from '../levels/levelTypes';
import type { ObstacleVertex, ResolvedObstacle } from '../levels/levelTypes';

export type PhysicsEvent =
  | { type: 'collision'; intensity: number }
  | { type: 'shooter-obstacle-collision'; obstacleId: string };

interface BodyInfo {
  id: string;
  kind: 'target' | 'shooter';
  radius: number;
  initialAngle: number;
}

function seededAngle(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000 * Math.PI * 2;
}

export interface ObstacleSnapshot {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  vertices?: readonly ObstacleVertex[];
  segments?: readonly (readonly ObstacleVertex[])[];
  isStatic: boolean;
}

interface PhysicsObstacle {
  bodies: Matter.Body[];
  source: ResolvedObstacle;
}

export class PhysicsWorld {
  private engine = Matter.Engine.create({ enableSleeping: true, gravity: { x: 0, y: 0 } });
  private targets = new Map<string, Matter.Body>();
  private obstacles = new Map<string, PhysicsObstacle>();
  private shooter: Matter.Body | null = null;
  private shooterCollisionMask = 0xFFFFFFFF;
  private info = new Map<number, BodyInfo>();
  private removedTargets = new Set<string>();
  private slowFrames = 0;
  private pendingEvents: PhysicsEvent[] = [];

  constructor() {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const relative = Matter.Vector.sub(pair.bodyA.velocity, pair.bodyB.velocity);
        const intensity = Matter.Vector.magnitude(relative);
        if (intensity > 0.25) this.pendingEvents.push({ type: 'collision', intensity });
        const shooterObstacleId = pair.bodyA.label === 'shooter' && this.obstacles.has(pair.bodyB.label)
          ? pair.bodyB.label
          : pair.bodyB.label === 'shooter' && this.obstacles.has(pair.bodyA.label)
            ? pair.bodyA.label
            : null;
        if (shooterObstacleId) this.pendingEvents.push({ type: 'shooter-obstacle-collision', obstacleId: shooterObstacleId });
      }
    });
  }

  loadLevel(level: ResolvedLevel): void {
    Matter.Composite.clear(this.engine.world, false, true);
    Matter.Engine.clear(this.engine);
    this.targets.clear();
    this.obstacles.clear();
    this.info.clear();
    this.removedTargets.clear();
    this.pendingEvents = [];
    this.slowFrames = 0;

    for (const obstacle of level.obstacles) {
      const options: Matter.IChamferableBodyDefinition = {
        isStatic: true,
        restitution: PHYSICS.restitution,
        friction: PHYSICS.collisionFriction,
        label: obstacle.id,
      };
      const bodies = obstacle.shape === 'rectangle'
        ? [Matter.Bodies.rectangle(obstacle.x, obstacle.y, obstacle.width, obstacle.height, options)]
        : obstacle.shape === 'arc'
          ? getArcSegmentVertices(obstacle).map((vertices) => this.createPolygonBody(vertices, options))
          : [this.createPolygonBody(obstacle.vertices, options)];
      this.obstacles.set(obstacle.id, { bodies, source: obstacle });
      Matter.Composite.add(this.engine.world, bodies);
    }

    for (const target of level.targets) {
      const initialAngle = seededAngle(target.id);
      const body = Matter.Bodies.circle(target.x, target.y, target.radius, {
        label: target.id,
        restitution: PHYSICS.restitution,
        friction: PHYSICS.collisionFriction,
        frictionStatic: 0,
        frictionAir: PHYSICS.frictionAir,
        density: PHYSICS.targetDensity,
        sleepThreshold: 30,
      });
      Matter.Body.setAngle(body, initialAngle);
      this.targets.set(target.id, body);
      this.info.set(body.id, { id: target.id, kind: 'target', radius: target.radius, initialAngle });
      Matter.Composite.add(this.engine.world, body);
    }

    this.shooter = Matter.Bodies.circle(VIRTUAL_WIDTH / 2, SHOOTER_BASELINE_Y, SHOOTER_RADIUS, {
      label: 'shooter',
      restitution: PHYSICS.restitution,
      friction: PHYSICS.collisionFriction,
      frictionStatic: 0,
      frictionAir: PHYSICS.frictionAir,
      density: PHYSICS.shooterDensity,
      sleepThreshold: 30,
    });
    this.shooterCollisionMask = this.shooter.collisionFilter.mask ?? 0xFFFFFFFF;
    this.info.set(this.shooter.id, { id: 'shooter', kind: 'shooter', radius: SHOOTER_RADIUS, initialAngle: 0 });
    Matter.Composite.add(this.engine.world, this.shooter);
  }

  private createPolygonBody(vertices: readonly ObstacleVertex[], options: Matter.IChamferableBodyDefinition): Matter.Body {
    const center = vertices.reduce((sum, vertex) => ({ x: sum.x + vertex.x / vertices.length, y: sum.y + vertex.y / vertices.length }), { x: 0, y: 0 });
    return Matter.Bodies.fromVertices(center.x, center.y, [vertices.map((vertex) => ({ ...vertex }))], options);
  }

  setShooterX(x: number): void {
    if (!this.shooter) return;
    Matter.Sleeping.set(this.shooter, false);
    Matter.Body.setPosition(this.shooter, { x, y: SHOOTER_BASELINE_Y });
    Matter.Body.setVelocity(this.shooter, { x: 0, y: 0 });
  }

  applyShot(velocity: Point): void {
    if (!this.shooter) return;
    this.slowFrames = 0;
    Matter.Sleeping.set(this.shooter, false);
    Matter.Body.setVelocity(this.shooter, velocity);
  }

  step(deltaMs: number): PhysicsEvent[] {
    this.pendingEvents = [];
    Matter.Engine.update(this.engine, deltaMs);
    const active = this.activeBodies();
    if (active.length > 0 && active.every((body) => (
      body.speed <= PHYSICS.settleSpeed
      && Math.abs(body.angularVelocity) <= PHYSICS.settleAngularSpeed
    ))) this.slowFrames += 1;
    else this.slowFrames = 0;

    if (this.slowFrames >= PHYSICS.settleFrames) {
      for (const body of active) {
        Matter.Body.setVelocity(body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(body, 0);
        Matter.Sleeping.set(body, true);
      }
    }
    return [...this.pendingEvents];
  }

  private activeBodies(): Matter.Body[] {
    return [...this.targets.values(), ...(this.shooter ? [this.shooter] : [])];
  }

  getSnapshots(): MarbleSnapshot[] {
    return this.activeBodies().map((body) => {
      const meta = this.info.get(body.id)!;
      return {
        id: meta.id,
        kind: meta.kind,
        x: body.position.x,
        y: body.position.y,
        radius: meta.radius,
        speed: body.speed,
        angle: body.angle,
        initialAngle: meta.initialAngle,
        angularVelocity: body.angularVelocity,
        velocity: { x: body.velocity.x, y: body.velocity.y },
      };
    });
  }

  getTargetMasses(): number[] {
    return [...this.targets.values()].map((body) => body.mass);
  }

  getObstacleSnapshots(): ObstacleSnapshot[] {
    return [...this.obstacles.entries()].map(([id, obstacle]) => {
      if (obstacle.source.shape === 'rectangle') return {
          id,
          x: obstacle.bodies[0]!.position.x,
          y: obstacle.bodies[0]!.position.y,
          width: obstacle.source.width,
          height: obstacle.source.height,
          isStatic: obstacle.bodies.every((body) => body.isStatic),
        };
      if (obstacle.source.shape === 'arc') return {
        id,
        x: obstacle.source.x,
        y: obstacle.source.y,
        segments: obstacle.bodies.map((body) => body.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }))),
        isStatic: obstacle.bodies.every((body) => body.isStatic),
      };
      return {
          id,
          x: obstacle.bodies[0]!.position.x,
          y: obstacle.bodies[0]!.position.y,
          vertices: obstacle.bodies[0]!.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
          isStatic: obstacle.bodies.every((body) => body.isStatic),
        };
    });
  }

  removeTarget(id: string): boolean {
    if (this.removedTargets.has(id)) return false;
    const body = this.targets.get(id);
    if (!body) return false;
    this.removedTargets.add(id);
    this.targets.delete(id);
    this.info.delete(body.id);
    Matter.Composite.remove(this.engine.world, body, true);
    return true;
  }

  allBodiesSettled(): boolean {
    return this.slowFrames >= PHYSICS.settleFrames;
  }

  resetShooter(x = VIRTUAL_WIDTH / 2, collisionsEnabled = true): void {
    if (!this.shooter) return;
    Matter.Sleeping.set(this.shooter, false);
    Matter.Body.setPosition(this.shooter, { x, y: SHOOTER_BASELINE_Y });
    Matter.Body.setVelocity(this.shooter, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.shooter, 0);
    Matter.Body.setAngle(this.shooter, 0);
    this.shooter.force.x = 0;
    this.shooter.force.y = 0;
    this.shooter.torque = 0;
    this.shooter.collisionFilter.mask = collisionsEnabled ? this.shooterCollisionMask : 0;
    this.slowFrames = 0;
  }
}
