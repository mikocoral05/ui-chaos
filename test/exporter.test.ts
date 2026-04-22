import { describe, expect, it } from 'vitest';
import {
  generateCypressTest,
  generatePlaywrightTest,
  generateScenarioExports
} from '../src/exporter.ts';
import type { ChaosScenario } from '../src/types.ts';

describe('Exporter', () => {
  const scenario: ChaosScenario = {
    url: 'http://localhost:3000/',
    startedAt: 1600000000000,
    endedAt: 1600000003000,
    seed: 42,
    actions: [
      {
        id: 1,
        type: 'click',
        selector: '#submit',
        timestamp: 1600000000000
      },
      {
        id: 2,
        type: 'type',
        selector: 'input[name="email"]',
        timestamp: 1600000001000,
        value: "O'Reilly\nline-two"
      },
      {
        id: 3,
        type: 'select',
        selector: '#country',
        timestamp: 1600000002000,
        optionValue: 'ph'
      },
      {
        id: 4,
        type: 'scroll',
        selector: '#results',
        timestamp: 1600000003000,
        scrollTop: 240
      }
    ],
    network: [
      {
        id: 1,
        timestamp: 1600000000500,
        transport: 'fetch',
        url: 'http://localhost:3000/api/profile',
        method: 'GET',
        delayMs: 1200,
        failureMode: 'http-error',
        statusCode: 503
      }
    ],
    crash: {
      kind: 'error',
      reason: 'Submit handler exploded',
      timestamp: 1600000004000
    }
  };

  it('generates a valid Playwright repro script with escaped values and network chaos rules', () => {
    const script = generatePlaywrightTest(scenario);

    expect(script).toContain(`import { test } from '@playwright/test';`);
    expect(script).toContain(`// Scenario seed: 42`);
    expect(script).toContain(`await page.route('**/*', async (route) => {`);
    expect(script).toContain(`entry.url === request.url() && entry.method === request.method()`);
    expect(script).toContain(`await page.goto("http://localhost:3000/");`);
    expect(script).toContain(`await page.locator("#submit").click();`);
    expect(script).toContain(
      `await page.locator("input[name=\\"email\\"]").fill("O'Reilly\\nline-two");`
    );
    expect(script).toContain(`await page.locator("#country").selectOption("ph");`);
    expect(script).toContain(
      `await page.locator("#results").evaluate((element, top) => { element.scrollTop = top; }, 240);`
    );
    expect(script).toContain(`Captured crash reason: error - Submit handler exploded`);
  });

  it('generates a Cypress repro script with network chaos rules', () => {
    const script = generateCypressTest(scenario);

    expect(script).toContain(`const networkChaos = [{"id":1`);
    expect(script).toContain(`cy.intercept({ method: entry.method, url: entry.url, times: 1 }, (req) => {`);
    expect(script).toContain(`cy.visit("http://localhost:3000/");`);
    expect(script).toContain(`cy.get("#submit").click();`);
    expect(script).toContain(
      `cy.get("input[name=\\"email\\"]").clear().type("O'Reilly\\nline-two", { parseSpecialCharSequences: false });`
    );
    expect(script).toContain(`cy.get("#country").select("ph");`);
    expect(script).toContain(`cy.get("#results").scrollTo(0, 240);`);
  });

  it('can generate both export formats at once', () => {
    const bundle = generateScenarioExports(scenario, 'both');
    expect(bundle.playwright).toBeTruthy();
    expect(bundle.cypress).toBeTruthy();
  });
});
