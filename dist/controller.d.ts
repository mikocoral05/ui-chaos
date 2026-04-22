import type { ChaosController, ChaosOptions, ChaosScenario, CrashKind, ExportFormat, RecordedAction, RecordedNetworkEvent, ScenarioExportBundle } from './types.ts';
export declare class UiChaosController implements ChaosController {
    private readonly enabled;
    private readonly recorder;
    private readonly networkRecorder;
    private readonly monkey;
    private readonly detector;
    private readonly network;
    private readonly startedAt;
    private readonly url;
    private readonly userAgent?;
    private readonly options;
    private crash;
    private destroyed;
    constructor(rawOptions?: ChaosOptions);
    get isEnabled(): boolean;
    get isRunning(): boolean;
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
    private handleCrash;
    private log;
}
//# sourceMappingURL=controller.d.ts.map