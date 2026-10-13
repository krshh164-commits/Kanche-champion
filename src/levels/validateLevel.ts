import { getArcSegmentVertices } from './obstacleGeometry';
import type { LevelDefinition, LevelGeometry, ObstacleVertex, ResolvedArcObstacle, ResolvedLevel, ResolvedObstacle, ResolvedPolygonObstacle, ResolvedRectangleObstacle, ResolvedTarget, TargetColor } from './levelTypes';

const ALLOWED_COLORS: readonly TargetColor[] = ['teal', 'blue', 'green', 'violet'];

export function resolveLevel(level: LevelDefinition, geometry: LevelGeometry): ResolvedLevel {
  const { boundary, targetRadius: radius } = geometry;
  const boundaryWidth = boundary.right - boundary.left;
  const boundaryHeight = boundary.bottom - boundary.top;

  return {
    definition: level,
    targets: level.targets.map((target, index) => {
      const placementBounds = target.placement === 'board' ? geometry.canvas : boundary;
      const usableWidth = placementBounds.right - placementBounds.left - radius * 2;
      const usableHeight = placementBounds.bottom - placementBounds.top - radius * 2;
      return {
        id: `level-${level.id}-target-${index}`,
        x: placementBounds.left + radius + target.x * usableWidth,
        y: placementBounds.top + radius + target.y * usableHeight,
        radius,
        color: target.color,
      };
    }),
    obstacles: (level.obstacles ?? []).map((obstacle): ResolvedObstacle => {
      if (obstacle.shape === 'rectangle') return {
          id: obstacle.id,
          shape: obstacle.shape,
          x: boundary.left + obstacle.x * boundaryWidth,
          y: boundary.top + obstacle.y * boundaryHeight,
          width: obstacle.width * boundaryWidth,
          height: obstacle.height * boundaryHeight,
          edgeClipped: obstacle.edgeClipped,
          hidden: obstacle.hidden,
          color: obstacle.color,
        };
      if (obstacle.shape === 'arc') return {
        id: obstacle.id,
        shape: obstacle.shape,
        x: boundary.left + obstacle.x * boundaryWidth,
        y: boundary.top + obstacle.y * boundaryHeight,
        innerRadius: obstacle.innerRadius * boundaryWidth,
        outerRadius: obstacle.outerRadius * boundaryWidth,
        startAngle: obstacle.startAngle,
        endAngle: obstacle.endAngle,
        segments: obstacle.segments,
        edgeClipped: obstacle.edgeClipped,
        color: obstacle.color,
      };
      return {
          id: obstacle.id,
          shape: obstacle.shape,
          vertices: obstacle.vertices.map((vertex) => ({
            x: boundary.left + vertex.x * boundaryWidth,
            y: boundary.top + vertex.y * boundaryHeight,
          })) as [ObstacleVertex, ObstacleVertex, ObstacleVertex],
          edgeClipped: obstacle.shape === 'polygon' ? obstacle.edgeClipped : undefined,
          color: obstacle.color,
        } as ResolvedObstacle;
    }),
  };
}

function inside(body: { x: number; y: number; radius: number }, bounds: LevelGeometry['boundary']): boolean {
  return body.x - body.radius >= bounds.left && body.x + body.radius <= bounds.right
    && body.y - body.radius >= bounds.top && body.y + body.radius <= bounds.bottom;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rectangleInside(rectangle: ResolvedRectangleObstacle, bounds: LevelGeometry['boundary']): boolean {
  return rectangle.x - rectangle.width / 2 >= bounds.left && rectangle.x + rectangle.width / 2 <= bounds.right
    && rectangle.y - rectangle.height / 2 >= bounds.top && rectangle.y + rectangle.height / 2 <= bounds.bottom;
}

function rectangleIntersectsBounds(rectangle: ResolvedRectangleObstacle, bounds: LevelGeometry['boundary']): boolean {
  return rectangle.x + rectangle.width / 2 >= bounds.left && rectangle.x - rectangle.width / 2 <= bounds.right
    && rectangle.y + rectangle.height / 2 >= bounds.top && rectangle.y - rectangle.height / 2 <= bounds.bottom;
}

function circleOverlapsRectangle(circle: ResolvedTarget, rectangle: ResolvedRectangleObstacle): boolean {
  const closestX = Math.max(rectangle.x - rectangle.width / 2, Math.min(circle.x, rectangle.x + rectangle.width / 2));
  const closestY = Math.max(rectangle.y - rectangle.height / 2, Math.min(circle.y, rectangle.y + rectangle.height / 2));
  return Math.hypot(circle.x - closestX, circle.y - closestY) < circle.radius;
}

function pointInsideBounds(point: ObstacleVertex, bounds: LevelGeometry['boundary']): boolean {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}

function polygonInside(polygon: Pick<ResolvedPolygonObstacle, 'vertices'>, bounds: LevelGeometry['boundary']): boolean {
  return polygon.vertices.every((vertex) => pointInsideBounds(vertex, bounds));
}

function distanceToSegment(point: ObstacleVertex, start: ObstacleVertex, end: ObstacleVertex): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + amount * dx), point.y - (start.y + amount * dy));
}

