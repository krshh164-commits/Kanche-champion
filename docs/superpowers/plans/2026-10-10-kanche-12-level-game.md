# Kanche 12-Level Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, mobile-first Kanche browser game with precise pointer controls, twelve validated data-driven levels, accessible outcomes, and locally persisted progression.

**Architecture:** A Vite TypeScript application runs one shared Matter.js simulation and a custom Canvas renderer. Pure rule, level, shot, and progression modules are tested before the `Game` orchestrator connects physics, controls, rendering, audio, HUD, and level selection.

**Tech Stack:** TypeScript, Vite, Matter.js 0.20.x, Canvas 2D, CSS, Web Audio API, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-kanche-playable-core-design.md`

## Global Constraints

- Use a fixed `420 x 780` virtual playfield and scale it responsively; convert pointer coordinates into virtual coordinates.
- Use `#263944` for the playfield, `#EAD6AD` for the nonphysical scoring rectangle, and `#F3BE5D` for the shooter.
- The scoring rectangle is `{ left: 44, right: 376, top: 116, bottom: 558 }`; the shooter baseline is `y = 664` with center clamped to `x = 66..354`.
- Target radius is `13`; shooter radius is `16`; targets have equal density and mass with no initial overlap.
- Matter.js uses zero gravity, restitution `0.78`, target `frictionAir = 0.018`, and a fixed `1000 / 60 ms` step with at most five catch-up steps per render frame.
- A turn settles only after all active bodies stay at or below speed `0.08` for `24` consecutive physics steps; settled velocities are explicitly zeroed.
- Aim drag is valid from `12..110` virtual pixels and maps to velocity magnitude up to `18`; downward or horizontal launches are invalid.
- A target clears only after its complete radius crosses one scoring side; scoring is atomic, permanent for the round, and excludes the shooter.
- Use Pointer Events with pointer capture, one active pointer, and `touch-action: none` on the Canvas.
- Preserve the five gameplay states: `positioning`, `aiming`, `shot`, `settling`, `resetting`; pause is orthogonal.
- Keep `DEBUG_PHYSICS = false` by default and ensure debug drawing never mutates simulation state.
- No backend, accounts, external images, prerecorded audio, Phaser, PixiJS, Capacitor, multiplayer, shops, ads, daily challenge, or native packaging.
- The workspace currently has no Git repository; run commit steps only if Git is initialized before execution.

## Review Focus

- Pointer loss outside the Canvas must finish or cancel the active gesture exactly once through pointer capture.
- A suspended tab must not feed a large delta into Matter.js or change deterministic outcomes.
- Simultaneous boundary crossings must increment each target once and produce only one terminal outcome.
- Corrupt localStorage must not lock level 1 or crash level selection.
- Level layouts must remain non-overlapping and inside bounds after normalized-coordinate conversion.

---

