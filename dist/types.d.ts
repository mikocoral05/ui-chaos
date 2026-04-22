export interface ChaosOptions {
    /**
     * The root element to observe and attack.
     * Defaults to document.body when running in the browser.
     */
    target?: HTMLElement | null;
    /** Milliseconds between random actions. Defaults to 100. */
    intervalMs?: number;
    /** Number of UI actions to retain in memory. Defaults to 50. */
    historySize?: number;
    /** Start chaos immediately after initialization. Defaults to true. */
    autoStart?: boolean;
    /**
     * Hard on/off switch. Useful for staging-only initialization:
     * enabled: import.meta.env.MODE === 'staging'
     */
    enabled?: boolean;
    /** Enable console logging. Defaults to true. */
    log?: boolean;
    /** Disable the UI monkey while keeping other chaos layers active. Defaults to true. */
    enableMonkey?: boolean;
    /** Optional deterministic seed shared across chaos layers. */
    seed?: number;
    /**
     * CSS selector used to discover candidate elements.
     * Defaults to buttons, links, inputs, selects, and tabbable controls.
     */
    interactionSelector?: string;
    /**
     * CSS selector used to opt specific elements out of chaos testing.
     * Defaults to `[data-chaos-ignore], [data-ui-chaos-ignore]`.
     */
    excludeSelector?: string;
    /** Network/API chaos configuration. Disabled by default. */
    network?: NetworkChaosOptions;
    /** Export format to generate when a crash is detected. Defaults to 'playwright'. */
    exportFormat?: ExportFormat;
    /** Automatically download generated tests after a crash. Defaults to true. */
    downloadOnCrash?: boolean;
    /** Override the captured URL used in exported test files. */
    initialUrl?: string;
    /** Base file name used for downloaded repro files. */
    baseFileName?: string;
    /**
     * Detect when the target element is removed from the document.
     * Defaults to true.
     */
    detectTargetRemoval?: boolean;
    /**
     * Detect when a previously populated target becomes empty.
     * Defaults to false to avoid false positives on valid empty states.
     */
    detectEmptyTarget?: boolean;
    /**
     * Called when ui-chaos believes it reproduced a crash.
     * Use this to persist scenarios to your own backend instead of downloading.
     */
    onCrash?: (event: ChaosCrashEvent) => void;
}
export interface NetworkChaosOptions {
    /** Enable network/API chaos. Defaults to false. */
    enabled?: boolean;
    /** Number of network events to retain in memory. Defaults to the global historySize. */
    historySize?: number;
    /** Minimum delay applied to matching requests in milliseconds. Defaults to 0. */
    minDelayMs?: number;
    /** Maximum delay applied to matching requests in milliseconds. Defaults to minDelayMs. */
    maxDelayMs?: number;
    /** Chance between 0 and 1 that a matching request fails. Defaults to 0. */
    failureRate?: number;
    /**
     * Failure mode to inject when failureRate triggers.
     * Defaults to 'network-error'.
     */
    failureMode?: NetworkFailureMode | NetworkFailureMode[];
    /** Candidate HTTP status codes used for injected HTTP failures. Defaults to [500, 502, 503, 504]. */
    statusCodes?: number[];
    /** Restrict chaos to these HTTP methods. Example: ['GET', 'POST'] */
    methods?: string[];
    /** Only apply chaos to URLs matching one of these patterns. */
    includeUrls?: string[];
    /** Never apply chaos to URLs matching one of these patterns. */
    excludeUrls?: string[];
    /** Intercept fetch requests. Defaults to true. */
    interceptFetch?: boolean;
    /** Intercept XMLHttpRequest requests. Defaults to true. */
    interceptXhr?: boolean;
}
export type ActionType = 'click' | 'dblclick' | 'type' | 'scroll' | 'select';
export type ExportFormat = 'playwright' | 'cypress' | 'both';
export type CrashKind = 'error' | 'unhandledrejection' | 'target-removed' | 'empty-target' | 'manual';
export type NetworkFailureMode = 'http-error' | 'network-error';
export type NetworkTransport = 'fetch' | 'xhr';
export interface RecordedAction {
    id: number;
    type: ActionType;
    selector: string;
    timestamp: number;
    value?: string;
    optionValue?: string;
    scrollTop?: number;
    tagName?: string;
    text?: string;
    x?: number;
    y?: number;
}
export interface RecordedNetworkEvent {
    id: number;
    timestamp: number;
    transport: NetworkTransport;
    url: string;
    method: string;
    delayMs: number;
    failureMode?: NetworkFailureMode;
    statusCode?: number;
}
export interface ChaosCrash {
    kind: CrashKind;
    reason: string;
    timestamp: number;
}
export interface ChaosScenario {
    url: string;
    startedAt: number;
    endedAt: number;
    userAgent?: string;
    seed?: number;
    actions: RecordedAction[];
    network: RecordedNetworkEvent[];
    crash?: ChaosCrash;
}
export interface ScenarioExportBundle {
    playwright?: string;
    cypress?: string;
}
export interface ChaosCrashEvent {
    reason: string;
    kind: CrashKind;
    scenario: ChaosScenario;
    exports: ScenarioExportBundle;
}
export interface ChaosController {
    readonly isEnabled: boolean;
    readonly isRunning: boolean;
    start(): boolean;
    stop(): void;
    destroy(): void;
    runOnce(): RecordedAction | null;
    getHistory(): RecordedAction[];
    getNetworkHistory(): RecordedNetworkEvent[];
    getScenario(): ChaosScenario;
    exportScenario(format?: ExportFormat): ScenarioExportBundle;
    downloadScenario(format?: ExportFormat): string[];
    reportCrash(reason: string, kind?: CrashKind): void;
}
//# sourceMappingURL=types.d.ts.map