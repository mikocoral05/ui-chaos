import { ActionRecorder } from './recorder.ts';
import type { RandomSource } from './random.ts';
import type { ActionType, RecordedAction } from './types.ts';

export const DEFAULT_INTERACTION_SELECTOR =
  'button, input, select, textarea, a[href], [role="button"], [tabindex]:not([tabindex="-1"])';

export const DEFAULT_EXCLUDE_SELECTOR = '[data-chaos-ignore], [data-ui-chaos-ignore]';

interface ChaosMonkeyOptions {
  interactionSelector: string;
  excludeSelector: string;
  log: boolean;
  random: RandomSource;
}

const DEFAULT_TEXT_LENGTH = 6;

export class ChaosMonkey {
  private intervalId: number | null = null;
  private actionCounter = 0;

  constructor(
    private readonly target: HTMLElement,
    private readonly intervalMs: number,
    private readonly recorder: ActionRecorder,
    private readonly options: ChaosMonkeyOptions
  ) {}

  get isRunning(): boolean {
    return this.intervalId !== null;
  }

  start(): boolean {
    if (this.intervalId !== null) {
      return false;
    }

    this.intervalId = window.setInterval(() => {
      this.runOnce();
    }, this.intervalMs);

    this.log('Monkey started.');
    return true;
  }

  stop() {
    if (this.intervalId === null) {
      return;
    }

    window.clearInterval(this.intervalId);
    this.intervalId = null;
    this.log('Monkey stopped.');
  }

  runOnce(): RecordedAction | null {
    const interactables = this.getInteractables();
    if (interactables.length === 0) {
      return null;
    }

    const element = interactables[this.randomIndex(interactables.length)];
    const actionType = this.pickActionType(element);
    const action = this.buildAction(element, actionType);

    try {
      this.performAction(element, action);
      this.recorder.record(action);
      return action;
    } catch {
      return null;
    }
  }

  private getInteractables(): HTMLElement[] {
    const candidates = Array.from(
      this.target.querySelectorAll(this.options.interactionSelector)
    ) as HTMLElement[];

    if (this.matchesSelector(this.target, this.options.interactionSelector)) {
      candidates.unshift(this.target);
    }

    return candidates.filter((element) => this.isEligibleElement(element));
  }

  private isEligibleElement(element: HTMLElement): boolean {
    if (!element || !element.isConnected) {
      return false;
    }

    if (this.options.excludeSelector) {
      if (this.matchesSelector(element, this.options.excludeSelector)) {
        return false;
      }

      if (this.hasMatchingAncestor(element, this.options.excludeSelector)) {
        return false;
      }
    }

    const disabled =
      this.readBooleanProperty(element, 'disabled') ||
      element.getAttribute('aria-disabled') === 'true';

    if (disabled) {
      return false;
    }

    const inputType = this.readStringProperty(element, 'type').toLowerCase();
    if (inputType === 'hidden') {
      return false;
    }

    if (inputType && inputType !== 'checkbox' && inputType !== 'radio') {
      const readOnly = this.readBooleanProperty(element, 'readOnly');
      if (readOnly) {
        return false;
      }
    }

    const style = typeof window.getComputedStyle === 'function'
      ? window.getComputedStyle(element)
      : null;

    if (
      style &&
      (style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.pointerEvents === 'none')
    ) {
      return false;
    }

    if (typeof element.getBoundingClientRect === 'function') {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }
    }