function pointInsidePolygon(point: ObstacleVertex, vertices: readonly ObstacleVertex[]): boolean {
  const signs = vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length]!;
    return (point.x - next.x) * (vertex.y - next.y) - (vertex.x - next.x) * (point.y - next.y);
  });
  return signs.every((value) => value >= 0) || signs.every((value) => value <= 0);
}

function circleOverlapsPolygon(circle: ResolvedTarget, vertices: readonly ObstacleVertex[]): boolean {
  if (pointInsidePolygon(circle, vertices)) return true;
  return vertices.some((vertex, index) =>
    distanceToSegment(circle, vertex, vertices[(index + 1) % vertices.length]!) < circle.radius);
}

function arcInside(arc: ResolvedArcObstacle, bounds: LevelGeometry['boundary']): boolean {
  return arc.x - arc.outerRadius >= bounds.left && arc.x + arc.outerRadius <= bounds.right
    && arc.y - arc.outerRadius >= bounds.top && arc.y + arc.outerRadius <= bounds.bottom;
}

function arcIntersectsBounds(arc: ResolvedArcObstacle, bounds: LevelGeometry['boundary']): boolean {
  return arc.x + arc.outerRadius >= bounds.left && arc.x - arc.outerRadius <= bounds.right
    && arc.y + arc.outerRadius >= bounds.top && arc.y - arc.outerRadius <= bounds.bottom;
}

