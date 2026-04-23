import { CrashDetector, type CrashDetection } from './crash-detector.ts';
import {
  downloadExportBundle,
  generateScenarioExports
} from './exporter.ts';
import {
  ChaosMonkey,
  DEFAULT_EXCLUDE_SELECTOR,
  DEFAULT_INTERACTION_SELECTOR
} from './monkey.ts';
import { NetworkChaosManager, normalizeNetworkChaosOptions } from './network-chaos.ts';
import { NetworkRecorder } from './network-recorder.ts';
import { createRandomSource } from './random.ts';
import { ActionRecorder } from './recorder.ts';
import type {
  ChaosController,
  ChaosCrash,
  ChaosCrashEvent,
  ChaosOptions,
  ChaosScenario,
  CrashKind,
  ExportFormat,
  RecordedAction,
  RecordedNetworkEvent,
  ScenarioExportBundle
} from './types.ts';

type AppliedChaosOptions = Required<
  Omit<
    ChaosOptions,
    'target' | 'initialUrl' | 'baseFileName' | 'onCrash' | 'network' | 'seed'
  >
> &
  Pick<ChaosOptions, 'baseFileName' | 'onCrash' | 'seed'>;

export class UiChaosController implements ChaosController {
  private readonly enabled: boolean;
  private readonly recorder: ActionRecorder | null;
  private readonly networkRecorder: NetworkRecorder | null;
  private readonly monkey: ChaosMonkey | null;
  private readonly detector: CrashDetector | null;
  private readonly network: NetworkChaosManager | null;
  private readonly startedAt: number;
  private readonly url: string;
  private readonly userAgent?: string;
  private readonly options: AppliedChaosOptions;

  private crash: ChaosCrash | undefined;
  private destroyed = false;

  constructor(rawOptions: ChaosOptions = {}) {
    this.options = {
      intervalMs: rawOptions.intervalMs ?? 100,
      historySize: rawOptions.historySize ?? 50,
      autoStart: rawOptions.autoStart ?? true,
      enabled: rawOptions.enabled ?? false,
      log: rawOptions.log ?? true,
      enableMonkey: rawOptions.enableMonkey ?? true,
      interactionSelector: rawOptions.interactionSelector ?? DEFAULT_INTERACTION_SELECTOR,
      excludeSelector: rawOptions.excludeSelector ?? DEFAULT_EXCLUDE_SELECTOR,
      exportFormat: rawOptions.exportFormat ?? 'playwright',
      downloadOnCrash: rawOptions.downloadOnCrash ?? false,
      detectTargetRemoval: rawOptions.detectTargetRemoval ?? true,
      detectEmptyTarget: rawOptions.detectEmptyTarget ?? false,
      baseFileName: rawOptions.baseFileName,
      onCrash: rawOptions.onCrash,
      seed: rawOptions.seed
    };

    this.startedAt = Date.now();
    this.url = rawOptions.initialUrl ?? getRuntimeUrl();
    this.userAgent = getRuntimeUserAgent();

    if (!this.options.enabled) {
      this.enabled = false;
      this.recorder = null;
      this.networkRecorder = null;
      this.monkey = null;
      this.detector = null;
      this.network = null;
      return;
    }

    if (!canUseDom()) {
      this.enabled = false;
      this.recorder = null;
      this.networkRecorder = null;
      this.monkey = null;
      this.detector = null;
      this.network = null;
      this.log('Skipping initialization because no browser runtime is available.');
      return;
    }

    const target = rawOptions.target ?? document.body;
    if (!target) {
      this.enabled = false;
      this.recorder = null;
      this.networkRecorder = null;
      this.monkey = null;
      this.detector = null;
      this.network = null;
      this.log('Skipping initialization because no target element was provided.');
      return;
    }

    const random = createRandomSource(rawOptions.seed);
    const normalizedNetworkOptions = normalizeNetworkChaosOptions(
      rawOptions.network,
      this.options.historySize
    );

    this.enabled = true;
    this.recorder = new ActionRecorder(this.options.historySize);
    this.networkRecorder = new NetworkRecorder(normalizedNetworkOptions.historySize);
    this.monkey = this.options.enableMonkey
      ? new ChaosMonkey(target, this.options.intervalMs, this.recorder, {
          interactionSelector: this.options.interactionSelector,
          excludeSelector: this.options.excludeSelector,
          log: this.options.log,
          random
        })
      : null;
    this.network = normalizedNetworkOptions.enabled
      ? new NetworkChaosManager({
          config: normalizedNetworkOptions,
          log: this.options.log,
          random,
          recorder: this.networkRecorder
        })
      : null;
    this.detector = new CrashDetector({
      target,
      detectTargetRemoval: this.options.detectTargetRemoval,
      detectEmptyTarget: this.options.detectEmptyTarget,
      onCrash: (detection) => this.handleCrash(detection)
    });
    this.detector.start();

    if (this.options.autoStart) {
      this.start();
    }
  }

