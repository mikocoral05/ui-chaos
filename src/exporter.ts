import type {
  ChaosScenario,
  ExportFormat,
  RecordedAction,
  RecordedNetworkEvent,
  ScenarioExportBundle
} from './types.ts';

export interface ScenarioExporterOptions {
  url?: string;
  testName?: string;
}

type ScenarioInput = ChaosScenario | RecordedAction[];

const DEFAULT_URL = 'http://localhost:3000/';
const DEFAULT_TEST_NAME = 'ui-chaos reproduced crash scenario';

export function generatePlaywrightTest(
  input: ScenarioInput,
  options: ScenarioExporterOptions = {}
): string {
  const scenario = normalizeScenario(input, options);
  const lines: string[] = [];
  const shouldAssertCapturedCrash = Boolean(scenario.crash);

  lines.push(`import { test } from '@playwright/test';`);
  lines.push('');
  lines.push(`test(${toJsString(options.testName ?? DEFAULT_TEST_NAME)}, async ({ page }) => {`);
  lines.push(`  const pageErrors: string[] = [];`);
  lines.push(`  page.on('pageerror', (error) => {`);
  lines.push(`    pageErrors.push(error.message);`);
  lines.push(`  });`);
  lines.push('');

  if (typeof scenario.seed === 'number') {
    lines.push(`  // Scenario seed: ${scenario.seed}`);
    lines.push('');
  }

  lines.push(...renderPlaywrightNetworkSetup(scenario.network));
  lines.push(`  await page.goto(${toJsString(scenario.url)});`);
  lines.push('');

  if (scenario.crash) {
    lines.push(`  // Captured crash reason: ${scenario.crash.kind} - ${scenario.crash.reason}`);
    lines.push('');
  }

  for (const action of scenario.actions) {
    lines.push(`  // Action ${action.id} at ${new Date(action.timestamp).toISOString()}`);
    lines.push(renderPlaywrightAction(action));
  }

  if (shouldAssertCapturedCrash) {
    lines.push('');
    lines.push(`  if (pageErrors.length > 0) {`);
    lines.push(
      `    throw new Error(\`Replayed crash scenario produced page errors:\\n\${pageErrors.join('\\n')}\`);`
    );
    lines.push(`  }`);
  } else {
    lines.push('');
    lines.push(`  // No crash was captured for this scenario. Add your own assertions here if needed.`);
  }

  lines.push(`});`);
  lines.push('');

  return lines.join('\n');
}

export function generateCypressTest(
  input: ScenarioInput,
  options: ScenarioExporterOptions = {}
): string {
  const scenario = normalizeScenario(input, options);
  const lines: string[] = [];

  lines.push(`describe(${toJsString(options.testName ?? DEFAULT_TEST_NAME)}, () => {`);
  lines.push(`  it('replays the captured UI actions', () => {`);

  if (typeof scenario.seed === 'number') {
    lines.push(`    // Scenario seed: ${scenario.seed}`);
    lines.push('');
  }

  lines.push(...renderCypressNetworkSetup(scenario.network));
  lines.push(`    cy.visit(${toJsString(scenario.url)});`);
  lines.push('');

  if (scenario.crash) {
    lines.push(`    // Captured crash reason: ${scenario.crash.kind} - ${scenario.crash.reason}`);
    lines.push('');
  }

  for (const action of scenario.actions) {
    lines.push(`    // Action ${action.id} at ${new Date(action.timestamp).toISOString()}`);
    lines.push(renderCypressAction(action));
  }

  lines.push(`  });`);
  lines.push(`});`);
  lines.push('');

  return lines.join('\n');
}

export function generateScenarioExports(
  scenario: ChaosScenario,
  format: ExportFormat = 'both'
): ScenarioExportBundle {
  if (format === 'playwright') {
    return { playwright: generatePlaywrightTest(scenario) };
  }

  if (format === 'cypress') {
    return { cypress: generateCypressTest(scenario) };
  }

  return {
    playwright: generatePlaywrightTest(scenario),
    cypress: generateCypressTest(scenario)
  };
}

