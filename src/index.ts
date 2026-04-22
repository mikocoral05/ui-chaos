import { UiChaosController } from './controller.ts';
import type { ChaosController, ChaosOptions } from './types.ts';

export function initChaos(options: ChaosOptions = {}): ChaosController {
  return new UiChaosController(options);
}

export { UiChaosController } from './controller.ts';
export { CrashDetector } from './crash-detector.ts';
export {
  downloadExportBundle,
  downloadTextFile,
  generateCypressTest,
  generatePlaywrightTest,
  generateScenarioExports
} from './exporter.ts';
export {
  NetworkChaosManager,
  normalizeNetworkChaosOptions
} from './network-chaos.ts';
export { DEFAULT_EXCLUDE_SELECTOR, DEFAULT_INTERACTION_SELECTOR, ChaosMonkey } from './monkey.ts';
export { NetworkRecorder } from './network-recorder.ts';
export { createRandomSource } from './random.ts';
export { ActionRecorder } from './recorder.ts';
export * from './types.ts';
