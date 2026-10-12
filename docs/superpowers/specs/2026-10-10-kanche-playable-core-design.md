# Kanche 12-Level Game Design

## Goal

Build a complete, mobile-first Kanche game with twelve progressively harder levels that runs in a modern desktop or mobile browser. Every level uses the same interaction loop: position the shooter, aim, shoot, resolve collisions, clear target marbles, update the HUD, and reset the shooter for the next turn.

The release remains focused: twelve data-driven levels, local progression, and level selection, with no backend, accounts, external image assets, shop, advertisements, or unrelated systems.

## User Experience

The page fills the available viewport and is optimized for portrait screens. A centered, adult-oriented game shell contains:

- A compact top-left HUD that presents `MOVES LEFT` and `MARBLES CLEARED` as separate, readable counters without covering the playfield.
- Top-right restart, pause/resume, and sound on/off controls using restrained icons with accessible text labels.
- A dark slate-blue Canvas playfield.
- A fixed cream rectangle that marks the scoring boundary without participating in physics.
- Glass-styled target marbles arranged from the selected level's formation data inside that rectangle.
- An amber shooter marble on a horizontal baseline below the rectangle.
- Brief instructions that change with the current interaction state.

The virtual game coordinates stay fixed while CSS and Canvas scaling fit them to the available viewport. Pointer coordinates are converted back into virtual coordinates before gameplay calculations. The page prevents scrolling and browser gestures only while the player is interacting with the Canvas.

The interface uses warm off-white type, modest letter spacing, quiet translucent surfaces, and high-contrast focus indicators. It avoids cartoon decoration, oversized rewards, coins, or juvenile visual language.

## Interaction Model

The game uses this exact state sequence:

1. `positioning`: dragging the shooter moves it only along the horizontal baseline. Its center is clamped to the valid baseline range so the full shooter remains inside the permitted area. Releasing confirms the position without consuming a move.
2. `aiming`: a new press must begin on the positioned shooter. Dragging backward sets the opposite launch direction and power. A dotted guide extends along the launch direction, and a restrained power indicator reflects clamped drag distance.
3. `shot`: releasing a valid aim applies velocity to the shooter and consumes exactly one move. Maximum power is clamped. A candidate vector with a downward vertical component is rejected, so a valid launch always travels into the upper play area.
4. `settling`: all gameplay input is disabled. Every active body must remain below the configured movement threshold for several consecutive physics frames before the turn may continue.
5. `resetting`: cleared targets are finalized, counters and outcome are evaluated, and the shooter returns to the baseline at its last confirmed horizontal position.

After resetting, the game returns to `positioning`, or enters a terminal won/lost presentation when the round ends. Won and lost are outcomes rather than additional interactive states.

Pause is orthogonal to the five gameplay states. Pausing stores the current state, stops physics accumulation and input processing, and displays a resume surface. Resuming continues from the stored state without advancing time, changing moves, or altering body velocities. Restart creates a fresh copy of the same level. Sound toggling changes only audio output and never simulation behavior.

A gesture shorter than the minimum aim distance does not fire, change physics, or consume a move. Rapid taps are therefore harmless. Pointer cancellation restores `positioning` or the confirmed pre-aim position without firing.

The Canvas uses Pointer Events for mouse, touch, and pen through one code path. On a valid gesture start, it records the active `pointerId` and calls `setPointerCapture`, allowing movement and release to remain coherent when the pointer leaves the Canvas. Other simultaneous pointers are ignored. Pointer capture is released on `pointerup`, `pointercancel`, reset, and teardown. CSS `touch-action: none` and targeted event cancellation prevent browser scrolling or navigation gestures during Canvas interaction without disabling normal behavior elsewhere on the page.

## Physics and Clearing Rules

Matter.js runs a zero-gravity world with circular collision bodies. Every target marble has the same radius, density, and therefore mass. The shooter may use a slightly larger radius and mass so impacts feel deliberate while remaining predictable. Restitution is moderate rather than perfectly elastic, and smooth air friction dissipates energy after natural momentum transfer.

The compact triangle is generated from radius-aware spacing with a small safety gap, then validated before bodies enter the world so no pair initially overlaps. Body creation order, level coordinates, physics parameters, and shot-vector calculations contain no randomness. Identical starting state and identical shot input therefore produce consistent results within the same browser/runtime.