### Task 1: Project Foundation and Pure Round Rules

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/config.ts`
- Create: `src/game/gameState.ts`
- Create: `src/game/rules.ts`
- Create: `tests/rules.test.ts`

**Interfaces:**
- Produces: `type GameState = 'positioning' | 'aiming' | 'shot' | 'settling' | 'resetting'`; `interface Point { x: number; y: number }`; `interface Bounds { left: number; right: number; top: number; bottom: number }`; `interface MarbleSnapshot { id: string; kind: BodyKind; x: number; y: number; radius: number; speed: number }`; `isTargetCleared(marble: MarbleSnapshot, boundary: Bounds): boolean`; `calculateStars(movesUsed: number, threeStar: number, twoStar: number): 1 | 2 | 3`; `calculateOutcome(input: RoundOutcomeInput): 'won' | 'lost' | null`; and global constants consumed by later tasks.

- [ ] **Step 1: Add the test runner scaffolding and write failing pure-rule tests**

Create `package.json` and `tsconfig.json` only far enough to execute TypeScript tests, then add tests named `requires_the_full_radius_to_cross_each_boundary`, `never_clears_the_shooter`, `awards_stars_at_exact_thresholds`, `loses_only_after_final_settled_shot`, and `emits_no_outcome_before_settlement`. Assert the four formulas from the spec and the terminal guard inputs explicitly.

- [ ] **Step 2: Run the rules tests and verify RED**

Run: `npm install && npm test -- --run tests/rules.test.ts`

Expected: FAIL because `src/game/rules.ts` does not exist.

- [ ] **Step 3: Add the minimal project configuration and rule interfaces**

Complete the Vite scripts `dev`, `build`, `preview`, `test`, and `test:e2e`. Add `matter-js` as a runtime dependency and TypeScript, Vite, Vitest, jsdom, `@types/matter-js`, and Playwright as development dependencies. Create the minimal `index.html`. Export:

```ts
type BodyKind = 'target' | 'shooter';
type GameState = 'positioning' | 'aiming' | 'shot' | 'settling' | 'resetting';
function isTargetCleared(marble: MarbleSnapshot, boundary: Bounds): boolean;
function calculateStars(movesUsed: number, threeStar: number, twoStar: number): 1 | 2 | 3;
function calculateOutcome(input: RoundOutcomeInput): 'won' | 'lost' | null;
```

- [ ] **Step 4: Run the rules tests and TypeScript check**

Run: `npm test -- --run tests/rules.test.ts && npx tsc --noEmit`

Expected: all rule tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit if Git is available**

Commit message: `feat: establish kanche rules and project foundation`

### Task 2: Twelve Level Definitions and Geometry Validation

**Files:**
- Create: `src/levels/levelTypes.ts`
- Create: `src/levels/levels.ts`
- Create: `src/levels/validateLevel.ts`
- Create: `tests/levels.test.ts`

**Interfaces:**
- Consumes: `Bounds`, target radius, shooter baseline and clamp constants from Task 1.
- Produces: `type TargetColor = 'teal' | 'blue' | 'green' | 'violet'`; `LevelDefinition` matching the spec; `interface ResolvedTarget { id: string; x: number; y: number; radius: number; color: TargetColor }`; `interface ResolvedLevel { definition: LevelDefinition; targets: ResolvedTarget[] }`; `LEVELS: readonly LevelDefinition[]`; `resolveLevel(level: LevelDefinition, geometry: LevelGeometry): ResolvedLevel`; and `validateLevel(level: LevelDefinition, geometry: LevelGeometry): ResolvedLevel`.

- [ ] **Step 1: Write failing level-schema and validator tests**

Test that IDs are exactly `1..12`, names match the requested formations, coordinates are finite and normalized, thresholds obey `threeStar <= twoStar <= moveLimit`, every resolved target is fully inside both scoring and Canvas bounds, no pair overlaps, and no target overlaps the initial shooter. Include failing fixtures for each validator error, including normalized edge values and a pair separated by less than `2 * radius + safetyGap`.

- [ ] **Step 2: Run level tests and verify RED**

Run: `npm test -- --run tests/levels.test.ts`

Expected: FAIL because level modules do not exist.

- [ ] **Step 3: Implement immutable level data and validation**

Define explicit normalized target arrays for the twelve requested formations. Use target colors `teal | blue | green | violet`. Use these move/three-star/two-star values:

```text
1: 8/4/6   2: 8/4/6   3: 9/4/7   4: 8/4/6
5: 9/5/7   6: 9/5/7   7: 10/5/8  8: 10/6/8
9: 11/6/9  10: 11/6/9 11: 12/7/10 12: 12/7/10
```

Keep formation metadata descriptive only. `resolveLevel` must use the scoring rectangle's usable width/height after radius padding; `validateLevel` returns validated resolved data or throws an error naming the level and offending target indexes.

- [ ] **Step 4: Run all level tests**

Run: `npm test -- --run tests/levels.test.ts`

Expected: all twelve definitions and invalid fixtures PASS.

- [ ] **Step 5: Commit if Git is available**

Commit message: `feat: add twelve validated kanche levels`

### Task 3: Versioned Progression and Accessible Level Selection

**Files:**
- Create: `src/storage/ProgressStore.ts`
- Create: `src/ui/LevelSelect.ts`
- Create: `tests/progress.test.ts`
- Create: `tests/levelSelect.test.ts`

**Interfaces:**
- Consumes: `LEVELS` and `LevelDefinition` from Task 2.
- Produces: `interface ProgressData { version: 1; unlockedThrough: number; starsByLevel: Record<string, number> }`; `new ProgressStore(storage: Storage)`; `load(): ProgressData`; `recordCompletion(levelId: number, stars: 1 | 2 | 3): ProgressData`; `isLevelUnlocked(levelId: number, progress: ProgressData): boolean`; and `new LevelSelect(root: HTMLElement, options: { levels: readonly LevelDefinition[]; progress: ProgressData; onSelect(levelId: number): void })`.

- [ ] **Step 1: Write failing progression tests**

Cover fresh storage, malformed JSON, unsupported version, level-1 availability, unlocking only the immediate successor, retaining the higher of old/new stars, level-12 completion, and blocked activation for locked level buttons. Use an in-memory `Storage` substitute rather than mocking internal methods.

- [ ] **Step 2: Run progression tests and verify RED**

Run: `npm test -- --run tests/progress.test.ts tests/levelSelect.test.ts`

Expected: FAIL because storage and level selection do not exist.

- [ ] **Step 3: Implement the versioned storage contract**

Use key `kanche.progress` and schema `{ version: 1, unlockedThrough: number, starsByLevel: Record<string, number> }`. Validate every loaded field; fall back to `{ version: 1, unlockedThrough: 1, starsByLevel: {} }` on any invalid document.

- [ ] **Step 4: Implement semantic level selection**

Render twelve native buttons showing number, name, earned stars, and locked/completed state. Disabled locked buttons must not invoke `onSelect`; restore focus to the last selected level when returning from gameplay.

- [ ] **Step 5: Run progression and selection tests**

Run: `npm test -- --run tests/progress.test.ts tests/levelSelect.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit if Git is available**