export function downloadTextFile(content: string, filename: string): boolean {
  if (!canUseDom()) {
    return false;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return true;
}

export function downloadExportBundle(
  bundle: ScenarioExportBundle,
  options: { baseFileName?: string } = {}
): string[] {
  const baseFileName = normalizeBaseFileName(options.baseFileName ?? 'ui-chaos-crash');
  const downloads: Array<{ content: string; filename: string }> = [];

  if (bundle.playwright) {
    downloads.push({
      content: bundle.playwright,
      filename: `${baseFileName}.spec.ts`
    });
  }

  if (bundle.cypress) {
    downloads.push({
      content: bundle.cypress,
      filename: `${baseFileName}.cy.ts`
    });
  }

  const downloadedFiles: string[] = [];

  for (const download of downloads) {
    if (downloadTextFile(download.content, download.filename)) {
      downloadedFiles.push(download.filename);
    }
  }

  return downloadedFiles;
}

function normalizeScenario(
  input: ScenarioInput,
  options: ScenarioExporterOptions
): ChaosScenario {
  if (Array.isArray(input)) {
    const startedAt = input[0]?.timestamp ?? Date.now();
    const endedAt = input[input.length - 1]?.timestamp ?? startedAt;

    return {
      url: options.url ?? inferRuntimeUrl(),
      startedAt,
      endedAt,
      actions: [...input],
      network: []
    };
  }

  return {
    ...input,
    url: options.url ?? input.url ?? inferRuntimeUrl(),
    actions: [...input.actions],
    network: [...input.network]
  };
}

function renderPlaywrightAction(action: RecordedAction): string {
  const selector = toJsString(action.selector);

  switch (action.type) {
    case 'click':
      return `  await page.locator(${selector}).click();`;
    case 'dblclick':
      return `  await page.locator(${selector}).dblclick();`;
    case 'type':
      return `  await page.locator(${selector}).fill(${toJsString(action.value ?? '')});`;
    case 'select':
      return `  await page.locator(${selector}).selectOption(${toJsString(action.optionValue ?? '')});`;
    case 'scroll':
      return `  await page.locator(${selector}).evaluate((element, top) => { element.scrollTop = top; }, ${action.scrollTop ?? 0});`;
    default:
      return `  // Unsupported action type: ${action.type}`;
  }
}

function renderCypressAction(action: RecordedAction): string {
  const selector = toJsString(action.selector);

  switch (action.type) {
    case 'click':
      return `    cy.get(${selector}).click();`;
    case 'dblclick':
      return `    cy.get(${selector}).dblclick();`;
    case 'type':
      return `    cy.get(${selector}).clear().type(${toJsString(action.value ?? '')}, { parseSpecialCharSequences: false });`;
    case 'select':
      return `    cy.get(${selector}).select(${toJsString(action.optionValue ?? '')});`;
    case 'scroll':
      return `    cy.get(${selector}).scrollTo(0, ${action.scrollTop ?? 0});`;
    default:
      return `    // Unsupported action type: ${action.type}`;
  }
}

function renderPlaywrightNetworkSetup(network: RecordedNetworkEvent[]): string[] {
  if (network.length === 0) {
    return [];
  }

  const lines: string[] = [];
  lines.push(`  const networkChaos = ${JSON.stringify(network)};`);
  lines.push(`  await page.route('**/*', async (route) => {`);
  lines.push(`    const request = route.request();`);
  lines.push(
    `    const index = networkChaos.findIndex((entry) => !entry.used && entry.url === request.url() && entry.method === request.method());`
  );
  lines.push(`    if (index === -1) {`);
  lines.push(`      await route.continue();`);
  lines.push(`      return;`);
  lines.push(`    }`);
  lines.push(``);
  lines.push(`    const entry = networkChaos[index];`);
  lines.push(`    entry.used = true;`);
  lines.push(``);
  lines.push(`    if (entry.delayMs > 0) {`);
  lines.push(`      await new Promise((resolve) => setTimeout(resolve, entry.delayMs));`);
  lines.push(`    }`);
  lines.push(``);
  lines.push(`    if (entry.failureMode === 'network-error') {`);
  lines.push(`      await route.abort('failed');`);
  lines.push(`      return;`);
  lines.push(`    }`);
  lines.push(``);
  lines.push(`    if (entry.failureMode === 'http-error') {`);
  lines.push(`      await route.fulfill({`);
  lines.push(`        status: entry.statusCode ?? 503,`);
  lines.push(`        contentType: 'application/json',`);
  lines.push(
    `        body: JSON.stringify({ error: 'Injected by ui-chaos', url: entry.url, method: entry.method })`
  );
  lines.push(`      });`);
  lines.push(`      return;`);
  lines.push(`    }`);
  lines.push(``);
  lines.push(`    await route.continue();`);
  lines.push(`  });`);
  lines.push(``);

  return lines;
}

function renderCypressNetworkSetup(network: RecordedNetworkEvent[]): string[] {
  if (network.length === 0) {
    return [];
  }

  const lines: string[] = [];
  lines.push(`    const networkChaos = ${JSON.stringify(network)};`);
  lines.push(`    networkChaos.forEach((entry) => {`);
  lines.push(`      cy.intercept({ method: entry.method, url: entry.url, times: 1 }, (req) => {`);
  lines.push(`        if (entry.failureMode === 'network-error') {`);
  lines.push(`          req.reply({ forceNetworkError: true, delay: entry.delayMs });`);
  lines.push(`          return;`);
  lines.push(`        }`);
  lines.push(``);
  lines.push(`        if (entry.failureMode === 'http-error') {`);
  lines.push(`          req.reply({`);
  lines.push(`            statusCode: entry.statusCode ?? 503,`);
  lines.push(`            delay: entry.delayMs,`);
  lines.push(`            headers: { 'x-ui-chaos': 'true' },`);
  lines.push(
    `            body: { error: 'Injected by ui-chaos', url: entry.url, method: entry.method }`
  );
  lines.push(`          });`);
  lines.push(`          return;`);
  lines.push(`        }`);
  lines.push(``);
  lines.push(`        req.continue((res) => {`);
  lines.push(`          if (entry.delayMs > 0) {`);
  lines.push(`            res.setDelay(entry.delayMs);`);
  lines.push(`          }`);
  lines.push(`        });`);
  lines.push(`      });`);
  lines.push(`    });`);
  lines.push(``);

  return lines;
}

function normalizeBaseFileName(baseFileName: string): string {
  return baseFileName.replace(/(\.spec\.ts|\.cy\.ts|\.ts)$/i, '');
}

function inferRuntimeUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }

  return DEFAULT_URL;
}

function toJsString(value: string): string {
  return JSON.stringify(value);
}

function canUseDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