  get isEnabled(): boolean {
    return this.enabled && !this.destroyed;
  }

  get isRunning(): boolean {
    return Boolean(this.monkey?.isRunning || this.network?.isRunning);
  }

  start(): boolean {
    if (!this.isEnabled) {
      return false;
    }

    const monkeyStarted = this.monkey?.start() ?? false;
    const networkStarted = this.network?.start() ?? false;
    return monkeyStarted || networkStarted;
  }

  stop() {
    this.monkey?.stop();
    this.network?.stop();
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.stop();
    this.detector?.stop();
    this.network?.destroy();
    this.destroyed = true;
    this.log('Controller destroyed.');
  }

  runOnce(): RecordedAction | null {
    if (!this.isEnabled || !this.monkey) {
      return null;
    }

    return this.monkey.runOnce();
  }

  getHistory(): RecordedAction[] {
    return this.recorder?.getHistory() ?? [];
  }

  getNetworkHistory(): RecordedNetworkEvent[] {
    return this.networkRecorder?.getHistory() ?? [];
  }

  getScenario(): ChaosScenario {
    return {
      url: this.url,
      startedAt: this.startedAt,
      endedAt: this.crash?.timestamp ?? Date.now(),
      userAgent: this.userAgent,
      seed: this.options.seed,
      actions: this.getHistory(),
      network: this.getNetworkHistory(),
      crash: this.crash
    };
  }

  exportScenario(format: ExportFormat = this.options.exportFormat): ScenarioExportBundle {
    return generateScenarioExports(this.getScenario(), format);
  }

  downloadScenario(format: ExportFormat = this.options.exportFormat): string[] {
    const timestampedBaseFileName = buildCrashFileName(
      this.options.baseFileName ?? 'ui-chaos-crash',
      this.crash?.timestamp ?? Date.now()
    );

    return downloadExportBundle(this.exportScenario(format), {
      baseFileName: timestampedBaseFileName
    });
  }

  reportCrash(reason: string, kind: CrashKind = 'manual') {
    this.handleCrash({
      kind,
      reason,
      timestamp: Date.now()
    });
  }

  private handleCrash(detection: CrashDetection) {
    if (this.destroyed || this.crash) {
      return;
    }

    this.crash = {
      kind: detection.kind,
      reason: detection.reason,
      timestamp: detection.timestamp
    };

    this.stop();
    this.detector?.stop();
    this.log(`Crash detected: ${detection.kind} - ${detection.reason}`);

    const exports = this.exportScenario(this.options.exportFormat);
    if (this.options.downloadOnCrash) {
      this.downloadScenario(this.options.exportFormat);
    }

    if (typeof this.options.onCrash === 'function') {
      const event: ChaosCrashEvent = {
        reason: detection.reason,
        kind: detection.kind,
        scenario: this.getScenario(),
        exports
      };

      try {
        this.options.onCrash(event);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error while running onCrash callback.';
        this.log(`onCrash callback failed: ${message}`);
      }
    }
  }

  private log(message: string) {
    if (this.options.log) {
      console.log(`[ui-chaos] ${message}`);
    }
  }
}

function canUseDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getRuntimeUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }

  return 'http://localhost:3000/';
}

function getRuntimeUserAgent(): string | undefined {
  if (typeof window !== 'undefined' && window.navigator?.userAgent) {
    return window.navigator.userAgent;
  }

  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent;
  }

  return undefined;
}

function buildCrashFileName(baseFileName: string, timestamp: number): string {
  const stamp = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
  return `${baseFileName}-${stamp}`;
}
