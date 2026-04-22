import { vi } from 'vitest';

type Listener = (event: unknown) => void;

export class FakeNode {
  static readonly ELEMENT_NODE = 1;
}

export class FakeEvent {
  readonly type: string;
  readonly bubbles: boolean;
  readonly cancelable: boolean;

  constructor(type: string, init: { bubbles?: boolean; cancelable?: boolean } = {}) {
    this.type = type;
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
  }
}

export class FakeMouseEvent extends FakeEvent {}

export class FakeMutationObserver {
  constructor(private readonly callback: () => void) {}

  observe() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }

  trigger() {
    this.callback();
  }
}

export class FakeResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  readonly url: string;

  constructor(
    private readonly body: string,
    init: {
      status?: number;
      headers?: Record<string, string>;
      url?: string;
    } = {}
  ) {
    this.status = init.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.url = init.url ?? 'http://localhost:3000/';
    const headers = Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value])
    );
    this.headers = {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      }
    };
  }

  async text() {
    return this.body;
  }

  async json() {
    return JSON.parse(this.body);
  }
}

export class FakeXMLHttpRequest extends FakeNode {
  static readonly UNSENT = 0;
  static readonly OPENED = 1;
  static readonly HEADERS_RECEIVED = 2;
  static readonly LOADING = 3;
  static readonly DONE = 4;

  readyState = FakeXMLHttpRequest.UNSENT;
  response: unknown = null;
  responseText = '';
  responseType: XMLHttpRequestResponseType = '';
  responseURL = '';
  responseXML: Document | null = null;
  status = 0;
  statusText = '';
  timeout = 0;
  withCredentials = false;
  upload = null;

  onreadystatechange: ((event: Event) => void) | null = null;
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onabort: ((event: Event) => void) | null = null;
  ontimeout: ((event: Event) => void) | null = null;
  onloadend: ((event: Event) => void) | null = null;

  private readonly listeners = new Map<string, Set<(event: Event) => void>>();
  private readonly requestHeaders = new Map<string, string>();
  private responseHeaders = {
    'content-type': 'application/json'
  };
  private method = 'GET';
  private url = 'http://localhost:3000/';

  open(method: string, url: string) {
    this.method = method.toUpperCase();
    this.url = url;
    this.readyState = FakeXMLHttpRequest.OPENED;
    this.dispatchLifecycle('readystatechange');
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders.set(name.toLowerCase(), value);
  }

  send() {
    this.readyState = FakeXMLHttpRequest.DONE;
    this.status = 200;
    this.statusText = 'OK';
    this.responseURL = this.url;
    this.responseText = JSON.stringify({ ok: true, method: this.method, url: this.url });
    this.response = this.responseType === 'json' ? JSON.parse(this.responseText) : this.responseText;
    this.dispatchLifecycle('readystatechange');
    this.dispatchLifecycle('load');
    this.dispatchLifecycle('loadend');
  }

  abort() {
    this.dispatchLifecycle('abort');
    this.dispatchLifecycle('loadend');
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    this.dispatchLifecycle(event.type, event);
    return true;
  }

  getAllResponseHeaders(): string {
    return Object.entries(this.responseHeaders)
      .map(([name, value]) => `${name}: ${value}`)
      .join('\r\n');
  }

  getResponseHeader(name: string): string | null {
    return this.responseHeaders[name.toLowerCase() as keyof typeof this.responseHeaders] ?? null;
  }

  overrideMimeType() {
    return undefined;
  }

  private dispatchLifecycle(type: string, incomingEvent?: Event) {
    const event = incomingEvent ?? (new FakeEvent(type) as unknown as Event);
    for (const listener of this.listeners.get(type) ?? []) {
      listener.call(this, event);
    }

    const handler = (this as unknown as Record<string, unknown>)[`on${type}`];
    if (typeof handler === 'function') {
      (handler as (event: Event) => void).call(this, event);
    }
  }
}

export class FakeElement extends FakeNode {
  readonly nodeType = FakeNode.ELEMENT_NODE;
  readonly tagName: string;
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly dispatchedEvents: string[] = [];

  id = '';
  isConnected = true;
  previousElementSibling: FakeElement | null = null;
  parentElement: FakeElement | null = null;
  parentNode: FakeElement | null = null;
  textContent = '';
  innerHTML = '';
  disabled = false;
  readOnly = false;
  type = '';
  value = '';
  download = '';
  href = '';
  scrollHeight = 0;
  clientHeight = 0;
  scrollTop = 0;
  options: Array<{ value: string; disabled?: boolean }> = [];
  clicked = 0;
  styleRecord = {
    display: 'block',
    visibility: 'visible',
    pointerEvents: 'auto'
  };

  constructor(tagName: string, setup: { id?: string; textContent?: string } = {}) {
    super();
    this.tagName = tagName.toUpperCase();
    this.id = setup.id ?? '';
    this.textContent = setup.textContent ?? '';
    this.innerHTML = this.textContent;
  }

  get childElementCount(): number {
    return this.children.length;
  }

  appendChild(child: FakeElement) {
    if (this.children.length > 0) {
      child.previousElementSibling = this.children[this.children.length - 1] ?? null;
    }

    child.parentElement = this;
    child.parentNode = this;
    child.isConnected = true;
    this.children.push(child);
    this.refreshInnerHtml();
    return child;
  }

