import type { RecordedAction } from './types.ts';

export class ActionRecorder {
  private actions: RecordedAction[] = [];

  constructor(private readonly maxSize: number = 50) {}

  record(action: RecordedAction) {
    this.actions.push(action);
    if (this.actions.length > this.maxSize) {
      this.actions.shift();
    }
  }

  getHistory(): RecordedAction[] {
    return [...this.actions];
  }

  clear() {
    this.actions = [];
  }
}
