import { afterEach, describe, expect, it } from 'vitest';
import { ChaosMonkey, DEFAULT_EXCLUDE_SELECTOR, DEFAULT_INTERACTION_SELECTOR } from '../src/monkey.ts';
import { createRandomSource } from '../src/random.ts';
import { ActionRecorder } from '../src/recorder.ts';
import { FakeElement, installFakeBrowser } from './helpers/fake-dom.ts';

describe('ChaosMonkey', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('skips interactables inside ignored ancestors', () => {
    const browser = installFakeBrowser();
    cleanup = browser.cleanup;

    const target = new FakeElement('div', { id: 'app' });
    const ignoredZone = new FakeElement('div');
    const ignoredButton = new FakeElement('button', { id: 'ignored', textContent: 'Ignored' });
    const safeButton = new FakeElement('button', { id: 'safe', textContent: 'Safe' });

    ignoredZone.setAttribute('data-chaos-ignore', '');
    browser.body.appendChild(target);
    target.register(ignoredZone);
    ignoredZone.register(ignoredButton);
    target.register(safeButton);

    const monkey = new ChaosMonkey(
      target as unknown as HTMLElement,
      100,
      new ActionRecorder(10),
      {
        interactionSelector: DEFAULT_INTERACTION_SELECTOR,
        excludeSelector: DEFAULT_EXCLUDE_SELECTOR,
        log: false,
        random: createRandomSource(1)
      }
    );

    const action = monkey.runOnce();

    expect(action?.selector).toBe('#safe');
    expect(ignoredButton.dispatchedEvents).toEqual([]);
    expect(ignoredButton.clicked).toBe(0);
    expect(safeButton.dispatchedEvents).toContain(action?.type ?? '');
  });

  it('can act on the target element when the target itself is interactable', () => {
    const browser = installFakeBrowser();
    cleanup = browser.cleanup;

    const target = new FakeElement('button', { id: 'launch', textContent: 'Launch' });
    browser.body.appendChild(target);

    const monkey = new ChaosMonkey(
      target as unknown as HTMLElement,
      100,
      new ActionRecorder(10),
      {
        interactionSelector: DEFAULT_INTERACTION_SELECTOR,
        excludeSelector: DEFAULT_EXCLUDE_SELECTOR,
        log: false,
        random: createRandomSource(2)
      }
    );

    const action = monkey.runOnce();

    expect(action?.selector).toBe('#launch');
    expect(target.dispatchedEvents).toContain(action?.type ?? '');
  });
});
