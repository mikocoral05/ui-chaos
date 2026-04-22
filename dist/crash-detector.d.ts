import type { CrashKind } from './types.ts';
export interface CrashDetection {
    kind: CrashKind;
    reason: string;
    timestamp: number;
}
interface CrashDetectorOptions {
    target: HTMLElement;
    detectTargetRemoval: boolean;
    detectEmptyTarget: boolean;
    onCrash: (detection: CrashDetection) => void;
}
export declare class CrashDetector {
    private readonly options;
    private observer;
    private started;
    private didTargetEverHaveContent;
    constructor(options: CrashDetectorOptions);
    start(): void;
    stop(): void;
    private handleError;
    private handleRejection;
    private evaluateTargetState;
    private hasMeaningfulContent;
}
export {};
//# sourceMappingURL=crash-detector.d.ts.map