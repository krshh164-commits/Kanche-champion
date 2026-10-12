import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/fill';
import './styles.css';
import { Game } from './game/Game';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app');

app.className = 'app-shell';
app.innerHTML = `
  <section id="game-screen" class="game-screen" aria-label="Kanche level one">
    <div id="hud"></div>
    <div class="canvas-wrap"><canvas id="game-canvas" aria-label="Kanche playfield"></canvas></div>
    <p class="game-hint"><strong>Swipe</strong> the gold marble toward your shot.</p>
  </section>`;

const game = new Game(
  document.querySelector<HTMLCanvasElement>('#game-canvas')!,
  document.querySelector<HTMLElement>('#hud')!,
);

game.startLevel(1);
