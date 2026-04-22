import type { RecordedNetworkEvent } from './types.ts';
export declare class NetworkRecorder {
    private readonly maxSize;
    private events;
    constructor(maxSize?: number);
    record(event: RecordedNetworkEvent): void;
    getHistory(): RecordedNetworkEvent[];
    clear(): void;
}
//# sourceMappingURL=network-recorder.d.ts.map