The game advances Matter.js with a fixed timestep independent of render refresh rate. It caps accumulated catch-up work after a suspended or slow frame to avoid unstable large updates. Near-rest bodies are explicitly settled after remaining under the speed threshold for consecutive frames, preventing persistent micro-velocity jitter from keeping a turn alive.

Invisible static walls surround the outer Canvas play area. These walls contain active bodies. The cream internal rectangle has no Matter.js body and cannot bounce or block marbles.

A target is cleared only when its entire circle crosses one side of the internal boundary. For a target at `(x, y)` with radius `r`, it is outside when any condition is true:

```text
Right edge:  x - r > boundary.right
Left edge:   x + r < boundary.left
Bottom edge: y - r > boundary.bottom
Top edge:    y + r < boundary.top
```

The first frame that satisfies this rule atomically marks the target as cleared before any counter or removal operation, guaranteeing exactly one increment. A small particle burst is spawned, and a render-only snapshot remains briefly to fade and scale down. Its Matter.js body is removed safely from the world and its identifier is retained in the round's cleared set, so the target cannot be restored during that round. The shooter is excluded by body kind and never increments the cleared counter. If it leaves the scoring boundary, it remains governed by the outer walls until the turn settles.

Turn settlement uses both speed and duration. Every active body must remain below a small linear-speed threshold for multiple consecutive frames. This avoids ending the turn during a momentary low-speed collision or Matter.js jitter.

## GitHub-Derived Technical Direction

The implementation adopts the strongest patterns found during the GitHub review:

- From CarromMaster: centralized physics constants, virtual game dimensions, pull-back aiming, dotted trajectory feedback, collision-driven audio, velocity-based turn settlement, and a distinct render object for each Matter.js body.
- From Matter.js and its examples: a zero-gravity engine, circular rigid bodies, collision events, safe `Composite.remove` body lifecycle, optional sleeping, and deterministic fixed-step updates.
- From the lightweight Canvas projects: a direct `update -> render -> requestAnimationFrame` loop, responsive Canvas sizing, unified pointer input, and no backend dependency.

The implementation intentionally avoids the weaknesses found in the comparison projects. It will not place all rules, rendering, input, and physics in one large scene; it will not copy unlicensed source; and it will not add Phaser, PixiJS, Capacitor, multiplayer, or CPU-opponent systems.

## Architecture

The project uses TypeScript, Vite, Matter.js, Canvas 2D, CSS, and the Web Audio API. TypeScript compiles to browser JavaScript and provides explicit types for the state machine, level definition, Matter.js body metadata, pointer intents, and render effects.

Proposed files:

```text
index.html
package.json
tsconfig.json
src/
  main.ts
  styles.css
  config.ts
  levels/
    levels.ts
    validateLevel.ts
  game/
    Game.ts
    gameState.ts
    rules.ts
  physics/
    PhysicsWorld.ts
  input/
    ShotController.ts
  render/
    CanvasRenderer.ts
  audio/
    AudioManager.ts
  storage/
    ProgressStore.ts
  ui/
    LevelSelect.ts
tests/
  rules.test.ts
  shot.test.ts
  settle.test.ts
  levels.test.ts
  progress.test.ts
```

Responsibilities:

- `main.ts` creates the game after the DOM is ready.
- `config.ts` owns virtual dimensions, colors, physics tuning, marble sizes, boundary geometry, and global shot constraints.
- `Game.ts` owns the state machine, selected-level lifecycle, move count, cleared count, win/loss evaluation, and animation-frame loop.
- `rules.ts` contains pure geometry and scoring functions, including the full-circle boundary rule.
- `PhysicsWorld.ts` creates bodies and outer walls, advances Matter.js at a fixed timestep, applies shots, removes cleared bodies, and reports body movement.
- `ShotController.ts` owns the active pointer, pointer capture lifecycle, coordinate conversion, positioning clamp, aim gesture, minimum-drag validation, upward-only vector validation, and power clamp. It emits positioning or shot intents and does not mutate physics directly.
- `CanvasRenderer.ts` draws the background, scoring boundary, baseline, marbles, guide, power feedback, trails, particles, and end-state effects.
- `AudioManager.ts` lazily creates a Web Audio context after user interaction and produces short synthesized collision and clearing sounds without media assets.
- `levels.ts` exports immutable level definitions containing normalized target positions and all level-specific rules.
- `validateLevel.ts` converts normalized positions into scoring-boundary coordinates and rejects invalid or overlapping layouts before gameplay starts.
- `ProgressStore.ts` reads and writes a versioned localStorage record containing completed levels and each level's best star result.
- `LevelSelect.ts` renders the level grid, lock state, earned stars, and selected-level navigation with semantic HTML controls.

