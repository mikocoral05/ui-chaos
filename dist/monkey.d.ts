import { ActionRecorder } from './recorder.ts';
import type { RandomSource } from './random.ts';
import type { RecordedAction } from './types.ts';
export declare const DEFAULT_INTERACTION_SELECTOR = "button, input, select, textarea, a[href], [role=\"button\"], [tabindex]:not([tabindex=\"-1\"])";
export declare const DEFAULT_EXCLUDE_SELECTOR = "[data-chaos-ignore], [data-ui-chaos-ignore]";
interface ChaosMonkeyOptions {
    interactionSelector: string;
    excludeSelector: string;
    log: boolean;
    random: RandomSource;
}
export declare class ChaosMonkey {
    private readonly target;
    private readonly intervalMs;
    private readonly recorder;
    private readonly options;
    private intervalId;
    private actionCounter;
    constructor(target: HTMLElement, intervalMs: number, recorder: ActionRecorder, options: ChaosMonkeyOptions);
    get isRunning(): boolean;
    start(): boolean;
    stop(): void;
    runOnce(): RecordedAction | null;
    private getInteractables;
    private isEligibleElement;
    private pickActionType;
    private buildAction;
    private performAction;
    private applyInputValue;
    private applySelectValue;
    private applyScroll;
    private isTextLikeInput;
    private hasSelectableOptions;
    private pickOptionValue;
    private isScrollable;
    private pickScrollTop;
    private generateInputValue;
    private generateSelector;
    private getStableSelector;
    private escapeCssIdentifier;
    private escapeCssAttribute;
    private getElementCenter;
    private readElementText;
    private randomIndex;
    private matchesSelector;
    private hasMatchingAncestor;
    private log;
    private readBooleanProperty;
    private readStringProperty;
    private readNumberProperty;
    private readArrayProperty;
    private writeProperty;
}
export {};
//# sourceMappingURL=monkey.d.ts.map