Commit message: `feat: add local level progression and selection`

### Task 4: Deterministic Matter.js Physics World

**Files:**
- Create: `src/physics/PhysicsWorld.ts`
- Create: `src/physics/fixedStep.ts`
- Create: `tests/physics.test.ts`
- Create: `tests/fixedStep.test.ts`

**Interfaces:**
- Consumes: resolved target coordinates and physics constants from Tasks 1–2.
- Produces: `loadLevel(level: ResolvedLevel): void`; `setShooterX(x: number): void`; `applyShot(velocity: Point): void`; `step(deltaMs: number): PhysicsEvent[]`; `getSnapshots(): MarbleSnapshot[]`; `removeTarget(id: string): boolean`; `allBodiesSettled(): boolean`; `resetShooter(x: number): void`; and `FixedStepClock.consume(frameDeltaMs: number): number` returning the number of fixed simulation steps to execute.

- [ ] **Step 1: Write failing fixed-step and physics tests**

Assert a `1000 / 60` step, five-step catch-up cap, zero gravity, equal target radii/mass, circular bodies, no initial overlaps, moderate restitution, momentum transfer, gradual speed reduction, deterministic replay within tolerance, and `24` consecutive slow steps before settlement. Add a suspended-frame test using a multi-second delta.

- [ ] **Step 2: Run physics tests and verify RED**

Run: `npm test -- --run tests/physics.test.ts tests/fixedStep.test.ts`

Expected: FAIL because physics modules do not exist.

- [ ] **Step 3: Implement the fixed-step clock and physics lifecycle**

Create Matter.js bodies with stable IDs in level-array order. Use invisible static outer walls separate from the scoring rectangle. `removeTarget(id)` calls `Composite.remove` once and retains cleared IDs. `allBodiesSettled` ignores removed targets and zeros active velocities after the threshold duration.

- [ ] **Step 4: Run physics tests twice**

Run: `npm test -- --run tests/physics.test.ts tests/fixedStep.test.ts && npm test -- --run tests/physics.test.ts`

Expected: both runs PASS with the deterministic comparison unchanged.

- [ ] **Step 5: Commit if Git is available**

Commit message: `feat: implement deterministic marble physics`

### Task 5: Precise Pointer Controls and State Transitions

**Files:**
- Create: `src/input/shotMath.ts`
- Create: `src/input/ShotController.ts`
- Create: `tests/shot.test.ts`
- Create: `tests/shotController.test.ts`

