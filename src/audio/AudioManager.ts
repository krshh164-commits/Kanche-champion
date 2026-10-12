type ContextFactory = () => AudioContext;

export class AudioManager {
  private context: AudioContext | null = null;
  private muted = false;
  private lastCollisionAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly createContext: ContextFactory = () => new AudioContext(),
    private readonly now: () => number = () => performance.now(),
  ) {}

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  playCollision(intensity: number): void {
    const time = this.now();
    if (this.muted || time - this.lastCollisionAt < 55) return;
    this.lastCollisionAt = time;
    this.tone(150 + Math.min(1, intensity) * 90, 0.045, 0.025);
  }

  playShot(): void {
    if (!this.muted) this.tone(190, 0.1, 0.045, 290);
  }

  playClear(): void {
    if (!this.muted) this.tone(520, 0.12, 0.04, 760);
  }

  private tone(from: number, duration: number, volume: number, to = from * 0.75): void {
    const context = this.context ??= this.createContext();
    if (context.state === 'suspended') void context.resume();
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
}
