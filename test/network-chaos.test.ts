import { afterEach, describe, expect, it } from 'vitest';
import { NetworkChaosManager, normalizeNetworkChaosOptions } from '../src/network-chaos.ts';
import { NetworkRecorder } from '../src/network-recorder.ts';
import { createRandomSource } from '../src/random.ts';
import { installFakeBrowser } from './helpers/fake-dom.ts';

describe('NetworkChaosManager', () => {
  let cleanup: (() => void) | undefined;
  let managers: NetworkChaosManager[] = [];

  afterEach(() => {
    managers.reverse().forEach((manager) => manager.destroy());
    managers = [];
    cleanup?.();
    cleanup = undefined;
  });

  it('keeps network interception active for remaining managers when one is destroyed out of order', async () => {
    const browser = installFakeBrowser();
    cleanup = browser.cleanup;

    const originalFetch = globalThis.fetch;
    const first = new NetworkChaosManager({
      config: normalizeNetworkChaosOptions(
        {
          enabled: true,
          minDelayMs: 0,
          maxDelayMs: 0,
          failureRate: 1,
          failureMode: 'http-error',
          statusCodes: [503],
          includeUrls: ['/api/alpha'],
          interceptXhr: false
        },
        10
      ),
      log: false,
      random: createRandomSource(1),
      recorder: new NetworkRecorder(10)
    });
    const second = new NetworkChaosManager({
      config: normalizeNetworkChaosOptions(
        {
          enabled: true,
          minDelayMs: 0,
          maxDelayMs: 0,
          failureRate: 1,
          failureMode: 'http-error',
          statusCodes: [504],
          includeUrls: ['/api/bravo'],
          interceptXhr: false
        },
        10
      ),
      log: false,
      random: createRandomSource(2),
      recorder: new NetworkRecorder(10)
    });

    managers.push(first, second);
    first.start();
    second.start();

    const alphaResponse = await fetch('http://localhost:3000/api/alpha');
    const bravoResponse = await fetch('http://localhost:3000/api/bravo');
    const passthroughResponse = await fetch('http://localhost:3000/api/charlie');

    expect(alphaResponse.status).toBe(503);
    expect(bravoResponse.status).toBe(504);
    expect(passthroughResponse.status).toBe(200);

    first.destroy();
    managers = [second];

    expect(globalThis.fetch).not.toBe(originalFetch);

    const followUpBravoResponse = await fetch('http://localhost:3000/api/bravo');
    expect(followUpBravoResponse.status).toBe(504);

    second.destroy();
    managers = [];

    expect(globalThis.fetch).toBe(originalFetch);
  });
});
