export type BodyKind = 'target' | 'shooter';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface MarbleSnapshot extends Point {
  id: string;
  kind: BodyKind;
  radius: number;
  speed: number;
  angle: number;
  initialAngle?: number;
  angularVelocity: number;
  velocity?: Point;
}

export interface RoundOutcomeInput {
  cleared: number;
  originalTargetTotal: number;
  movesLeft: number;
  settled: boolean;
  terminal: boolean;
  objectivesComplete?: boolean;
}

export function isMarbleFullyOutside(marble: MarbleSnapshot, boundary: Bounds): boolean {
  return (
    marble.x - marble.radius > boundary.right ||
    marble.x + marble.radius < boundary.left ||
    marble.y - marble.radius > boundary.bottom ||
    marble.y + marble.radius < boundary.top
  );
}

export function isTargetCleared(marble: MarbleSnapshot, boundary: Bounds): boolean {
  if (marble.kind !== 'target') return false;
  return isMarbleFullyOutside(marble, boundary);
}

export function calculateStars(
  movesUsed: number,
  threeStarThreshold: number,
  twoStarThreshold: number,
): 1 | 2 | 3 {
  if (movesUsed <= threeStarThreshold) return 3;
  if (movesUsed <= twoStarThreshold) return 2;
  return 1;
}

export function calculateOutcome(input: RoundOutcomeInput): 'won' | 'lost' | null {
  if (!input.settled || input.terminal) return null;
  if (input.objectivesComplete ?? input.cleared >= input.originalTargetTotal) return 'won';
  if (input.movesLeft === 0) return 'lost';
  return null;
}
