import type { ObstacleVertex, ResolvedArcObstacle } from './levelTypes';

export function getArcSegmentVertices(arc: ResolvedArcObstacle): readonly ObstacleVertex[][] {
  const angleStep = (arc.endAngle - arc.startAngle) / arc.segments;
  return Array.from({ length: arc.segments }, (_, index) => {
    const start = arc.startAngle + angleStep * index;
    const end = start + angleStep;
    return [
      { x: arc.x + Math.cos(start) * arc.outerRadius, y: arc.y + Math.sin(start) * arc.outerRadius },
      { x: arc.x + Math.cos(end) * arc.outerRadius, y: arc.y + Math.sin(end) * arc.outerRadius },
      { x: arc.x + Math.cos(end) * arc.innerRadius, y: arc.y + Math.sin(end) * arc.innerRadius },
      { x: arc.x + Math.cos(start) * arc.innerRadius, y: arc.y + Math.sin(start) * arc.innerRadius },
    ];
  });
}
