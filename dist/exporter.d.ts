import type { ChaosScenario, ExportFormat, RecordedAction, ScenarioExportBundle } from './types.ts';
export interface ScenarioExporterOptions {
    url?: string;
    testName?: string;
}
type ScenarioInput = ChaosScenario | RecordedAction[];
export declare function generatePlaywrightTest(input: ScenarioInput, options?: ScenarioExporterOptions): string;
export declare function generateCypressTest(input: ScenarioInput, options?: ScenarioExporterOptions): string;
export declare function generateScenarioExports(scenario: ChaosScenario, format?: ExportFormat): ScenarioExportBundle;
export declare function downloadTextFile(content: string, filename: string): boolean;
export declare function downloadExportBundle(bundle: ScenarioExportBundle, options?: {
    baseFileName?: string;
}): string[];
export {};
//# sourceMappingURL=exporter.d.ts.map