  removeChild(child: FakeElement) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentElement = null;
      child.parentNode = null;
      child.previousElementSibling = null;
      child.isConnected = false;
      for (let childIndex = 0; childIndex < this.children.length; childIndex += 1) {
        this.children[childIndex].previousElementSibling = this.children[childIndex - 1] ?? null;
      }
      this.refreshInnerHtml();
    }

    return child;
  }

  register(child: FakeElement) {
    return this.appendChild(child);
  }

  click() {
    this.clicked += 1;
    this.dispatchedEvents.push('click');
  }

  dispatchEvent(event: { type: string }) {
    this.dispatchedEvents.push(event.type);
    return true;
  }

  getBoundingClientRect() {
    return {
      left: 10,
      top: 10,
      width: 120,
      height: 32
    };
  }

  querySelectorAll(selector: string): FakeElement[] {
    const selectors = selector.split(',').map((part) => part.trim()).filter(Boolean);
    return this.children.filter((child) => selectors.some((candidate) => child.matches(candidate)));
  }

  matches(selector: string): boolean {
    if (!selector) {
      return false;
    }

    if (selector === 'button') {
      return this.tagName === 'BUTTON';
    }

    if (selector === 'input') {
      return this.tagName === 'INPUT';
    }

    if (selector === 'select') {
      return this.tagName === 'SELECT';
    }

    if (selector === 'textarea') {
      return this.tagName === 'TEXTAREA';
    }

    if (selector === 'a[href]') {
      return this.tagName === 'A' && this.attributes.has('href');
    }

    if (selector === '[role="button"]') {
      return this.getAttribute('role') === 'button';
    }

    if (selector === '[tabindex]:not([tabindex="-1"])') {
      const tabindex = this.getAttribute('tabindex');
      return tabindex !== null && tabindex !== '-1';
    }

    if (selector === '[data-chaos-ignore]' || selector === '[data-ui-chaos-ignore]') {
      return this.attributes.has(selector.slice(1, -1));
    }

    if (selector.startsWith('#')) {
      return this.id === selector.slice(1);
    }

    if (selector.startsWith('[data-testid="')) {
      return this.getAttribute('data-testid') === selector.slice(14, -2);
    }

    const nameMatch = selector.match(/^([a-z]+)\[name="(.+)"\]$/i);
    if (nameMatch) {
      return (
        this.tagName.toLowerCase() === nameMatch[1].toLowerCase() &&
        this.getAttribute('name') === nameMatch[2]
      );
    }

    return false;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  getAttribute(name: string): string | null {
    if (name === 'id') {
      return this.id || null;
    }

    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string) {
    if (name === 'id') {
      this.id = value;
      return;
    }

    this.attributes.set(name, value);
  }

  private refreshInnerHtml() {
    this.innerHTML = this.children.map((child) => child.tagName.toLowerCase()).join('');
  }
}

export function installFakeBrowser() {
  const listeners = new Map<string, Set<Listener>>();
  const intervals = new Map<number, () => void>();
  const fetchCalls: Array<{ input: unknown; init: unknown }> = [];
  let nextIntervalId = 1;
  const body = new FakeElement('body');

  const document = {
    body,
    createElement: (tagName: string) => new FakeElement(tagName)
  };

  const baseFetch = async (input: unknown, init?: unknown) => {
    fetchCalls.push({ input, init });
    const url = typeof input === 'string' ? input : 'http://localhost:3000/';
    return new FakeResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      url
    });
  };

  const window = {
    location: { href: 'http://localhost:3000/' },
    navigator: { userAgent: 'ui-chaos-test-browser' },
    fetch: baseFetch,
    XMLHttpRequest: FakeXMLHttpRequest,
    Response: FakeResponse,
    addEventListener: (type: string, listener: Listener) => {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }

      listeners.get(type)?.add(listener);
    },
    removeEventListener: (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
    },
    setInterval: (callback: () => void) => {
      const id = nextIntervalId;
      nextIntervalId += 1;
      intervals.set(id, callback);
      return id;
    },
    clearInterval: (id: number) => {
      intervals.delete(id);
    },
    setTimeout,
    clearTimeout,
    getComputedStyle: (element: FakeElement) => element.styleRecord
  };

  const contains = (target: FakeElement): boolean => {
    let current: FakeElement | null = target;
    while (current) {
      if (current === body) {
        return true;
      }

      current = current.parentElement;
    }

    return false;
  };

  body.contains = contains as unknown as typeof body.contains;

  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  vi.stubGlobal('navigator', window.navigator);
  vi.stubGlobal('fetch', baseFetch);
  vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
  vi.stubGlobal('Response', FakeResponse);
  vi.stubGlobal('Node', FakeNode);
  vi.stubGlobal('Event', FakeEvent);
  vi.stubGlobal('MouseEvent', FakeMouseEvent);
  vi.stubGlobal('MutationObserver', FakeMutationObserver);

  return {
    body,
    document,
    window,
    fetchCalls,
    emitWindowEvent(type: string, event: unknown) {
      for (const listener of listeners.get(type) ?? []) {
        listener(event);
      }
    },
    runInterval(id: number) {
      intervals.get(id)?.();
    },
    cleanup() {
      vi.unstubAllGlobals();
    }
  };
}
