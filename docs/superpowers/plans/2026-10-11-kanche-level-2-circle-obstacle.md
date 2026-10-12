# Kanche Level 2 Circle and Obstacle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add selectable Level 2 with six teal marbles in an 80-unit circular ring and one exact-bounds static rectangle, without changing Level 1 gameplay or shared rules.

**Architecture:** Extend the existing level data with optional normalized rectangle obstacles, resolve and validate them beside targets, and pass the same resolved obstacle geometry to Matter.js and Canvas. The current Game lifecycle, selector, objective derivation, and scoring remain the only coordination path.

**Tech Stack:** TypeScript, Vite, Canvas 2D, Matter.js, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-10-11-kanche-level-2-circle-obstacle-design.md`

## Global Constraints

- Level 1 data and runtime behavior remain unchanged.
- Keep the existing target radius, teal token, fixed timestep, physics tuning, controls, scoring, objectives, outcomes, UI, selector, and project structure.
- Level 2 contains exactly six teal targets centered on `(210, 320)` with ring radius `80`.
- Level 2 contains one static `132 × 40` rectangle centered at `(210, 162)`, filled `#1E1E1E`, with no stroke, shadow, or corner radius.
- Obstacles never enter marble snapshots, target counters, objectives, clearing, or outcomes.
- Add no Level 3, progression, storage, locking, or new dependencies.
- Because `tests/levels.test.ts` currently asserts `LEVELS` has length one, update only that obsolete count assertion while retaining its Level 1 assertions; this is the minimum unavoidable test edit.
- This workspace has no Git repository, so commit steps are not applicable.

## Review Focus

- Normalized obstacle dimensions must resolve to exact virtual bounds within floating-point tolerance; Task 1 pins center and size.
- A circle whose corner region touches a rectangle must use closest-point collision math, not bounding-box overlap; Task 1 tests both overlap and non-overlap cases.
- A static obstacle must not enter active marble settlement or objective data; Task 2 tests snapshot and target-count isolation.
- Renderer and physics must consume the same resolved obstacle object so bounds cannot drift; Tasks 2 and 3 assert the resolved dimensions at both boundaries.
- Loading or replaying Level 1 after Level 2 must clear obstacle bodies and visuals; Tasks 2 and 3 test reload behavior.

---

### Task 1: Level 2 Data, Obstacle Types, and Validation

**Files:**
- Modify: `src/levels/levelTypes.ts`
- Modify: `src/levels/levels.ts`
- Modify: `src/levels/validateLevel.ts`
- Modify: `tests/levels.test.ts`
- Create: `tests/level2.test.ts`

**Interfaces:**
- Produces: `RectangleObstacleDefinition`, `ResolvedRectangleObstacle`, and `ResolvedLevel.obstacles: ResolvedRectangleObstacle[]`.
- Produces: `resolveLevel(level, geometry)` and `validateLevel(level, geometry)` with resolved obstacle output.
- Produces: `LEVELS[1]` as the Level 2 definition consumed by the existing Game and selector flow.

- [ ] **Step 1: Write failing Level 2 data and geometry tests**

Create `tests/level2.test.ts` that finds Level 2 by ID, validates it with the existing geometry fixture, and asserts:

- six targets, all `teal`, all radius `24`;
- target centers match `(210,240)`, `(279.282032,280)`, `(279.282032,360)`, `(210,400)`, `(140.717968,360)`, `(140.717968,280)` within `6` decimal places;
- every adjacent target distance is at least `48`;
- one obstacle resolves to ID `level-2-top-block`, center `(210,162)`, width `132`, height `40`, color `#1E1E1E`;
- no target circle overlaps the resolved rectangle using closest-point geometry;
- Level 1 resolves with an empty obstacle list and retains its existing target data.

Add fixture cases proving `validateLevel` rejects duplicate/empty obstacle IDs, non-finite or non-positive geometry, out-of-bounds rectangles, and target-rectangle penetration while allowing non-overlapping corner clearance.

- [ ] **Step 2: Run the new test and confirm the expected failure**

Run: `npm test -- --run tests/level2.test.ts`

Expected: FAIL because obstacle types/data and Level 2 do not exist.

- [ ] **Step 3: Add obstacle types and resolution**

In `src/levels/levelTypes.ts`, add optional `obstacles?: readonly RectangleObstacleDefinition[]` to `LevelDefinition`, required `obstacles: ResolvedRectangleObstacle[]` to `ResolvedLevel`, and exact rectangle interfaces with `id`, `shape`, normalized `x/y/width/height`, and `color`.

In `src/levels/validateLevel.ts`, resolve obstacle center from the scoring-boundary origin and its width/height from the full scoring-boundary dimensions. Add reusable circle-to-axis-aligned-rectangle overlap validation and obstacle identity/geometry/bounds checks. Keep the existing target resolver unchanged.

- [ ] **Step 4: Add Level 2 data**

Append Level 2 after the unchanged Level 1 object in `src/levels/levels.ts`. Use move limit `6`, star thresholds `3` and `5`, the six normalized target coordinates specified by the design, and normalized obstacle values that resolve to `(210,162)` and `132 × 40`.

- [ ] **Step 5: Update the obsolete shipped-level count assertion**