**Interfaces:**
- Consumes: `GameState`, shooter geometry, baseline clamp, and shot limits from Task 1.
- Produces: `clampShooterX(x: number, min: number, max: number): number`; `calculateShot(origin: Point, pointer: Point, limits: ShotLimits): ShotVector | null`; and `new ShotController(canvas: HTMLCanvasElement, options: { getState(): GameState; getShooter(): Point; onPosition(x: number): void; onAim(preview: AimPreview | null): void; onShoot(shot: ShotVector): void; onCancel(): void })`.

- [ ] **Step 1: Write failing shot-math tests**

Cover baseline endpoints, drags of `0`, `11`, `12`, `110`, and `>110` pixels, maximum velocity `18`, exact opposite direction, rejection of downward/horizontal vectors, and unchanged moves for invalid gestures.

- [ ] **Step 2: Write failing controller tests for the Review Focus pointer cases**

Use a small fake pointer-capture element. Cover mouse and touch-style pointer types, one active pointer, rapid taps, cancellation, release outside the Canvas, capture/release calls, ignored secondary pointers, locked input during `shot`/`settling`, and teardown while captured.

- [ ] **Step 3: Run control tests and verify RED**

Run: `npm test -- --run tests/shot.test.ts tests/shotController.test.ts`

Expected: FAIL because control modules do not exist.

- [ ] **Step 4: Implement shot math and `ShotController`**

The controller emits intents only; `Game` remains the state owner. Convert client coordinates with the Canvas bounding rectangle and virtual-size scale. Call `preventDefault` only for owned Canvas gestures and always release capture on up, cancel, reset, or teardown.

- [ ] **Step 5: Run control tests**

Run: `npm test -- --run tests/shot.test.ts tests/shotController.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit if Git is available**

Commit message: `feat: add precise pointer-based shooting controls`

### Task 6: Canvas Rendering, Effects, Audio, and Debug Overlay

**Files:**
- Create: `src/render/CanvasRenderer.ts`
- Create: `src/render/effects.ts`
- Create: `src/audio/AudioManager.ts`
- Create: `src/styles.css`
- Create: `tests/effects.test.ts`
- Create: `tests/audio.test.ts`

**Interfaces:**
- Consumes: body snapshots, aim preview, boundary geometry, state, and `DEBUG_PHYSICS` from earlier tasks.
- Produces: `CanvasRenderer.resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void`; `render(frame: RenderFrame): void`; `spawnClearEffect(snapshot: MarbleSnapshot, color: TargetColor): void`; `clearEffects(): void`; `AudioManager.playCollision(intensity: number): void`; `playClear(): void`; and `setMuted(muted: boolean): void`.

- [ ] **Step 1: Write failing render-effect and audio-state tests**

Test that one clear event creates one finite particle burst plus a fading marble snapshot, expired effects are removed, reset clears effects, mute suppresses node creation, and repeated collision sounds are rate-limited. Test that debug primitives are emitted only when `DEBUG_PHYSICS` is enabled.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run tests/effects.test.ts tests/audio.test.ts`

Expected: FAIL because renderer support modules do not exist.

- [ ] **Step 3: Implement the custom Canvas renderer**

Render the fixed virtual scene with device-pixel-ratio backing resolution: slate background, cream scoring boundary, baseline, glass-gradient targets, amber shooter, dotted guide, restrained power ring, short shooter trail, clear particles/fade, and optional debug circles/IDs/velocity vectors/radius extents/boundary condition labels.

- [ ] **Step 4: Implement synthesized Web Audio feedback**

Create the audio context lazily after user activation. Use short oscillator/gain envelopes for collision, shot, and clear cues; store mute state for the current session only.

- [ ] **Step 5: Run effect and audio tests plus typecheck**

