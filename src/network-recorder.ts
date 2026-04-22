import type { RecordedNetworkEvent } from './types.ts';

export class NetworkRecorder {
  private events: RecordedNetworkEvent[] = [];

  constructor(private readonly maxSize: number = 50) {}

  record(event: RecordedNetworkEvent) {
    this.events.push(event);
    if (this.events.length > this.maxSize) {
      this.events.shift();
    }
  }

  getHistory(): RecordedNetworkEvent[] {
    return [...this.events];
  }

  clear() {
    this.events = [];
  }
}
