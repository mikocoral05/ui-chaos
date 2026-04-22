import { NetworkRecorder } from './network-recorder.ts';
import type { RandomSource } from './random.ts';
import type { NetworkChaosOptions, NetworkFailureMode, NetworkTransport, RecordedNetworkEvent } from './types.ts';
type NormalizedNetworkChaosOptions = Omit<Required<NetworkChaosOptions>, 'failureMode'> & {
    failureMode: NetworkFailureMode[];
};
interface NetworkChaosRuntimeOptions {
    config: NormalizedNetworkChaosOptions;
    log: boolean;
    random: RandomSource;
    recorder: NetworkRecorder;
}
interface PlannedNetworkEvent {
    event: RecordedNetworkEvent;
}
export declare class NetworkChaosManager {
    private readonly options;
    private active;
    private nextEventId;
    private fetchInstalled;
    private xhrInstalled;
    private readonly originalFetch;
    private readonly originalXhr;
    constructor(options: NetworkChaosRuntimeOptions);
    get isEnabled(): boolean;
    get isRunning(): boolean;
    start(): boolean;
    stop(): void;
    destroy(): void;
    getHistory(): RecordedNetworkEvent[];
    private install;
    private restore;
    private handleFetch;
    planRequest(url: string, method: string, transport: NetworkTransport): PlannedNetworkEvent | null;
    private log;
}
export declare function normalizeNetworkChaosOptions(options: NetworkChaosOptions | undefined, fallbackHistorySize: number): NormalizedNetworkChaosOptions;
export {};
//# sourceMappingURL=network-chaos.d.ts.map