import type { LevelDefinition, TargetColor } from '../levels/levelTypes';
import type { SavedProgress } from '../game/progress';

const LEVEL_SLOT_COUNT = 20;

export interface ColorObjective {
  color: TargetColor;
  remaining: number;
}

export interface HudState {
  movesLeft: number;
  cleared: number;
  targetTotal: number;
  paused: boolean;
  currentLevelId: number;
  objectives: readonly ColorObjective[];
}

interface HudOptions {
  levels: readonly LevelDefinition[];
  onSelectLevel(levelId: number): void;
  getProgress?(): SavedProgress;
}

export class Hud {
  private state: HudState = { movesLeft: 0, cleared: 0, targetTotal: 0, paused: false, currentLevelId: 1, objectives: [] };
  private hasRendered = false;

  constructor(private readonly root: HTMLElement, private readonly options: HudOptions) {}

  update(state: HudState): void {
    const previousState = this.state;
    this.state = state;
    this.render(this.hasRendered ? previousState : null);
    this.hasRendered = true;
  }

  private render(previousState: HudState | null) {
    this.root.className = 'game-topbar';
    this.root.innerHTML = `
      <div class="hud-card hud-card--moves" aria-live="polite">
        ${this.renderNumber('moves', this.state.movesLeft, 'hud-value', `${this.state.movesLeft} moves left`)}<span class="hud-label">MOVES</span>
      </div>
      <div class="hud-card hud-card--objective" aria-live="polite">
        <span class="sr-only">OBJECTIVE ${this.state.cleared} / ${this.state.targetTotal}</span>
        <div class="objective-list">${this.state.objectives.map(({ color, remaining }) => `
          ${this.renderNumber(`objective-${color}`, remaining, `objective-count objective-count--${color}`, `${remaining} ${color} marbles remaining`)}`).join('')}</div>
      </div>
      <div class="hud-card hud-card--control">
        <button type="button" class="icon-button level-button" aria-label="Choose level" title="Choose level"><i class="ph ph-squares-four" aria-hidden="true"></i><span class="level-button__label">LEVEL ${this.state.currentLevelId}</span></button>
      </div>
      <div class="level-sheet-backdrop" hidden>
        <section class="level-page" role="dialog" aria-modal="true" aria-label="Choose a level">
          <h2 class="sr-only">Choose a level</h2>
          <button type="button" class="icon-button level-sheet__close" aria-label="Close level selector"><i class="ph ph-x" aria-hidden="true"></i></button>
          <div class="level-grid">${Array.from({ length: LEVEL_SLOT_COUNT }, (_, index) => this.renderLevelOption(index + 1)).join('')}</div>
        </section>
      </div>`;
    this.animateChangedNumbers(previousState);
    this.root.querySelector<HTMLButtonElement>('.level-button')?.addEventListener('click', () => this.openLevelSelector());
    this.root.querySelector<HTMLButtonElement>('.level-sheet__close')?.addEventListener('click', () => this.closeLevelSheet());
    this.root.querySelector<HTMLElement>('.level-sheet-backdrop')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) this.closeLevelSheet();
    });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('.level-option')) {
      button.addEventListener('click', () => {
        const levelId = Number(button.dataset.levelId);
        this.closeLevelSheet();
        this.options.onSelectLevel(levelId);
      });
    }
    this.root.onkeydown = (event) => {
      if (event.key === 'Escape') this.closeLevelSheet();
    };
  }

  private renderLevelOption(levelId: number): string {
    const progress = this.options.getProgress?.();
    const level = this.options.levels.find(({ id }) => id === levelId);
    const stars = level ? Math.min(3, Math.max(0, progress?.completedLevels[String(levelId)] ?? 0)) : 0;
    const current = levelId === this.state.currentLevelId;
    const unlocked = Boolean(level) && levelId <= (progress?.highestUnlockedLevel ?? 1);
    const completed = Boolean(level) && stars > 0;
    const locked = !unlocked;
    const classes = [
      'level-option',
      current ? 'is-current' : '',
      completed ? 'is-completed' : '',
      unlocked ? 'is-unlocked' : 'is-locked',
    ].filter(Boolean).join(' ');
    const starIcons = [1, 2, 3].map((star) => `<i class="${star <= stars ? 'ph-fill' : 'ph'} ph-star" aria-hidden="true"></i>`).join('');
    const label = level ? `${levelId} ${level.name}, ${stars} of 3 stars${locked ? ', locked' : ''}` : `Level ${levelId}, locked`;
    return `<button type="button" class="${classes}" data-level-id="${levelId}" aria-label="${label}"${current ? ' aria-current="step"' : ''}${locked ? ' disabled' : ''}><span class="level-option__number">${levelId}</span><span class="level-option__stars" aria-hidden="true">${starIcons}</span></button>`;
  }

  private renderNumber(key: string, value: number, className: string, ariaLabel: string): string {
    const chars = [...String(value)].map((char, index, all) => {
      const stagger = all.length > 1 && index >= all.length - 2 ? ` data-stagger="${index === all.length - 2 ? 1 : 2}"` : '';
      return `<span class="p9-char"${stagger} aria-hidden="true">${char}</span>`;
    }).join('');
    return `<span class="${className} p9-number" data-number-key="${key}" aria-label="${ariaLabel}">${chars}</span>`;
  }

  private animateChangedNumbers(previousState: HudState | null): void {
    if (!previousState) return;

    const previousValues = new Map<string, number>([
      ['moves', previousState.movesLeft],
      ...previousState.objectives.map(({ color, remaining }) => [`objective-${color}`, remaining] as const),
    ]);

    for (const number of this.root.querySelectorAll<HTMLElement>('[data-number-key]')) {
      const key = number.dataset.numberKey;
      if (!key) continue;
      const previousValue = previousValues.get(key);
      const currentValue = key === 'moves'
        ? this.state.movesLeft
        : this.state.objectives.find(({ color }) => `objective-${color}` === key)?.remaining;
      if (previousValue === undefined || currentValue === undefined || previousValue === currentValue) continue;

      const ghost = document.createElement('span');
      ghost.className = 'p9-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      const previousText = String(previousValue);
      for (const [index, char] of [...previousText].entries()) {
        const digit = document.createElement('span');
        digit.className = 'p9-char';
        digit.textContent = char;
        if (previousText.length > 1 && index >= previousText.length - 2) {
          digit.dataset.stagger = String(index === previousText.length - 2 ? 1 : 2);
        }
        ghost.append(digit);
      }
      number.append(ghost);
      number.classList.add('is-animating');
      window.setTimeout(() => ghost.remove(), 690);
    }
  }

  openLevelSelector(): void {
    const backdrop = this.root.querySelector<HTMLElement>('.level-sheet-backdrop');
    if (!backdrop) return;
    backdrop.hidden = false;
    this.root.querySelector<HTMLButtonElement>('.level-sheet__close')?.focus();
  }

  private closeLevelSheet(): void {
    const backdrop = this.root.querySelector<HTMLElement>('.level-sheet-backdrop');
    if (!backdrop || backdrop.hidden) return;
    backdrop.hidden = true;
    this.root.querySelector<HTMLButtonElement>('.level-button')?.focus();
  }
}