export function validateLevel(level: LevelDefinition, geometry: LevelGeometry): ResolvedLevel {
  if (!Number.isInteger(level.id) || level.id < 1) throw new Error(`Level ${level.id}: invalid ID`);
  if (!level.name.trim()) throw new Error(`Level ${level.id}: missing name`);
  if (!(level.threeStarThreshold <= level.twoStarThreshold && level.twoStarThreshold <= level.moveLimit)) {
    throw new Error(`Level ${level.id}: invalid star threshold ordering`);
  }

  level.targets.forEach((target, index) => {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || target.x < 0 || target.x > 1 || target.y < 0 || target.y > 1) {
      throw new Error(`Level ${level.id}: target ${index} has invalid normalized coordinates`);
    }
    if (!ALLOWED_COLORS.includes(target.color)) {
      throw new Error(`Level ${level.id}: target ${index} has invalid color`);
    }
  });

  const objectiveColors = new Set<TargetColor>();
  (level.objectives ?? []).forEach((objective) => {
    const available = level.targets.filter((target) => target.color === objective.color).length;
    if (
      objectiveColors.has(objective.color)
      || !Number.isInteger(objective.count)
      || objective.count < 1
      || objective.count > available
    ) {
      throw new Error(`Level ${level.id}: invalid ${objective.color} objective`);
    }
    objectiveColors.add(objective.color);
  });

  const obstacleIds = new Set<string>();
  (level.obstacles ?? []).forEach((obstacle, index) => {
    if (!obstacle.id.trim()) throw new Error(`Level ${level.id}: obstacle ${index} has invalid ID`);
    if (obstacleIds.has(obstacle.id)) throw new Error(`Level ${level.id}: duplicate obstacle ID ${obstacle.id}`);
    obstacleIds.add(obstacle.id);
    const validRectangle = obstacle.shape === 'rectangle'
      && [obstacle.x, obstacle.y, obstacle.width, obstacle.height].every(Number.isFinite)
      && obstacle.width > 0 && obstacle.height > 0;
    const validTriangle = obstacle.shape === 'triangle'
      && obstacle.vertices.length === 3
      && obstacle.vertices.every((vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y));
    const validPolygon = obstacle.shape === 'polygon'
      && obstacle.vertices.length >= 3
      && obstacle.vertices.every((vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y));
    const validArc = obstacle.shape === 'arc'
      && [obstacle.x, obstacle.y, obstacle.innerRadius, obstacle.outerRadius, obstacle.startAngle, obstacle.endAngle].every(Number.isFinite)
      && obstacle.innerRadius > 0
      && obstacle.outerRadius > obstacle.innerRadius
      && obstacle.endAngle > obstacle.startAngle
      && obstacle.endAngle - obstacle.startAngle < Math.PI * 2
      && Number.isInteger(obstacle.segments)
      && obstacle.segments >= 3;
    if (obstacle.color !== '#1E1E1E' || (!validRectangle && !validTriangle && !validPolygon && !validArc)) {
      throw new Error(`Level ${level.id}: obstacle ${obstacle.id} has invalid geometry`);
    }
  });

  const resolved = resolveLevel(level, geometry);
  resolved.targets.forEach((target, index) => {
    const usesBoardPlacement = level.targets[index]?.placement === 'board';
    if ((!usesBoardPlacement && !inside(target, geometry.boundary)) || !inside(target, geometry.canvas)) {
      throw new Error(`Level ${level.id}: target ${index} is outside valid bounds`);
    }
    if (distance(target, geometry.shooter) < target.radius + geometry.shooter.radius + geometry.safetyGap) {
      throw new Error(`Level ${level.id}: target ${index} overlaps the shooter`);
    }
  });

  resolved.obstacles.forEach((obstacle) => {
    const clippedRectangleVisibleInCanvas = obstacle.shape === 'rectangle'
      && obstacle.edgeClipped === true
      && rectangleIntersectsBounds(obstacle, geometry.canvas);
    const clippedPolygonVisibleInBoundary = obstacle.shape === 'polygon'
      && obstacle.edgeClipped === true
      && obstacle.vertices.some((vertex) => pointInsideBounds(vertex, geometry.boundary));
    const clippedPolygonVisibleInCanvas = obstacle.shape === 'polygon'
      && obstacle.edgeClipped === true
      && obstacle.vertices.some((vertex) => pointInsideBounds(vertex, geometry.canvas));
    const clippedArcVisibleInBoundary = obstacle.shape === 'arc'
      && obstacle.edgeClipped === true
      && arcIntersectsBounds(obstacle, geometry.boundary);
    const clippedArcVisibleInCanvas = obstacle.shape === 'arc'
      && obstacle.edgeClipped === true
      && arcIntersectsBounds(obstacle, geometry.canvas);
    const insideBoundary = obstacle.shape === 'rectangle'
      ? clippedRectangleVisibleInCanvas || rectangleInside(obstacle, geometry.boundary)
      : obstacle.shape === 'arc'
        ? clippedArcVisibleInBoundary || arcInside(obstacle, geometry.boundary)
        : clippedPolygonVisibleInBoundary || polygonInside(obstacle, geometry.boundary);
    const insideCanvas = obstacle.shape === 'rectangle'
      ? clippedRectangleVisibleInCanvas || rectangleInside(obstacle, geometry.canvas)
      : obstacle.shape === 'arc'
        ? clippedArcVisibleInCanvas || arcInside(obstacle, geometry.canvas)
        : clippedPolygonVisibleInCanvas || polygonInside(obstacle, geometry.canvas);
    if (!insideBoundary || !insideCanvas) {
      throw new Error(`Level ${level.id}: obstacle ${obstacle.id} is outside valid bounds`);
    }
  });

  for (let first = 0; first < resolved.targets.length; first += 1) {
    for (let second = first + 1; second < resolved.targets.length; second += 1) {
      const a = resolved.targets[first] as ResolvedTarget;
      const b = resolved.targets[second] as ResolvedTarget;
      if (distance(a, b) < a.radius + b.radius + geometry.safetyGap) {
        throw new Error(`Level ${level.id}: targets ${first} and ${second} overlap`);
      }
    }
  }

  resolved.targets.forEach((target, targetIndex) => {
    for (const obstacle of resolved.obstacles) {
      const overlaps = obstacle.shape === 'rectangle'
        ? circleOverlapsRectangle(target, obstacle)
        : obstacle.shape === 'arc'
          ? getArcSegmentVertices(obstacle).some((segment) => circleOverlapsPolygon(target, segment))
          : circleOverlapsPolygon(target, obstacle.vertices);
      if (overlaps) {
        throw new Error(`Level ${level.id}: target ${targetIndex} overlaps obstacle ${obstacle.id}`);
      }
    }
  });

  return resolved;
}
