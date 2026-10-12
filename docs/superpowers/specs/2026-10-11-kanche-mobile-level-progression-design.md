# Kanche Mobile UI and Three-Level Progression Design

## Goal

Redesign Kanche as a clean portrait-first mobile game inspired by the supplied `iPhone 17 - 1.png` mockup. The mockup is a visual-language reference rather than a proportion template. The redesign keeps the current positioning, aiming, shooting, collision, clearing, settlement, move, and scoring behavior while adding a data-driven objective HUD, a level selector, three playable levels, saved progress, and fixed obstacle support.

## Source Reference and Interpretation

The visual reference is `C:\Users\anasw\Downloads\iPhone 17 - 1.png`.

Use these traits from the reference:

- Three separate rounded white cards across the top.
- Soft shadows, restrained colors, compact typography, and generous whitespace.
- Colored outlined objective circles containing remaining counts.
- A thin, dark, rounded game-board outline.
- A pale rounded shooter track near the bottom.
- Large, simple circular marbles and a thin aiming guide.
- A small grid icon for level selection.

Do not reproduce the reference's exact proportions or its obstacle placement. The Kanche board should use the available portrait viewport efficiently. Level 1 and Level 2 contain no obstacles. Level 3 contains one square fixed obstacle at the top center.

## Scope

This release contains three playable levels and twelve visible selector slots:

1. Level 1: six teal targets in a compact balanced 3–2–1 formation; no obstacles.
2. Level 2: six teal targets spaced farther apart in a staggered or zigzag formation; no obstacles.
3. Level 3: six targets split into three teal and three blue targets, arranged so both colors remain legible around one fixed square obstacle at the top center.
4. Levels 4–12: visible as locked future slots and not selectable.

Completing Level 1 unlocks Level 2. Completing Level 2 unlocks Level 3. Completing Level 3 records completion but does not unlock a nonexistent playable level. The existing one-round gameplay rules, fixed-step physics, scoring-boundary behavior, pointer controls, and 48-by-48 virtual-pixel marble bodies remain unchanged except where obstacle collision requires a new static body type.

## Mobile Layout

The page fills the viewport, respects safe-area insets, and prevents document scrolling. Content is centered in a portrait shell with no horizontal overflow.

The screen has three rows:

1. A fixed-height top bar with three cards.
2. A flexible board region that takes the remaining height.
3. A compact instruction line below the board when space permits.

The board and top bar scale together within the available viewport. The board never sits beneath the top bar. Every interactive control has at least a 44-by-44 CSS-pixel hit target.

### Top Bar

The top bar contains:

- Moves card: a large remaining-moves number with the label `MOVES` below it.
- Objectives card: one outlined circle for each target color currently present on the board. Each circle contains the remaining count for that color.
- Level card: a grid-icon button that opens the level selector.

The cards use white surfaces, 12–16px corner radii, subtle gray borders where needed, and soft low-contrast shadows. The objectives card grows to use available horizontal space while the outer cards remain compact.

Objective circles are derived from the selected level's target data, not hard-coded markup. Level 1 and Level 2 show one teal circle containing `6` at round start. Level 3 shows a teal circle containing `3` and a blue circle containing `3`. Counts update immediately after cleared targets are finalized. A color remains represented with `0` through the terminal result so the round's objective is still understandable.

The grid icon must come from an installed icon library or a small external icon package already appropriate for the project; it must not be an emoji, text glyph, or handcrafted SVG.

### Board

The board uses a light off-white fill with a thin dark rounded outer border. The internal scoring boundary remains visibly distinct but is still only a scoring threshold and has no collision body. Screen-edge containment remains separate.

The shooter baseline becomes a pale rounded track near the bottom. The shooter stays visually distinct from all target colors. The aiming guide remains thin, high-contrast, and visible beneath a finger without dominating the board.

Targets and shooter remain circles with a 24-unit radius in the 420-by-780 virtual coordinate system. CSS and Canvas scaling fit the board to the actual device. The existing pointer hit expansion continues to provide a forgiving touch target.

## Level and Obstacle Data

Level definitions remain immutable data consumed by one shared game engine. Extend the definition with optional obstacles:

```ts
interface ObstacleDefinition {
  id: string;
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
}

interface LevelDefinition {
  id: number;
  name: string;
  moveLimit: number;
  threeStarThreshold: number;
  twoStarThreshold: number;
  targets: TargetDefinition[];
  obstacles?: ObstacleDefinition[];
  formation?: FormationMetadata;
}
```

Target and obstacle coordinates are normalized within the board's internal scoring region, then resolved into virtual coordinates. Level validation rejects:

- Non-finite or out-of-range normalized coordinates.
- Target-target overlaps.
- Target-obstacle overlaps.
- Target-shooter overlaps.
- Obstacles outside the board or scoring region.
- Duplicate obstacle identifiers.
- Unsupported target colors or obstacle shapes.

The Level 3 square obstacle is centered horizontally near the top of the scoring region, with enough clearance from the scoring edge and all initial marbles. It becomes a static Matter.js rectangle using the game's existing restitution value and Matter.js's default static-body friction. It never moves, counts as a target, clears, fades, or affects objective totals. The renderer draws it as a restrained dark neutral square that fits the new visual system.

## Gameplay and Physics Integration

Existing game states remain unchanged:

1. `positioning`
2. `aiming`
3. `shot`
4. `settling`
5. `resetting`

Starting a level resolves its target and obstacle data, validates the layout, creates target circles, creates optional static obstacles, resets counters, and updates the HUD. The fixed timestep, outer walls, target clearing checks, settlement thresholds, shot calculation, and input lock during movement remain unchanged.

Obstacle collisions are handled entirely by Matter.js. No post-collision velocity normalization, random force, or manual momentum injection is added. Obstacles participate in collision sound intensity but not clearing logic.

## Per-Color Objectives

At round start the game computes two maps from target data:

- `originalByColor`: the original number of targets for each color.
- `remainingByColor`: the current uncleared count for each color.

When a target clears exactly once, its color's remaining count decreases exactly once. The overall cleared counter and win condition continue to use the round's immutable original total. The HUD receives an ordered list of objective entries. Their order follows first appearance in the level's target data so it remains stable throughout the round.

## Level Selector

The grid button opens a modal bottom sheet optimized for portrait screens. It contains a title, a close button, and a three-column numbered grid for Levels 1–12. Each square button has at least a 44-by-44 CSS-pixel hit target.

States are visually and semantically distinct:

- Current: strong outline and `aria-current="step"`.
- Completed: check indicator plus earned stars.
- Unlocked: enabled numbered button.
- Locked: muted lock indicator and disabled behavior.

Levels 1–3 can become unlocked. Levels 4–12 remain locked because no definitions exist. Locked slots cannot start through mouse, touch, keyboard, or programmatic click handling.

The sheet closes when the user:

- Selects an unlocked level.
- Activates the close button.
- Taps the backdrop outside the sheet.
- Presses Escape.

Opening the sheet moves focus to its heading or close button. Keyboard focus remains inside while open. Closing restores focus to the grid button. Selecting a level starts a clean round immediately.

## Progress Storage

Progress uses a versioned localStorage record:

```ts
interface StoredProgressV1 {
  version: 1;
  completedLevelIds: number[];
  bestStarsByLevel: Record<string, number>;
}
```

Rules:

- Level 1 is always unlocked.
- Completing a playable level records it as completed.
- Completing Level 1 unlocks Level 2; completing Level 2 unlocks Level 3.
- Replaying may improve a stored star score but never reduce it.
- Unknown level IDs, invalid star values, malformed JSON, storage access errors, and incompatible versions fall back safely to clean progress without preventing play.
- Progress is written only after a confirmed win, never after a loss, restart, or partial round.

## Outcome Flow

The existing guarded win and loss evaluation remains settlement-driven. The win overlay keeps Replay and adds Next Level when a playable next level exists. After Level 3, the primary continuation action opens the selector rather than attempting to start Level 4. Retry continues to restart the current level after a loss.

Winning updates progress before rendering the terminal overlay so the level selector and Next Level state are immediately correct. Duplicate terminal events remain prevented by the existing one-outcome guard.

## Architecture Changes

Reuse the existing TypeScript, Vite, Canvas 2D, and Matter.js structure. Add narrowly scoped modules:

```text
src/
  levels/
    levels.ts                 # Three playable definitions and selector slot metadata
    levelTypes.ts             # Target, obstacle, and resolved geometry types
    validateLevel.ts          # Target and obstacle validation/resolution
  physics/
    PhysicsWorld.ts           # Static obstacle bodies plus existing marble simulation
  render/
    CanvasRenderer.ts         # New board, baseline, obstacle, and objective-compatible palette
  storage/
    ProgressStore.ts          # Versioned, defensive localStorage persistence
  ui/
    Hud.ts                    # Moves, dynamic color objectives, level button
    LevelSelect.ts            # Accessible modal bottom sheet and level grid
    Overlay.ts                # Next Level or selector continuation
  game/
    Game.ts                   # Selected-level lifecycle and progress coordination
```

`main.ts` owns only shell creation and initial startup. `Game` coordinates level changes but does not directly manipulate localStorage or level-sheet markup. `ProgressStore` owns persistence. `LevelSelect` owns modal behavior and emits a selected level ID. `Hud` renders objective data received from the game model. Physics body creation and rendering remain separate.

## Accessibility and Responsive Behavior

- Buttons use native semantic elements and readable accessible names.
- All controls work with touch, mouse, Enter, and Space.
- The level sheet supports Escape, backdrop dismissal, initial focus, focus containment, and focus restoration.
- Visible focus states use high-contrast outlines.
- Color is not the only indicator of selector state; icons, labels, disabled state, and outlines reinforce meaning.
- Objective circles include accessible text such as `3 teal marbles remaining`.
- The board and controls remain fully visible from 320px-wide portrait screens upward without document scrolling.
- Safe-area padding protects controls from notches and home indicators.
- Canvas input retains `touch-action: none`, pointer capture, and scroll prevention during aiming.

## Testing and Verification

Implementation follows test-first development. Automated tests cover:

- Level 1 and Level 2 contain six teal targets and no obstacles.
- Level 2 targets are more dispersed than Level 1 and do not overlap.
- Level 3 contains three teal and three blue targets plus one top-center square obstacle.
- All three resolved layouts pass bounds and overlap validation.
- Invalid target-obstacle overlaps and invalid obstacle geometry are rejected.
- Physics creates Level 3's obstacle as static and obstacle collisions do not change target totals.
- Objective entries contain only colors present in the selected level.
- Per-color counts decrement exactly once for a cleared target.
- Level 1 and Level 2 begin with one objective circle showing `6`.
- Level 3 begins with teal `3` and blue `3`.
- Progress unlocks only existing successor levels and stores best stars without regression.
- Malformed or unavailable localStorage falls back safely.
- Locked level buttons cannot start levels.
- Level-sheet close methods and keyboard focus behavior work.
- Next Level starts Level 2 or Level 3 after a win and opens the selector after Level 3.
- Existing movement, aiming, shot, clearing, settlement, pause, restart, and outcome tests continue to pass.

Final verification includes the complete unit suite, production build, and browser tests at desktop and narrow portrait sizes. Browser checks cover the three HUD states, sheet open/close paths, level selection, saved progression reload, obstacle rendering and collision, touch-style shooting, no page scrolling, console errors, and the full Level 1 through Level 3 unlock path. Visual QA compares the implementation against the supplied mockup at a matching portrait viewport while allowing intentionally different proportions and Kanche-specific content.

## Non-Goals

- Playable Levels 4–12.
- Obstacles in Level 1 or Level 2.
- Exact pixel-for-pixel reproduction of the mockup.
- New physics tuning or changed shot behavior.
- Backend, login, cloud sync, multiplayer, shop, ads, or monetization.
- New image assets, decorative illustration, or mockup obstacle patterns beyond Level 3's single square.

## Completion Criteria

The redesign is complete when the responsive top cards, dynamic objective circles, off-white board, rounded baseline track, accessible level sheet, three playable data-driven levels, Level 3 static square obstacle, saved completion and stars, Next Level flow, and all existing gameplay mechanics work together without horizontal or document scrolling. All automated checks, the production build, browser interaction tests, and visual QA must pass before handoff.