Change only the existing assertion that `LEVELS` has length `1` to expect `2`, rename its test description to cover two shipped levels, and keep all Level 1 assertions intact. Do not alter existing gameplay tests.

- [ ] **Step 6: Run level tests**

Run: `npm test -- --run tests/levels.test.ts tests/level2.test.ts`

Expected: PASS.

### Task 2: Static Obstacle Physics

**Files:**
- Modify: `src/physics/PhysicsWorld.ts`
- Modify: `tests/physics.test.ts`

**Interfaces:**
- Consumes: `ResolvedLevel.obstacles` from Task 1.
- Produces: static Matter.js rectangle bodies created by `PhysicsWorld.loadLevel(level)`.
- Produces: a narrow read-only `getObstacleBounds()` inspection method returning obstacle IDs, static flags, centers, widths, and heights for verification.

- [ ] **Step 1: Write failing physics tests**

Extend `tests/physics.test.ts` with tests that load Level 2 and assert:

- exactly one obstacle body exists;
- it is static and reports center `(210,162)` and size `132 × 40`;
- `getSnapshots()` still returns only six targets plus the shooter;
- `getTargetMasses()` still returns six equal target masses;
- obstacle geometry remains unchanged after stepping the engine;
- loading Level 1 afterward leaves zero obstacle bodies.

- [ ] **Step 2: Run the physics test and confirm the expected failure**

Run: `npm test -- --run tests/physics.test.ts`

Expected: FAIL because `getObstacleBounds` and obstacle body creation do not exist.

- [ ] **Step 3: Implement static obstacle creation**

In `PhysicsWorld`, store obstacle bodies separately from targets and shooter. During `loadLevel`, create each with `Matter.Bodies.rectangle(x, y, width, height, { isStatic: true, restitution: PHYSICS.restitution, friction: 0, label: obstacle.id })`. Clear this collection on every level load. Keep `activeBodies`, snapshots, target masses, clearing, and settlement limited to existing marble bodies.

- [ ] **Step 4: Run physics tests**

Run: `npm test -- --run tests/physics.test.ts`

Expected: PASS.

### Task 3: Obstacle Rendering and Existing Game Flow

**Files:**
- Modify: `src/render/CanvasRenderer.ts`
- Modify: `src/game/Game.ts`
- Create: `tests/renderer.test.ts`
- Modify: `tests/e2e/kanche.spec.ts`

**Interfaces:**
- Consumes: `ResolvedRectangleObstacle[]` from Task 1.
- Extends: `RenderFrame` with `obstacles: readonly ResolvedRectangleObstacle[]`.
- Produces: `getObstaclePaint(obstacle)` returning fill `#1E1E1E`, `stroke: null`, `shadowBlur: 0`, and `cornerRadius: 0`, plus `getObstacleRect(obstacle)` returning the exact top-left draw origin and resolved width/height.

- [ ] **Step 1: Write failing renderer and browser tests**

Create `tests/renderer.test.ts` to assert the obstacle paint has no stroke, shadow, or corner radius and preserves `#1E1E1E`. Assert an obstacle centered at `(210,162)` with size `132 × 40` produces draw bounds `{ x: 144, y: 142, width: 132, height: 40 }`.

Extend the existing Playwright specification with one Level 2 test that opens the selector, selects Level 2, confirms Level 2 becomes the current selector entry, and confirms the objective reports six teal marbles. Keep all existing Level 1 browser assertions unchanged; obstacle geometry and paint are proven through focused unit tests without adding debug state to production.

- [ ] **Step 2: Run focused tests and confirm the expected failure**

Run: `npm test -- --run tests/renderer.test.ts`

Expected: FAIL because obstacle rendering support does not exist.

- [ ] **Step 3: Render resolved obstacles**

In `CanvasRenderer`, add `obstacles` to `RenderFrame` and draw every rectangle before marbles using `getObstacleRect(obstacle)` and `fillRect`. Reset shadow state, omit all stroke calls, and do not use `roundRect`.

- [ ] **Step 4: Pass current-level obstacles through Game**

In the existing render call, pass `this.currentLevel?.obstacles ?? []`. Do not add a new loop, selector handler, objective path, or state field. The existing `LEVELS` lookup and selector automatically start Level 2.

- [ ] **Step 5: Run focused unit and browser tests**

Run: `npm test -- --run tests/renderer.test.ts tests/game.test.ts tests/overlay.test.ts`

Expected: PASS.

Run: `npm run test:e2e`

Expected: all desktop and portrait projects pass, including Level 2 selection.

### Task 4: Full Regression and Visual Verification

**Files:**
- No production file changes expected.

**Interfaces:**
- Consumes the completed implementation from Tasks 1–3.
- Produces verification evidence only.

- [ ] **Step 1: Run the complete unit suite**

Run: `npm test -- --run`

Expected: all test files pass with zero failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete with exit code `0`.

- [ ] **Step 3: Run complete browser verification**

Run: `npm run test:e2e`

Expected: all desktop and portrait tests pass.

- [ ] **Step 4: Inspect both levels in the local preview**

At `http://127.0.0.1:4173/`, verify Level 1 is visually unchanged. Select Level 2 and confirm the six-marble ring, one sharp dark rectangle, exact visual/physical alignment during collisions, unchanged counters, and no browser console errors.