The gameplay model and Canvas effects remain separate. Removing a physics body does not prevent its visual clearing animation from completing.

The HUD and overlays are semantic HTML layered around or above the Canvas rather than pixels drawn into it. Native buttons provide mouse, touch, Enter, and Space activation. Visible focus styles, programmatic initial focus, appropriate headings/status text, and focus containment keep terminal overlays keyboard-operable. When an overlay closes, focus returns to the relevant game control.

`config.ts` also exports a `DEBUG_PHYSICS` constant that defaults to `false`. When enabled, the renderer overlays collision circles, body identifiers, velocity vectors, the nonphysical scoring rectangle, each target's radius-aware extents, and the currently satisfied boundary condition. Debug rendering never changes body properties, timing, scoring, or input behavior and is excluded from the normal visual presentation.

## Visual Direction

Required palette:

- Background: `#263944`
- Boundary: `#EAD6AD`
- Shooter: `#F3BE5D`
- Text: warm off-white
- Targets: restrained teal, blue, green, and violet variations

Marbles use radial gradients, a bright upper-left highlight, a subtle darker rim, and a soft shadow to suggest glass without external assets. The aiming guide and feedback remain understated and readable. Effects are short and do not delay the next turn after physics has settled.

## Levels and Progression

All gameplay uses one shared engine. A level is immutable data with this shape:

```ts
interface LevelDefinition {
  id: number;
  name: string;
  moveLimit: number;
  threeStarThreshold: number;
  twoStarThreshold: number;
  targets: Array<{
    x: number;
    y: number;
    color: TargetColor;
  }>;
  formation?: {
    kind: string;
    description?: string;
  };
}
```

Target coordinates are normalized within the internal scoring rectangle, where `(0, 0)` is its top-left and `(1, 1)` is its bottom-right. Conversion reserves at least one marble radius from every scoring edge. This preserves the intended formation across portrait screen sizes without duplicating placement or gameplay logic.

The twelve levels use these formations in increasing difficulty:

1. Compact triangle
2. Three horizontal rows
3. Diamond
4. Vertical column
5. Two separated clusters
6. Zigzag
7. Circular formation
8. V formation
9. Wide scattered pattern
10. Dense central cluster
11. Symmetrical side clusters
12. Mixed formation

Every definition includes a stable ID and name, target positions and colors, move limit, three-star threshold, two-star threshold, and optional formation metadata. Move and star thresholds are tuned per formation; the three-star threshold is always less than or equal to the two-star threshold, and both remain within the move limit.

Before a level can start, the validator maps every normalized coordinate into virtual game coordinates and confirms that each target:

- Is fully inside the internal scoring rectangle.
- Is fully inside the visible Canvas.
- Does not overlap another target, using the sum of both radii plus a small safety gap.
- Does not overlap the shooter at its initial baseline position.
- Uses an allowed color and finite normalized coordinates.

Invalid development data throws a descriptive error containing the level ID and target indexes. Tests validate all shipped definitions, so an invalid formation fails before publication rather than producing a partly playable level.

Level 1 is unlocked initially. Completing level `N` permanently unlocks level `N + 1`. Replaying a level can improve its stored star result but never reduces it. Progress is stored in a versioned, validated localStorage document; missing, malformed, or incompatible data safely falls back to level 1 unlocked with zero stars.

The level-select screen uses semantic buttons and shows all twelve levels, earned stars, completed status, and a clear locked state. Locked levels cannot be opened through pointer, keyboard, or direct UI interaction. Returning from gameplay restores focus to the previously selected level.

Each round stores `originalTargetTotal` from its selected level when created. This value never changes as bodies are removed. The HUD displays remaining moves and `cleared / originalTargetTotal`.

## Outcomes

A win is evaluated only after the shot settles and resetting has finalized all clear events. It occurs when the cleared count equals `originalTargetTotal`. The terminal overlay shows:

- `LEVEL COMPLETE`
- Moves used, calculated as `moveLimit - movesLeft`
- Marbles cleared as `cleared / originalTargetTotal`
- One to three stars from the selected level's configurable thresholds
- `Replay`, which starts a clean copy of the current level
- `Next Level`, which opens the newly unlocked next level; after level 12 it returns to level selection with an `All levels complete` message

