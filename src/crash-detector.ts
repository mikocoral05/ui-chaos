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

export class CrashDetector {
  private observer: MutationObserver | null = null;
  private started = false;
  private didTargetEverHaveContent: boolean;

  constructor(private readonly options: CrashDetectorOptions) {
    this.didTargetEverHaveContent = this.hasMeaningfulContent(options.target);
  }

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    window.addEventListener('error', this.handleError as EventListener);
    window.addEventListener('unhandledrejection', this.handleRejection as EventListener);

    this.observer = new MutationObserver(() => {
      this.evaluateTargetState();
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stop() {
    if (!this.started) {
      return;
    }

    this.started = false;
    window.removeEventListener('error', this.handleError as EventListener);
    window.removeEventListener('unhandledrejection', this.handleRejection as EventListener);

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private handleError = (event: ErrorEvent) => {
    const reason = event.message || 'Unhandled window error';
    this.options.onCrash({
      kind: 'error',
      reason,
      timestamp: Date.now()
    });
  };

  private handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    this.options.onCrash({
      kind: 'unhandledrejection',
      reason,
      timestamp: Date.now()
    });
  };

  private evaluateTargetState() {
    const target = this.options.target;

    if (this.hasMeaningfulContent(target)) {
      this.didTargetEverHaveContent = true;
    }

    if (this.options.detectTargetRemoval && !document.body.contains(target)) {
      this.options.onCrash({
        kind: 'target-removed',
        reason: 'Target element was removed from the document.',
        timestamp: Date.now()
      });
      return;
    }

    if (
      this.options.detectEmptyTarget &&
      this.didTargetEverHaveContent &&
      !this.hasMeaningfulContent(target)
    ) {
      this.options.onCrash({
        kind: 'empty-target',
        reason: 'Target element became empty after previously rendering content.',
        timestamp: Date.now()
      });
    }
  }

  private hasMeaningfulContent(element: HTMLElement): boolean {
    if (element.childElementCount > 0) {
      return true;
    }

    return Boolean(element.textContent?.trim());
  }
}
