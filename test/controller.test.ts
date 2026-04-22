import { afterEach, describe, expect, it, vi } from 'vitest';
import { initChaos } from '../src/index.ts';
import { FakeElement, installFakeBrowser } from './helpers/fake-dom.ts';

describe('UiChaosController', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns a safe noop controller when disabled', () => {
    const controller = initChaos({ enabled: false, log: false });

    expect(controller.isEnabled).toBe(false);
    expect(controller.isRunning).toBe(false);
    expect(controller.start()).toBe(false);
    expect(controller.runOnce()).toBeNull();
    expect(controller.getHistory()).toEqual([]);
    expect(controller.getNetworkHistory()).toEqual([]);
  });

  it('records a random interaction when runOnce is called', () => {
    const browser = installFakeBrowser();
    cleanup = browser.cleanup;

    const target = new FakeElement('div', { id: 'app' });
    const button = new FakeElement('button', { id: 'submit', textContent: 'Submit' });
    browser.body.appendChild(target);
    target.register(button);

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const controller = initChaos({
      target: target as unknown as HTMLElement,
      autoStart: false,
      log: false
    });

    const action = controller.runOnce();

    expect(action?.type).toBe('click');
    expect(action?.selector).toBe('#submit');
    expect(button.clicked).toBe(1);
    expect(controller.getHistory()).toHaveLength(1);
  });

  it('captures crashes and exports repro files without downloading when disabled', () => {
    const browser = installFakeBrowser();
    cleanup = browser.cleanup;

    const target = new FakeElement('div', { id: 'app' });
    const button = new FakeElement('button', { id: 'submit', textContent: 'Submit' });
    browser.body.appendChild(target);
    target.register(button);

    const onCrash = vi.fn();
    const controller = initChaos({
      target: target as unknown as HTMLElement,
      downloadOnCrash: false,
      log: false,
      onCrash
    });

    expect(controller.isRunning).toBe(true);

    browser.emitWindowEvent('error', { message: 'Boom' });

    expect(controller.isRunning).toBe(false);
    expect(onCrash).toHaveBeenCalledTimes(1);

    const crashEvent = onCrash.mock.calls[0]?.[0];
    expect(crashEvent.reason).toBe('Boom');
    expect(crashEvent.exports.playwright).toContain('await page.goto("http://localhost:3000/");');
    expect(controller.getScenario().crash?.reason).toBe('Boom');
  });

  it('injects delayed HTTP failures into fetch and records the network scenario', async () => {
    vi.useFakeTimers();
    const browser = installFakeBrowser();
    cleanup = browser.cleanup;

    const target = new FakeElement('div', { id: 'app' });
    browser.body.appendChild(target);

    const originalFetch = globalThis.fetch;
    const controller = initChaos({
      target: target as unknown as HTMLElement,
      enableMonkey: false,
      log: false,
      network: {
        enabled: true,
        minDelayMs: 250,
        maxDelayMs: 250,
        failureRate: 1,
        failureMode: 'http-error',
        statusCodes: [503],
        includeUrls: ['/api/profile'],
        interceptXhr: false
      }
    });

    expect(controller.isRunning).toBe(true);

    const responsePromise = fetch('http://localhost:3000/api/profile');
    await vi.advanceTimersByTimeAsync(250);
    const response = await responsePromise;
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toBe('Injected by ui-chaos');
    expect(controller.getNetworkHistory()).toEqual([
      expect.objectContaining({
        transport: 'fetch',
        method: 'GET',
        url: 'http://localhost:3000/api/profile',
        delayMs: 250,
        failureMode: 'http-error',
        statusCode: 503
      })
    ]);

    controller.stop();
    expect(controller.isRunning).toBe(false);

    const passthroughPromise = fetch('http://localhost:3000/api/profile');
    await vi.advanceTimersByTimeAsync(1);
    const passthroughResponse = await passthroughPromise;
    expect(passthroughResponse.status).toBe(200);
    expect(controller.getNetworkHistory()).toHaveLength(1);

    controller.destroy();
    expect(globalThis.fetch).toBe(originalFetch);
  });

  it('injects XHR network errors and records them', async () => {
    const browser = installFakeBrowser();
    cleanup = browser.cleanup;

    const target = new FakeElement('div', { id: 'app' });
    browser.body.appendChild(target);

    const controller = initChaos({
      target: target as unknown as HTMLElement,
      enableMonkey: false,
      log: false,
      network: {
        enabled: true,
        minDelayMs: 0,
        maxDelayMs: 0,
        failureRate: 1,
        failureMode: 'network-error',
        includeUrls: ['/api/upload'],
        interceptFetch: false
      }
    });

    const result = await new Promise<{ status: number }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.onerror = () => resolve({ status: xhr.status });
      xhr.open('POST', 'http://localhost:3000/api/upload');
      xhr.send();
    });

    expect(result.status).toBe(0);
    expect(controller.getNetworkHistory()).toEqual([
      expect.objectContaining({
        transport: 'xhr',
        method: 'POST',
        url: 'http://localhost:3000/api/upload',
        failureMode: 'network-error'
      })
    ]);
  });
});
