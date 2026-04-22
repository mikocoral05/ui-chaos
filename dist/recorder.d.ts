import type { RecordedAction } from './types.ts';
export declare class ActionRecorder {
    private readonly maxSize;
    private actions;
    constructor(maxSize?: number);
    record(action: RecordedAction): void;
    getHistory(): RecordedAction[];
    clear(): void;
}
//# sourceMappingURL=recorder.d.ts.map