Run: `npm test -- --run tests/effects.test.ts tests/audio.test.ts && npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit if Git is available**

Commit message: `feat: render polished marble feedback`

### Task 7: Game Orchestration, HUD, Pause, and Outcomes

**Files:**
- Create: `src/game/Game.ts`
- Create: `src/ui/Hud.ts`
- Create: `src/ui/Overlay.ts`
- Create: `src/main.ts`
- Create: `tests/game.test.ts`
- Create: `tests/overlay.test.ts`

**Interfaces:**
- Consumes: every public interface from Tasks 1–6.
- Produces: the runnable application; `Game.startLevel(levelId: number): void`; `restart(): void`; `pause(): void`; `resume(): void`; `finishRound(outcome: 'won' | 'lost'): boolean` returning false after the first terminal dispatch; and navigation between level selection and play.

- [ ] **Step 1: Write failing orchestration tests**

Cover the exact five-state sequence, one-move decrement only after valid release, input lock during motion, clear-before-outcome ordering, reset to last confirmed baseline X, original target total preservation, final-shot settlement before loss, simultaneous final clears, one terminal event, pause without accumulated time, and equivalent clean rounds from Restart/Replay/Retry.

- [ ] **Step 2: Write failing accessible-overlay tests**

Assert the HUD labels, top-right control labels, `LEVEL COMPLETE`, moves used, cleared total, stars, `OUT OF MOVES`, Next Level behavior including level 12, Retry/Replay, native button activation, initial focus, focus containment, and focus restoration.

- [ ] **Step 3: Run orchestration tests and verify RED**

Run: `npm test -- --run tests/game.test.ts tests/overlay.test.ts`

Expected: FAIL because application orchestration does not exist.

- [ ] **Step 4: Implement `Game` as the sole state owner**

Drive physics through the fixed-step clock and rendering through `requestAnimationFrame`. During `resetting`, process all clear candidates first, update HUD, then call guarded `finishRound`. Preserve an immutable terminal outcome until a new round starts.

- [ ] **Step 5: Implement HUD, pause, sound, and terminal overlays**

Use semantic HTML around the Canvas. Pause freezes clock accumulation and controller input while preserving body velocities. Restart, Replay, and Retry call the same reset path. Successful completion records stars and unlocks the next level before enabling Next Level.

- [ ] **Step 6: Run all unit tests and build**

Run: `npm test -- --run && npm run build`

Expected: zero test failures and Vite exits `0` with production files in `dist/`.

- [ ] **Step 7: Commit if Git is available**

Commit message: `feat: complete kanche gameplay and progression loop`

### Task 8: Browser Verification and Local Handoff

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/kanche.spec.ts`
- Create: `README.md`
- Modify: implementation files only when a browser test exposes a defect, with a failing regression test added first.

**Interfaces:**
- Consumes: the complete application from Task 7.
- Produces: end-to-end evidence, run instructions, controls, and known limitations.

- [ ] **Step 1: Read the Sites local-preview guidance before starting a preview**

Read: `C:/Users/anasw/.codex/plugins/cache/openai-curated-remote/sites/1.0.1/skills/sites/references/preview/local.md`.

- [ ] **Step 2: Write failing Playwright coverage**

At desktop and portrait-mobile viewports, cover level-select lock state, level 1 launch, shooter positioning, short drag rejection, valid aim/shot, pointer release outside Canvas, input lock, pause/resume, restart, sound toggle, HUD values, and overlay keyboard focus. Add a development-only storage fixture to verify progression and Next Level without weakening runtime locks.

- [ ] **Step 3: Run the browser tests and fix only observed failures**

Run: `npm run build && npm run test:e2e`

Expected: both viewport projects PASS with no page errors.

- [ ] **Step 4: Manually inspect all twelve levels in the local preview**

Verify initial bounds/overlaps with debug mode temporarily enabled, then restore `DEBUG_PHYSICS = false`. Exercise at least one valid shot per level and confirm no console errors, scrolling, clipped controls, or inaccessible overlays.

- [ ] **Step 5: Document local operation and limitations**

In `README.md`, include `npm install`, `npm run dev`, `npm test`, `npm run build`, controls, the five-state behavior, localStorage progression, debug toggle, and the limitation that physics consistency is guaranteed within the same browser/runtime rather than bit-identically across engines.

- [ ] **Step 6: Run the fresh completion gate**

Run: `npm test -- --run && npm run build && npm run test:e2e`

Expected: all tests PASS, build exits `0`, both browser projects PASS, and no runtime console errors are reported.

- [ ] **Step 7: Commit if Git is available**

Commit message: `test: verify kanche across pointer and mobile flows`
