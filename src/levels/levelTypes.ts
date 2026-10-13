import type { Bounds } from '../game/rules';

export type TargetColor = 'teal' | 'blue' | 'green' | 'violet';

export interface TargetDefinition {
  x: number;
  y: number;
  color: TargetColor;
  placement?: 'layout' | 'board';
}

export interface ObjectiveDefinition {
  color: TargetColor;
  count: number;
}

export interface RectangleObstacleDefinition {
  id: string;
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  edgeClipped?: boolean;
  hidden?: boolean;
  color: '#1E1E1E';
}

export interface ObstacleVertex {
  x: number;
  y: number;
}

export interface TriangleObstacleDefinition {
  id: string;
  shape: 'triangle';
  vertices: readonly [ObstacleVertex, ObstacleVertex, ObstacleVertex];
  color: '#1E1E1E';
}

export interface PolygonObstacleDefinition {
  id: string;
  shape: 'polygon';
  vertices: readonly ObstacleVertex[];
  edgeClipped?: boolean;
  color: '#1E1E1E';
}

export interface ArcObstacleDefinition {
  id: string;
  shape: 'arc';
  x: number;
  y: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  segments: number;
  edgeClipped?: boolean;
  color: '#1E1E1E';
}

export type ObstacleDefinition = RectangleObstacleDefinition | TriangleObstacleDefinition | PolygonObstacleDefinition | ArcObstacleDefinition;

export interface LevelDefinition {
  id: number;
  name: string;
  moveLimit: number;
  threeStarThreshold: number;
  twoStarThreshold: number;
  targets: readonly TargetDefinition[];
  objectives?: readonly ObjectiveDefinition[];
  obstacles?: readonly ObstacleDefinition[];
  formation?: { kind: string; description?: string };
}

export interface ResolvedTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: TargetColor;
}

export interface ResolvedLevel {
  definition: LevelDefinition;
  targets: ResolvedTarget[];
  obstacles: ResolvedObstacle[];
}

export interface ResolvedRectangleObstacle {
  id: string;
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  edgeClipped?: boolean;
  hidden?: boolean;
  color: '#1E1E1E';
}

export interface ResolvedTriangleObstacle {
  id: string;
  shape: 'triangle';
  vertices: readonly [ObstacleVertex, ObstacleVertex, ObstacleVertex];
  color: '#1E1E1E';
}

export interface ResolvedPolygonObstacle {
  id: string;
  shape: 'polygon';
  vertices: readonly ObstacleVertex[];
  edgeClipped?: boolean;
  color: '#1E1E1E';
}

export interface ResolvedArcObstacle {
  id: string;
  shape: 'arc';
  x: number;
  y: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  segments: number;
  edgeClipped?: boolean;
  color: '#1E1E1E';
}

export type ResolvedObstacle = ResolvedRectangleObstacle | ResolvedTriangleObstacle | ResolvedPolygonObstacle | ResolvedArcObstacle;

export interface LevelGeometry {
  boundary: Bounds;
  canvas: Bounds;
  targetRadius: number;
  shooter: { x: number; y: number; radius: number };
  safetyGap: number;
}
