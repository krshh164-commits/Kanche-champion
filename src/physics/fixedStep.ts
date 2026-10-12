export class FixedStepClock {
  private accumulator = 0;

  constructor(private readonly stepMs: number, private readonly maxSteps: number) {}

  consume(frameDeltaMs: number): number {
    const safeDelta = Number.isFinite(frameDeltaMs) ? Math.max(0, frameDeltaMs) : 0;
    this.accumulator += Math.min(safeDelta, this.stepMs * this.maxSteps);
    const steps = Math.min(this.maxSteps, Math.floor((this.accumulator + 1e-9) / this.stepMs));
    this.accumulator -= steps * this.stepMs;
    if (steps === this.maxSteps) this.accumulator = 0;
    return steps;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