    return true;
  }

  private pickActionType(element: HTMLElement): ActionType {
    const actions: ActionType[] = ['click', 'dblclick'];
    const tagName = element.tagName.toLowerCase();

    if (this.isTextLikeInput(element)) {
      actions.push('type');
    }

    if (tagName === 'select' && this.hasSelectableOptions(element)) {
      actions.push('select');
    }

    if (this.isScrollable(element)) {
      actions.push('scroll');
    }

    return actions[this.randomIndex(actions.length)];
  }

  private buildAction(element: HTMLElement, type: ActionType): RecordedAction {
    const coordinates = this.getElementCenter(element);
    const tagName = element.tagName.toLowerCase();
    const action: RecordedAction = {
      id: ++this.actionCounter,
      type,
      selector: this.generateSelector(element),
      timestamp: Date.now(),
      tagName,
      text: this.readElementText(element),
      x: coordinates?.x,
      y: coordinates?.y
    };

    if (type === 'type') {
      action.value = this.generateInputValue(element);
    }

    if (type === 'select') {
      action.optionValue = this.pickOptionValue(element);
    }

    if (type === 'scroll') {
      action.scrollTop = this.pickScrollTop(element);
    }

    return action;
  }

  private performAction(element: HTMLElement, action: RecordedAction) {
    switch (action.type) {
      case 'click':
        if (typeof element.click === 'function') {
          element.click();
        } else {
          element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
        break;
      case 'dblclick':
        element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        break;
      case 'type':
        this.applyInputValue(element, action.value ?? '');
        break;
      case 'select':
        this.applySelectValue(element, action.optionValue ?? '');
        break;
      case 'scroll':
        this.applyScroll(element, action.scrollTop ?? 0);
        break;
      default:
        break;
    }
  }

  private applyInputValue(element: HTMLElement, value: string) {
    this.writeProperty(element, 'value', value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private applySelectValue(element: HTMLElement, value: string) {
    this.writeProperty(element, 'value', value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private applyScroll(element: HTMLElement, scrollTop: number) {
    this.writeProperty(element, 'scrollTop', scrollTop);
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  }

  private isTextLikeInput(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'textarea') {
      return true;
    }

    if (tagName !== 'input') {
      return false;
    }

    const inputType = this.readStringProperty(element, 'type').toLowerCase();
    return (
      inputType === '' ||
      inputType === 'text' ||
      inputType === 'search' ||
      inputType === 'email' ||
      inputType === 'password' ||
      inputType === 'tel' ||
      inputType === 'url' ||
      inputType === 'number'
    );
  }

  private hasSelectableOptions(element: HTMLElement): boolean {
    const options = this.readArrayProperty<{ value?: string; disabled?: boolean }>(element, 'options');
    return options.some((option) => !option?.disabled && typeof option?.value === 'string');
  }

  private pickOptionValue(element: HTMLElement): string {
    const options = this.readArrayProperty<{ value?: string; disabled?: boolean }>(element, 'options')
      .filter((option) => !option?.disabled && typeof option?.value === 'string');

    if (options.length === 0) {
      return '';
    }

    return options[this.randomIndex(options.length)]?.value ?? '';
  }

  private isScrollable(element: HTMLElement): boolean {
    const scrollHeight = this.readNumberProperty(element, 'scrollHeight');
    const clientHeight = this.readNumberProperty(element, 'clientHeight');
    return scrollHeight > clientHeight && clientHeight > 0;
  }

  private pickScrollTop(element: HTMLElement): number {
    const scrollHeight = this.readNumberProperty(element, 'scrollHeight');
    const clientHeight = this.readNumberProperty(element, 'clientHeight');
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

    if (maxScrollTop === 0) {
      return 0;
    }

    return Math.floor(this.options.random.next() * (maxScrollTop + 1));
  }

  private generateInputValue(element: HTMLElement): string {
    const inputType = this.readStringProperty(element, 'type').toLowerCase();

    if (inputType === 'number') {
      return String(Math.floor(this.options.random.next() * 10000));
    }

    if (inputType === 'email') {
      return `chaos-${Math.floor(this.options.random.next() * 10000)}@example.test`;
    }

    if (inputType === 'tel') {
      return `${Math.floor(100000000 + this.options.random.next() * 900000000)}`;
    }

    if (inputType === 'url') {
      return `https://chaos.test/${Math.floor(this.options.random.next() * 10000)}`;
    }

    const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: DEFAULT_TEXT_LENGTH }, () => {
      return charset[this.randomIndex(charset.length)];
    }).join('');
  }

  private generateSelector(element: HTMLElement): string {
    const directSelector = this.getStableSelector(element);
    if (directSelector) {
      return directSelector;
    }

    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const stableSelector = this.getStableSelector(current);
      if (stableSelector) {
        path.unshift(stableSelector);
        break;
      }

      let selector = current.tagName.toLowerCase();
      let sibling = current.previousElementSibling;
      let index = 1;

      while (sibling) {
        if (sibling.tagName.toLowerCase() === selector) {
          index += 1;
        }
        sibling = sibling.previousElementSibling;
      }

      selector += `:nth-of-type(${index})`;
      path.unshift(selector);

      current = current.parentElement;
      if (current === this.target.parentElement) {
        break;
      }
    }

    return path.join(' > ') || element.tagName.toLowerCase();
  }

  private getStableSelector(element: HTMLElement): string | null {
    if (element.id) {
      return `#${this.escapeCssIdentifier(element.id)}`;
    }

    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId) {
      return `[data-testid="${this.escapeCssAttribute(dataTestId)}"]`;
    }

    const name = element.getAttribute('name');
    if (name) {
      return `${element.tagName.toLowerCase()}[name="${this.escapeCssAttribute(name)}"]`;
    }

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return `${element.tagName.toLowerCase()}[aria-label="${this.escapeCssAttribute(ariaLabel)}"]`;
    }

    return null;
  }

  private escapeCssIdentifier(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }

    return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
  }

  private escapeCssAttribute(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private getElementCenter(element: HTMLElement): { x: number; y: number } | null {
    if (typeof element.getBoundingClientRect !== 'function') {
      return null;
    }

    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  private readElementText(element: HTMLElement): string | undefined {
    const text = typeof element.textContent === 'string' ? element.textContent.trim() : '';
    return text || undefined;
  }

  private randomIndex(length: number): number {
    return Math.floor(this.options.random.next() * length);
  }

  private matchesSelector(element: HTMLElement, selector: string): boolean {
    if (!selector || typeof element.matches !== 'function') {
      return false;
    }

    return element.matches(selector);
  }

  private hasMatchingAncestor(element: HTMLElement, selector: string): boolean {
    let current = element.parentElement;

    while (current) {
      if (this.matchesSelector(current, selector)) {
        return true;
      }

      if (current === this.target.parentElement) {
        break;
      }

      current = current.parentElement;
    }

    return false;
  }

  private log(message: string) {
    if (this.options.log) {
      console.log(`[ui-chaos] ${message}`);
    }
  }

  private readBooleanProperty(element: HTMLElement, key: string): boolean {
    return Boolean((element as unknown as Record<string, unknown>)[key]);
  }

  private readStringProperty(element: HTMLElement, key: string): string {
    const value = (element as unknown as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
  }

  private readNumberProperty(element: HTMLElement, key: string): number {
    const value = (element as unknown as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : 0;
  }

  private readArrayProperty<T>(element: HTMLElement, key: string): T[] {
    const value = (element as unknown as Record<string, unknown>)[key];
    if (!value) {
      return [];
    }

    return Array.from(value as Iterable<T>);
  }

  private writeProperty(element: HTMLElement, key: string, value: unknown) {
    (element as unknown as Record<string, unknown>)[key] = value;
  }
}
