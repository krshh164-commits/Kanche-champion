# Kanche

A mobile-first, single-level marble game built with TypeScript, Vite, Canvas 2D, and Matter.js.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Validation commands:

```sh
npm test -- --run
npm run build
npm run test:e2e
```

## First level

- Six large teal target marbles in a compact 3–2–1 formation.
- One larger amber shooter and six available moves.
- Warm cream mobile shell with a deep-teal playfield.
- Separate floating cards for moves, objective progress, and pause.

## Controls

1. Drag the amber shooter horizontally and release to confirm its position. This does not consume a move.
2. Press it again, pull backward, and release to shoot.
3. Very short pulls and downward launches are rejected.
4. Input remains locked until every active marble settles.

The cream rectangle is a scoring threshold, not a physical wall. Targets clear only after their full radius crosses it.

## Reference and limitations

The visual reference is preserved at `docs/references/clay-visual-reference.md`. Progress is not persisted because this version intentionally contains only one level. Physics is repeatable within the same browser/runtime but may not be bit-identical across different browser engines.
