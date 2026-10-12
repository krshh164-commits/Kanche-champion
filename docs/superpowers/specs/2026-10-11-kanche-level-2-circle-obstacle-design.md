# Kanche Level 2 Circular Formation and Static Obstacle Design

## Goal

Add only Level 2 to the current Kanche game. Level 2 contains six large teal target marbles in a circular formation and one fixed, sharp-cornered rectangular obstacle near the top center. Level 1, global UI, controls, physics tuning, scoring rules, and progress behavior remain unchanged.

## Current-State Constraint

The current implementation contains one playable level and no obstacle schema. This change introduces the minimum reusable obstacle data needed by Level 2. It does not implement the older three-level progression proposal, locked levels, saved progress, or any Level 3 content.

For Level 2, this document supersedes the Level 2 formation and obstacle placement described in `2026-10-11-kanche-mobile-level-progression-design.md`.

The existing level selector lists playable definitions directly. Therefore, adding the Level 2 definition makes it selectable immediately. No storage, completion, or unlocking logic is added or changed.

## Level 2 Definition

Level 2 uses the same gameplay limits as Level 1:

- Move limit: 6
- Three-star threshold: 3 moves
- Two-star threshold: 5 moves
- Target count: 6
- Target color: teal (`#1D6456` through the existing `teal` palette token)
- Target radius: the existing 24 virtual units

The six targets form an evenly spaced circular ring centered at `(210, 320)` in the existing `420 × 780` virtual board. The ring radius is 80 virtual units. The resolved target centers are:

1. `(210, 240)`
2. `(279.3, 280)`
3. `(279.3, 360)`
4. `(210, 400)`
5. `(140.7, 360)`
6. `(140.7, 280)`

The stored level data remains normalized. The final normalized values are derived from the existing scoring-region resolver so that they resolve to these positions within normal floating-point tolerance.

This arrangement leaves an open center for direct and chain-reaction shots, provides useful paths between neighboring marbles, and maintains generous clearance from the shooter and baseline.

## Obstacle Geometry

Level definitions gain an optional rectangle-obstacle collection. Level 2 defines exactly one obstacle:

- ID: `level-2-top-block`
- Shape: rectangle
- Center: `(210, 162)` virtual units
- Width: 132 virtual units
- Height: 40 virtual units
- Angle: `0`
- Fill: `#1E1E1E`
- Stroke: none
- Corner radius: `0`
- Physics: static Matter.js body

The obstacle is fully inside the existing scoring area. Its lower edge is at `182`, leaving 34 virtual units between the obstacle and the upper edge of the nearest target marble at `216`.

## Data Model

Extend the existing immutable level types with optional obstacle data:

```ts
interface RectangleObstacleDefinition {
  id: string;
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: '#1E1E1E';
}

interface ResolvedRectangleObstacle {
  id: string;
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: '#1E1E1E';
}
```

Obstacle position and size are stored as normalized scoring-area values, then resolved once into virtual coordinates alongside targets. Center coordinates resolve from the scoring area's left/top origin; width and height are fractions of its full width and height. For the current `332 × 442` scoring area, Level 2 stores center `(0.5, 0.104072)`, width `0.397590`, and height `0.090498`, which resolve to `(210, 162)` and `132 × 40` within floating-point tolerance. `ResolvedLevel` carries both resolved targets and resolved obstacles.

The same resolved obstacle object is supplied to physics and rendering. This guarantees that the visible rectangle and collision rectangle use identical center, width, and height values.

## Validation

The existing level validator is extended without changing Level 1 behavior. It rejects a level when:

- An obstacle ID is empty or duplicated.
- Rectangle geometry is non-finite or has a non-positive width or height.
- The obstacle extends outside the scoring area or visible canvas.
- A target circle overlaps the obstacle rectangle.
- A target overlaps another target, the shooter, or the baseline safety area under existing validation rules.

Circle-to-rectangle overlap uses the closest point on the rectangle to the circle center. Tangency is allowed; geometric penetration is rejected. The approved Level 2 geometry must validate with no target-target or target-obstacle overlaps.

## Physics

`PhysicsWorld.loadLevel` creates a Matter.js rectangle for each resolved obstacle with:

- `isStatic: true`
- The existing global restitution value
- Zero rotation and no runtime movement
- A dedicated obstacle label and metadata distinct from target and shooter bodies

Obstacle bodies participate in normal Matter.js collision resolution and collision sound intensity. They are not stored in the target map and are excluded from:

- Active marble snapshots
- Settlement counters as moving bodies
- Clear detection
- Target removal
- Objective counts
- Cleared counts
- Win and loss totals

No shooting force, restitution, friction, fixed-step timing, or settlement threshold changes are permitted.

## Rendering

`CanvasRenderer` receives resolved obstacles with each frame and draws them before marbles. Each obstacle uses its resolved center, width, and height directly:

- Solid fill `#1E1E1E`
- No stroke or outline
- No shadow
- Sharp 90-degree corners

The renderer does not independently recompute obstacle geometry. Level 1 sends an empty obstacle list and renders exactly as it does now.

## Game Coordination

Starting Level 2 follows the existing level lifecycle:

1. Find the definition in `LEVELS`.
2. Resolve and validate targets and obstacles.
3. Load the targets and static obstacle into the existing Matter.js world.
4. Derive the objective count from targets only.
5. Render the same HUD and controls used by Level 1.

The obstacle never enters target color maps or objective aggregation. The selector continues using the existing `LEVELS` array and requires no new event handlers or storage system.

## Testing

Implementation follows test-first development. Automated tests will prove:

- Level 1 data and resolved geometry remain unchanged and contain no obstacles.
- Level 2 contains exactly six teal targets and one rectangle obstacle.
- Level 2 target centers resolve to the approved circular formation.
- All Level 2 targets are fully inside the scoring area and canvas.
- Level 2 targets do not overlap each other, the shooter, or the obstacle.
- The obstacle resolves to `(210, 162)` with `132 × 40` bounds.
- Invalid target-obstacle overlap is rejected.
- Physics creates the obstacle as static with matching bounds.
- Obstacle bodies never appear as target snapshots or affect target mass/count helpers.
- Rendering uses the resolved obstacle bounds with fill `#1E1E1E` and no stroke.
- Level 2 appears in the existing selector and starts through its existing handler.
- Existing Level 1, input, physics, scoring, overlay, and HUD tests continue to pass.

Final verification includes the full unit suite, production build, existing desktop and portrait browser tests, a Level 2 selector/start browser check, and visual inspection at a narrow portrait viewport. Browser logs must contain no errors.

## Non-Goals

- Changing Level 1.
- Adding Level 3 or additional formations.
- Adding obstacles to any other level.
- Adding or changing localStorage, unlock rules, or saved progress.
- Changing the internal scoring boundary or outer wall behavior.
- Changing UI layout, colors, controls, marble size, physics tuning, scoring, or outcome rules.
- Adding rounded obstacle corners, outlines, shadows, animation, clearing, scoring, or objective behavior.

## Completion Criteria

Level 2 is selectable in the existing level sheet and starts with six teal marbles in the approved circular ring below one sharp, dark, fixed rectangle. Visible and physical obstacle bounds match exactly. All targets begin in valid non-overlapping positions, the obstacle never moves or contributes to game counters, Level 1 remains unchanged, and all specified automated and browser checks pass.