Three stars are awarded when moves used are at or below the level's three-star threshold, two stars when at or below its two-star threshold, and one star for any other valid win within the move limit.

A loss is evaluated only after the final allowed shot has fully settled, clear events have been finalized, and targets remain. The terminal overlay shows:

- `OUT OF MOVES`
- Marbles cleared as `cleared / originalTargetTotal`
- `Retry`, which starts a clean copy of the same level

Win and loss dispatch through one guarded `finishRound(outcome)` path. An immutable terminal flag is set before updating the interface or emitting internal game events, so repeated frames, multiple clear events, or repeated button input cannot create duplicate terminal outcomes.

Restart, Replay, and Retry use the same round-reset operation, ensuring bodies, counters, effects, pointer capture, pause state, and terminal guards are reset consistently.

## Testing and Verification

Development follows test-first implementation for pure gameplay behavior. Automated tests cover:

- A marble touching or overlapping the boundary is not cleared.
- A marble is cleared only after its complete radius crosses each side.
- A cleared target increments the counter once, is safely removed from physics, and cannot return during the round.
- The shooter cannot affect the target-cleared count.
- Initial target bodies do not overlap and all target radii and masses match.
- Equivalent initial state and shot vectors produce equivalent physics outcomes within a defined tolerance.
- Fixed-step catch-up is capped after long render gaps.
- Invalid or too-short shots do not consume moves.
- Valid shot vectors point upward and respect maximum power.
- Position drags are clamped to the baseline and never consume moves.
- Pointer cancellation restores the last safe state without firing.
- Rapid taps cannot launch a shot or decrement the move counter.
- Pointer capture preserves a drag that leaves the Canvas until release or cancellation.
- Mouse and touch-style pointer input follow the same state transitions.
- Settlement requires every active body to remain slow for the required consecutive frames.
- Settled bodies are zeroed or put to sleep so micro-jitter cannot indefinitely delay reset.
- Win and loss conditions are evaluated only after settlement.
- The original target total remains unchanged after bodies are cleared or removed.
- The final allowed shot cannot lose until its physics and clear events finish.
- Multiple update frames and simultaneous clear events can emit only one terminal outcome.
- Star awards follow configurable move thresholds at their boundary values.
- Pause/resume preserves gameplay state, counters, body state, and deterministic timing.
- Restart, Replay, and Retry create equivalent clean rounds.
- All twelve level definitions pass bounds, finite-coordinate, allowed-color, shooter-clearance, and pairwise-overlap validation.
- Normalized coordinates preserve valid layouts when mapped to supported portrait sizes.
- Completing a level unlocks only its immediate successor.
- Replaying can improve but never reduce stored stars.
- Malformed or incompatible stored progress falls back safely.
- Locked levels cannot start through UI activation.

Final verification includes:

- The complete automated test suite.
- A production Vite build.
- Browser interaction checks at portrait mobile and desktop sizes.
- Mouse and touch-style positioning, aiming, shooting, short drags, cancelled gestures, rapid taps, out-of-Canvas dragging, locked input during motion, clearing, one-shot counter updates, particle/fade completion, HUD updates, shooter reset, replay, pointer capture cleanup, and page-scroll prevention.
- Debug mode visually confirms body circles, velocities, scoring extents, and boundary crossings without changing simulation results.
- HUD placement and controls are checked at portrait mobile and desktop sizes.
- Level selection, restart, pause/resume, sound, Replay, Retry, and Next Level are verified with keyboard, mouse, and touch-style input.
- Win and loss overlays receive focus, contain keyboard navigation, and do not open more than once per round.
- Every level is loaded through the shared engine, visually inspected for initial overlap/bounds problems, and exercised through at least one valid shot.
- A console check for runtime errors.

## Explicit Non-Goals

- Daily challenge
- Backend, accounts, login, networking, or multiplayer
- Shops, coins, advertisements, energy systems, or monetization
- External images or prerecorded audio
- Native packaging
- Deployment or hosting

## Completion Criteria

The task is complete when the project can be installed and started locally, all twelve validated levels are selectable according to saved progression and playable through the shared engine with pointer and touch-style input, the full required loop operates without manual intervention, the internal rectangle behaves only as a scoring threshold, stars and unlocks persist locally, automated tests pass, the production build succeeds, and browser verification finds no blocking interaction or layout defect.
