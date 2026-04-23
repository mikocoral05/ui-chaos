import { expect, test } from '@playwright/test';

test.describe('ui-chaos demo', () => {
  test('captures an empty-target crash and exports repro scripts in a real browser', async ({
    page
  }) => {
    await page.goto('/?chaos=true&autoStart=false&interactionSelector=%23crash-btn&seed=7');

    await page.evaluate(() => {
      window.chaos.runOnce();
    });

    await expect(page.locator('#status')).toContainText('Crash captured:');
    await expect(page.locator('#status')).toContainText('Target element became empty');

    const snapshot = await page.evaluate(() => {
      return {
        historyLength: window.chaos.getHistory().length,
        crash: window.chaos.getScenario().crash,
        exports: window.chaos.exportScenario('both')
      };
    });

    expect(snapshot.historyLength).toBe(1);
    expect(snapshot.crash?.kind).toBe('empty-target');
    expect(snapshot.exports.playwright).toContain('page.goto');
    expect(snapshot.exports.cypress).toContain('cy.visit');
  });

  test('intercepts fetch requests in a real browser and records the network scenario', async ({
    page
  }) => {
    await page.goto('/?chaos=true&autoStart=false&monkey=false&network=true&networkDelayMs=25');

    await page.evaluate(() => {
      window.chaos.start();
    });

    await page.getByRole('button', { name: 'Fetch Profile' }).click();

    await expect(page.locator('#network-status')).toContainText('Request failed: 503');

    const history = await page.evaluate(() => window.chaos.getNetworkHistory());

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      transport: 'fetch',
      method: 'GET',
      failureMode: 'http-error',
      statusCode: 503
    });
    expect(history[0].url).toContain('/api/profile');
  });
});
