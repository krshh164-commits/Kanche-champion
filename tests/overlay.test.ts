// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEVELS } from '../src/levels/levels';
import { Hud } from '../src/ui/Hud';

afterEach(() => { document.body.innerHTML = ''; });

describe('HUD', () => {
  it('renders live moves and only the supplied color objectives', () => {
    const root = document.createElement('div');
    const hud = new Hud(root, { levels: LEVELS, onSelectLevel: vi.fn() });
    hud.update({
      movesLeft: 6,
      cleared: 0,
      targetTotal: 6,
      paused: false,
      currentLevelId: 1,
      objectives: [{ color: 'teal', remaining: 6 }],
    });
    expect(root.querySelector('.hud-value > .p9-char')?.textContent).toBe('6');
    expect(root.querySelector('[aria-label="6 teal marbles remaining"] > .p9-char')?.textContent).toBe('6');
    expect(root.querySelectorAll('.objective-count')).toHaveLength(1);

    hud.update({
      movesLeft: 5,
      cleared: 1,
      targetTotal: 6,
      paused: false,
      currentLevelId: 1,
      objectives: [{ color: 'teal', remaining: 5 }],
    });
    expect(root.querySelector('.hud-value > .p9-char')?.textContent).toBe('5');
    expect(root.querySelector('[aria-label="5 teal marbles remaining"]')).not.toBeNull();
    expect(root.querySelector('[aria-label*="blue"]')).toBeNull();
  });

  it('animates only numbers whose displayed value changed', () => {
    const root = document.createElement('div');
    const hud = new Hud(root, { levels: LEVELS, onSelectLevel: vi.fn() });
    hud.update({
      movesLeft: 6,
      cleared: 0,
      targetTotal: 8,
      paused: false,
      currentLevelId: 3,
      objectives: [
        { color: 'green', remaining: 4 },
        { color: 'blue', remaining: 4 },
      ],
    });

    expect(root.querySelector('.is-animating')).toBeNull();

    hud.update({
      movesLeft: 5,
      cleared: 1,
      targetTotal: 8,
      paused: false,
      currentLevelId: 3,
      objectives: [
        { color: 'green', remaining: 4 },
        { color: 'blue', remaining: 3 },
      ],
    });

    const moves = root.querySelector<HTMLElement>('[data-number-key="moves"]');
    const green = root.querySelector<HTMLElement>('[data-number-key="objective-green"]');
    const blue = root.querySelector<HTMLElement>('[data-number-key="objective-blue"]');
    expect(moves?.classList.contains('is-animating')).toBe(true);
    expect(moves?.querySelector(':scope > .p9-char')?.textContent).toBe('5');
    expect(moves?.querySelector('.p9-ghost')?.textContent).toBe('6');
    expect(green?.classList.contains('is-animating')).toBe(false);
    expect(green?.querySelector('.p9-ghost')).toBeNull();
    expect(blue?.classList.contains('is-animating')).toBe(true);
    expect(blue?.querySelector(':scope > .p9-char')?.textContent).toBe('3');
    expect(blue?.querySelector('.p9-ghost')?.textContent).toBe('4');
  });

  it('renders 20 level slots from saved progress without making unbuilt levels playable', () => {
    const root = document.createElement('div');
    const onSelectLevel = vi.fn();
    const hud = new Hud(root, {
      levels: LEVELS,
      onSelectLevel,
      getProgress: () => ({ completedLevels: { '1': 2, '2': 3 }, highestUnlockedLevel: 20 }),
    });
    hud.update({ movesLeft: 6, cleared: 0, targetTotal: 6, paused: false, currentLevelId: 2, objectives: [{ color: 'teal', remaining: 6 }] });

    const levelTrigger = root.querySelector<HTMLButtonElement>('[aria-label="Choose level"]');
    expect(levelTrigger).not.toBeNull();
    levelTrigger?.click();
    expect(root.querySelector('[role="dialog"][aria-label="Choose a level"]')).not.toBeNull();
    expect(root.querySelector('.level-page')).not.toBeNull();
    expect(root.querySelectorAll('.level-option')).toHaveLength(20);

    const completed = root.querySelector<HTMLButtonElement>('.level-option[data-level-id="1"]')!;
    const current = root.querySelector<HTMLButtonElement>('.level-option[data-level-id="2"]')!;
    const unlocked = root.querySelector<HTMLButtonElement>('.level-option[data-level-id="6"]')!;
    const unbuilt = root.querySelector<HTMLButtonElement>('.level-option[data-level-id="7"]')!;
    expect(completed.classList.contains('is-completed')).toBe(true);
    expect(completed.classList.contains('is-current')).toBe(false);
    expect(completed.disabled).toBe(false);
    expect(root.querySelectorAll('.level-option[data-level-id="1"] .ph-fill.ph-star')).toHaveLength(2);
    expect(root.querySelectorAll('.level-option[data-level-id="1"] .ph.ph-star')).toHaveLength(1);
    expect(current.classList.contains('is-completed')).toBe(true);
    expect(current.classList.contains('is-current')).toBe(true);
    expect(current.classList.contains('is-unlocked')).toBe(true);
    expect(current.getAttribute('aria-current')).toBe('step');
    expect(unlocked.classList.contains('is-unlocked')).toBe(true);
    expect(unlocked.disabled).toBe(false);
    expect(unbuilt.classList.contains('is-locked')).toBe(true);
    expect(unbuilt.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('.level-option[data-level-id="20"]')?.disabled).toBe(true);
    expect(root.querySelector('.level-option small')).toBeNull();

    unbuilt.click();
    expect(onSelectLevel).not.toHaveBeenCalled();
    unlocked.click();
    expect(onSelectLevel).toHaveBeenCalledWith(6);
    expect(root.querySelector('[aria-label="Pause game"]')).toBeNull();
    expect(root.querySelector('[aria-label="Resume game"]')).toBeNull();
    expect(root.querySelectorAll('.hud-card')).toHaveLength(3);
  });

});
