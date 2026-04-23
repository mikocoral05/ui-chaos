import { NetworkRecorder } from './network-recorder.ts';
import type { RandomSource } from './random.ts';
import type {
  NetworkChaosOptions,
  NetworkFailureMode,
  NetworkTransport,
  RecordedNetworkEvent
} from './types.ts';

type NormalizedNetworkChaosOptions = Omit<Required<NetworkChaosOptions>, 'failureMode'> & {
  failureMode: NetworkFailureMode[];
};

interface NetworkChaosRuntimeOptions {
  config: NormalizedNetworkChaosOptions;
  log: boolean;
  random: RandomSource;
  recorder: NetworkRecorder;
}

interface PlannedNetworkEvent {
  event: RecordedNetworkEvent;
}

type FetchLike = (input: unknown, init?: unknown) => Promise<unknown>;

type XhrConstructor = new () => XMLHttpRequest;

const DEFAULT_STATUS_CODES = [500, 502, 503, 504];

interface NetworkInterceptorRuntime {
  managers: NetworkChaosManager[];
  originalFetch: FetchLike | null;
  originalXhr: XhrConstructor | null;
  fetchInstalled: boolean;
  xhrInstalled: boolean;
}

const networkInterceptorRuntime: NetworkInterceptorRuntime = {
  managers: [],
  originalFetch: null,
  originalXhr: null,
  fetchInstalled: false,
  xhrInstalled: false
};

export class NetworkChaosManager {
  private active = false;
  private nextEventId = 0;

  constructor(private readonly options: NetworkChaosRuntimeOptions) {
    registerNetworkChaosManager(this);
  }

  get isEnabled(): boolean {
    return this.options.config.enabled;
  }

  get isRunning(): boolean {
    return this.active;
  }

  start(): boolean {
    if (!this.isEnabled || this.active) {
      return false;
    }

    this.active = true;
    this.log('Network chaos started.');
    return true;
  }

  stop() {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.log('Network chaos stopped.');
  }

  destroy() {
    this.stop();
    unregisterNetworkChaosManager(this);
  }

  getHistory(): RecordedNetworkEvent[] {
    return this.options.recorder.getHistory();
  }

  supportsTransport(transport: NetworkTransport): boolean {
    if (transport === 'fetch') {
      return this.options.config.interceptFetch;
    }

    return this.options.config.interceptXhr;
  }

  canHandleRequest(url: string, method: string, transport: NetworkTransport): boolean {
    if (!this.active || !this.supportsTransport(transport)) {
      return false;
    }

    const normalizedMethod = normalizeMethod(method);
    return (
      matchesMethod(normalizedMethod, this.options.config.methods) &&
      matchesUrl(url, this.options.config.includeUrls, this.options.config.excludeUrls)
    );
  }

  planRequest(url: string, method: string, transport: NetworkTransport): PlannedNetworkEvent | null {
    if (!this.canHandleRequest(url, method, transport)) {
      return null;
    }

    const normalizedMethod = normalizeMethod(method);

    const delayMs = randomInt(
      this.options.random,
      this.options.config.minDelayMs,
      this.options.config.maxDelayMs
    );

    const shouldFail =
      this.options.config.failureRate > 0 &&
      this.options.random.next() < this.options.config.failureRate;

    const failureMode = shouldFail
      ? pickFailureMode(this.options.random, this.options.config.failureMode)
      : undefined;

    if (delayMs <= 0 && !failureMode) {
      return null;
    }

    const statusCode =
      failureMode === 'http-error'
        ? pickStatusCode(this.options.random, this.options.config.statusCodes)
        : undefined;

    const event: RecordedNetworkEvent = {
      id: ++this.nextEventId,
      timestamp: Date.now(),
      transport,
      url,
      method: normalizedMethod,
      delayMs,
      failureMode,
      statusCode
    };

    this.options.recorder.record(event);
    this.log(
      `Network chaos injected for ${transport.toUpperCase()} ${normalizedMethod} ${url}` +
        `${delayMs > 0 ? ` with ${delayMs}ms delay` : ''}` +
        `${failureMode ? ` and ${failureMode}` : ''}.`
    );

    return { event };
  }

  private log(message: string) {
    if (this.options.log) {
      console.log(`[ui-chaos] ${message}`);
    }
  }
}

function registerNetworkChaosManager(manager: NetworkChaosManager) {
  networkInterceptorRuntime.managers.push(manager);
  syncFetchInterceptor();
  syncXhrInterceptor();
}

function unregisterNetworkChaosManager(manager: NetworkChaosManager) {
  networkInterceptorRuntime.managers = networkInterceptorRuntime.managers.filter(
    (candidate) => candidate !== manager
  );
  syncFetchInterceptor();
  syncXhrInterceptor();
}

function syncFetchInterceptor() {
  if (hasRegisteredTransport('fetch')) {
    installFetchInterceptor();
    return;
  }

  restoreFetchInterceptor();
}

function syncXhrInterceptor() {
  if (hasRegisteredTransport('xhr')) {
    installXhrInterceptor();
    return;
  }

  restoreXhrInterceptor();
}

function hasRegisteredTransport(transport: NetworkTransport): boolean {
  return networkInterceptorRuntime.managers.some((manager) => manager.supportsTransport(transport));
}

function installFetchInterceptor() {
  if (
    networkInterceptorRuntime.fetchInstalled ||
    typeof window === 'undefined' ||
    typeof window.fetch !== 'function'
  ) {
    return;
  }

  networkInterceptorRuntime.originalFetch = window.fetch as unknown as FetchLike;

  const patchedFetch = async (input: unknown, init?: unknown) => {
    return handlePatchedFetch(input, init);
  };

  (window as unknown as Record<string, unknown>).fetch = patchedFetch;
  (globalThis as Record<string, unknown>).fetch = patchedFetch;
  networkInterceptorRuntime.fetchInstalled = true;
}

function restoreFetchInterceptor() {
  if (!networkInterceptorRuntime.fetchInstalled || !networkInterceptorRuntime.originalFetch) {
    return;
  }

  (window as unknown as Record<string, unknown>).fetch = networkInterceptorRuntime.originalFetch;
  (globalThis as Record<string, unknown>).fetch = networkInterceptorRuntime.originalFetch;
  networkInterceptorRuntime.fetchInstalled = false;
  networkInterceptorRuntime.originalFetch = null;
}

function installXhrInterceptor() {
  if (
    networkInterceptorRuntime.xhrInstalled ||
    typeof window === 'undefined' ||
    typeof window.XMLHttpRequest !== 'function'
  ) {
    return;
  }

  networkInterceptorRuntime.originalXhr = window.XMLHttpRequest as unknown as XhrConstructor;
  const OriginalXhr = networkInterceptorRuntime.originalXhr;

  function PatchedXMLHttpRequest(this: unknown) {
    return new NetworkChaosXMLHttpRequest(OriginalXhr);
  }

  const patchedXhr = PatchedXMLHttpRequest as unknown as typeof XMLHttpRequest;
  Object.assign(patchedXhr, {
    UNSENT: 0,
    OPENED: 1,
    HEADERS_RECEIVED: 2,
    LOADING: 3,
    DONE: 4
  });

  (window as unknown as Record<string, unknown>).XMLHttpRequest = patchedXhr;
  (globalThis as Record<string, unknown>).XMLHttpRequest = patchedXhr;
  networkInterceptorRuntime.xhrInstalled = true;
}

function restoreXhrInterceptor() {
  if (!networkInterceptorRuntime.xhrInstalled || !networkInterceptorRuntime.originalXhr) {
    return;
  }

  (window as unknown as Record<string, unknown>).XMLHttpRequest = networkInterceptorRuntime.originalXhr;
  (globalThis as Record<string, unknown>).XMLHttpRequest = networkInterceptorRuntime.originalXhr;
  networkInterceptorRuntime.xhrInstalled = false;
  networkInterceptorRuntime.originalXhr = null;
}

async function handlePatchedFetch(input: unknown, init?: unknown): Promise<unknown> {
  if (!networkInterceptorRuntime.originalFetch) {
    throw new Error('[ui-chaos] fetch is unavailable in this runtime.');
  }

  const request = normalizeFetchRequest(input, init);
  const planned = planInterceptedRequest(request.url, request.method, 'fetch');

  if (!planned) {
    return invokeOriginalFetch(input, init);
  }

  if (planned.event.delayMs > 0) {
    await sleep(planned.event.delayMs);
  }

  if (planned.event.failureMode === 'network-error') {
    throw new TypeError(
      `[ui-chaos] Injected network error for ${planned.event.method} ${planned.event.url}`
    );
  }

  if (planned.event.failureMode === 'http-error') {
    return createFetchFailureResponse(planned.event);
  }

  return invokeOriginalFetch(input, init);
}

function planInterceptedRequest(
  url: string,
  method: string,
  transport: NetworkTransport
): PlannedNetworkEvent | null {
  const owner = [...networkInterceptorRuntime.managers]
    .reverse()
    .find((manager) => manager.canHandleRequest(url, method, transport));

  if (!owner) {
    return null;
  }

  return owner.planRequest(url, method, transport);
}

function invokeOriginalFetch(input: unknown, init?: unknown): Promise<unknown> {
  if (!networkInterceptorRuntime.originalFetch) {
    throw new Error('[ui-chaos] fetch is unavailable in this runtime.');
  }

  return networkInterceptorRuntime.originalFetch.call(window, input, init);
}

class NetworkChaosXMLHttpRequest {
  static readonly UNSENT = 0;
  static readonly OPENED = 1;
  static readonly HEADERS_RECEIVED = 2;
  static readonly LOADING = 3;
  static readonly DONE = 4;

  readonly upload: XMLHttpRequestUpload | null = null;

  onreadystatechange: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null;
  onload: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null;
  onerror: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null;
  onabort: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null;
  ontimeout: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null;
  onloadend: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null;
  onloadstart: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null;
  onprogress: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null;

  readyState = NetworkChaosXMLHttpRequest.UNSENT;
  response: unknown = null;
  responseText = '';
  responseType: XMLHttpRequestResponseType = '';
  responseURL = '';
  responseXML: Document | null = null;
  status = 0;
  statusText = '';
  timeout = 0;
  withCredentials = false;

  private nativeXhr: XMLHttpRequest | null = null;
  private openArgs: [string, string, boolean | undefined, string | undefined, string | undefined] | null =
    null;
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();
  private readonly requestHeaders = new Map<string, string>();
  private readonly responseHeaders = new Map<string, string>();
  private aborted = false;

  constructor(private readonly NativeXhr: XhrConstructor) {}

  open(method: string, url: string, async?: boolean, user?: string, password?: string) {
    this.openArgs = [method, url, async, user, password];
    this.readyState = NetworkChaosXMLHttpRequest.OPENED;
    this.responseURL = resolveUrl(url);
    this.dispatchLocalEvent('readystatechange');
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders.set(name, value);
    this.nativeXhr?.setRequestHeader(name, value);
  }

  send(body?: Document | XMLHttpRequestBodyInit | null) {
    const [method, rawUrl] = this.openArgs ?? ['GET', '', true, undefined, undefined];
    const url = resolveUrl(rawUrl);
    const planned = planInterceptedRequest(url, method, 'xhr');

    if (!planned) {
      this.performNativeSend(body);
      return;
    }

    void sleep(planned.event.delayMs).then(() => {
      if (this.aborted) {
        return;
      }

      if (planned.event.failureMode === 'network-error') {
        this.simulateNetworkError();
        return;
      }

      if (planned.event.failureMode === 'http-error') {
        this.simulateHttpError(planned.event.statusCode ?? 503);
        return;
      }

      this.performNativeSend(body);
    });
  }

  abort() {
    this.aborted = true;
    this.nativeXhr?.abort();
    this.dispatchLocalEvent('abort');
    this.dispatchLocalEvent('loadend');
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
    this.dispatchLocalEvent(event.type, event);
    return true;
  }

  getAllResponseHeaders(): string {
    if (this.nativeXhr) {
      return this.nativeXhr.getAllResponseHeaders();
    }

    return Array.from(this.responseHeaders.entries())
      .map(([name, value]) => `${name}: ${value}`)
      .join('\r\n');
  }

  getResponseHeader(name: string): string | null {
    if (this.nativeXhr) {
      return this.nativeXhr.getResponseHeader(name);
    }

    return this.responseHeaders.get(name.toLowerCase()) ?? null;
  }

  overrideMimeType(mime: string) {
    this.nativeXhr?.overrideMimeType(mime);
  }

  private performNativeSend(body?: Document | XMLHttpRequestBodyInit | null) {
    const [method, url, async, user, password] = this.openArgs ?? ['GET', '', true, undefined, undefined];
    const nativeXhr = new this.NativeXhr();

    this.nativeXhr = nativeXhr;
    nativeXhr.responseType = this.responseType;
    nativeXhr.timeout = this.timeout;
    nativeXhr.withCredentials = this.withCredentials;

    bindNativeXhrEvents(this, nativeXhr);
    nativeXhr.open(method, url, async ?? true, user, password);

    for (const [name, value] of this.requestHeaders.entries()) {
      nativeXhr.setRequestHeader(name, value);
    }

    nativeXhr.send(body ?? null);
  }

  private simulateNetworkError() {
    this.readyState = NetworkChaosXMLHttpRequest.DONE;
    this.status = 0;
    this.statusText = '';
    this.response = null;
    this.responseText = '';
    this.dispatchLocalEvent('readystatechange');
    this.dispatchLocalEvent('error');
    this.dispatchLocalEvent('loadend');
  }

  private simulateHttpError(statusCode: number) {
    const payload = {
      error: 'Injected by ui-chaos',
      url: this.responseURL,
      status: statusCode
    };

    this.readyState = NetworkChaosXMLHttpRequest.DONE;
    this.status = statusCode;
    this.statusText = `Injected ${statusCode}`;
    this.responseHeaders.set('content-type', 'application/json');
    this.responseHeaders.set('x-ui-chaos', 'true');
    this.responseText = JSON.stringify(payload);
    this.response =
      this.responseType === 'json'
        ? payload
        : this.responseType === '' || this.responseType === 'text'
          ? this.responseText
          : null;

    this.dispatchLocalEvent('readystatechange');
    this.dispatchLocalEvent('load');
    this.dispatchLocalEvent('loadend');
  }

  private dispatchLocalEvent(type: string, incomingEvent?: Event) {
    const event = incomingEvent ?? createRuntimeEvent(type);
    const listeners = this.listeners.get(type);

    for (const listener of listeners ?? []) {
      listener.call(this, event);
    }

    const handler = this.getHandler(type);
    if (typeof handler === 'function') {
      handler.call(this as unknown as XMLHttpRequest, event);
    }
  }

  private getHandler(type: string) {
    const handlerName = `on${type}` as keyof NetworkChaosXMLHttpRequest;
    return this[handlerName];
  }

  syncFromNative(nativeXhr: XMLHttpRequest) {
    this.readyState = nativeXhr.readyState;
    this.response = nativeXhr.response;
    this.responseType = nativeXhr.responseType;
    this.responseURL = nativeXhr.responseURL;
    this.status = nativeXhr.status;
    this.statusText = nativeXhr.statusText;
    this.timeout = nativeXhr.timeout;
    this.withCredentials = nativeXhr.withCredentials;

    try {
      this.responseText = nativeXhr.responseText;
    } catch {
      this.responseText = '';
    }
  }
}

function bindNativeXhrEvents(wrapper: NetworkChaosXMLHttpRequest, nativeXhr: XMLHttpRequest) {
  const events = [
    'readystatechange',
    'loadstart',
    'progress',
    'abort',
    'error',
    'load',
    'timeout',
    'loadend'
  ] as const;

  for (const eventName of events) {
    nativeXhr.addEventListener(eventName, (event) => {
      wrapper.syncFromNative(nativeXhr);
      wrapper.dispatchEvent(event);
    });
  }
}

function normalizeFetchRequest(input: unknown, init?: unknown): { url: string; method: string } {
  if (typeof input === 'string' || input instanceof URL) {
    return {
      url: resolveUrl(String(input)),
      method: normalizeMethod(extractObjectValue(init, 'method') ?? 'GET')
    };
  }

  if (input && typeof input === 'object') {
    const url = extractObjectValue(input, 'url') ?? '';
    const method = extractObjectValue(init, 'method') ?? extractObjectValue(input, 'method') ?? 'GET';

    return {
      url: resolveUrl(String(url)),
      method: normalizeMethod(String(method))
    };
  }

  return {
    url: resolveUrl(''),
    method: 'GET'
  };
}

function createFetchFailureResponse(event: RecordedNetworkEvent): Response {
  const body = JSON.stringify({
    error: 'Injected by ui-chaos',
    url: event.url,
    method: event.method,
    status: event.statusCode ?? 503
  });

  if (typeof Response !== 'undefined') {
    return new Response(body, {
      status: event.statusCode ?? 503,
      headers: {
        'content-type': 'application/json',
        'x-ui-chaos': 'true'
      }
    });
  }

  return {
    ok: false,
    status: event.statusCode ?? 503,
    url: event.url,
    headers: {
      get(name: string) {
        const normalizedName = name.toLowerCase();
        if (normalizedName === 'content-type') {
          return 'application/json';
        }

        if (normalizedName === 'x-ui-chaos') {
          return 'true';
        }

        return null;
      }
    },
    text: async () => body,
    json: async () => JSON.parse(body)
  } as Response;
}

function matchesMethod(method: string, configuredMethods: string[]): boolean {
  if (configuredMethods.length === 0) {
    return true;
  }

  return configuredMethods.includes(method);
}

function matchesUrl(url: string, includeUrls: string[], excludeUrls: string[]): boolean {
  if (excludeUrls.some((pattern) => matchesPattern(url, pattern))) {
    return false;
  }

  if (includeUrls.length === 0) {
    return true;
  }

  return includeUrls.some((pattern) => matchesPattern(url, pattern));
}

function matchesPattern(url: string, pattern: string): boolean {
  if (!pattern) {
    return false;
  }

  if (pattern.includes('*')) {
    const expression = new RegExp(
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
    );
    return expression.test(url);
  }

  return url.includes(pattern);
}

function pickFailureMode(
  random: RandomSource,
  failureModes: NetworkFailureMode[]
): NetworkFailureMode {
  return failureModes[randomInt(random, 0, failureModes.length - 1)] ?? 'network-error';
}

function pickStatusCode(random: RandomSource, statusCodes: number[]): number {
  return statusCodes[randomInt(random, 0, statusCodes.length - 1)] ?? 503;
}

function randomInt(random: RandomSource, min: number, max: number): number {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);

  if (safeMin === safeMax) {
    return safeMin;
  }

  return Math.floor(random.next() * (safeMax - safeMin + 1)) + safeMin;
}

function normalizeMethod(method: string): string {
  return method.toUpperCase();
}

function resolveUrl(url: string): string {
  const baseUrl = typeof window !== 'undefined' && window.location?.href
    ? window.location.href
    : 'http://localhost:3000/';

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function createRuntimeEvent(type: string): Event {
  if (typeof Event !== 'undefined') {
    return new Event(type);
  }

  return { type } as Event;
}

function extractObjectValue(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate : undefined;
}

async function sleep(durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export function normalizeNetworkChaosOptions(
  options: NetworkChaosOptions | undefined,
  fallbackHistorySize: number
): NormalizedNetworkChaosOptions {
  const minDelayMs = Math.max(0, options?.minDelayMs ?? 0);
  const maxDelayMs = Math.max(minDelayMs, options?.maxDelayMs ?? minDelayMs);

  return {
    enabled: options?.enabled ?? false,
    historySize: Math.max(1, options?.historySize ?? fallbackHistorySize),
    minDelayMs,
    maxDelayMs,
    failureRate: clamp(options?.failureRate ?? 0, 0, 1),
    failureMode: normalizeFailureModes(options?.failureMode),
    statusCodes: normalizeStatusCodes(options?.statusCodes),
    methods: normalizeMethods(options?.methods),
    includeUrls: options?.includeUrls ?? [],
    excludeUrls: options?.excludeUrls ?? [],
    interceptFetch: options?.interceptFetch ?? true,
    interceptXhr: options?.interceptXhr ?? true
  };
}

function normalizeFailureModes(
  failureMode: NetworkChaosOptions['failureMode']
): NetworkFailureMode[] {
  if (!failureMode) {
    return ['network-error'];
  }

  return Array.isArray(failureMode) ? failureMode : [failureMode];
}

function normalizeStatusCodes(statusCodes: number[] | undefined): number[] {
  if (!statusCodes || statusCodes.length === 0) {
    return [...DEFAULT_STATUS_CODES];
  }

  return statusCodes.filter((statusCode) => Number.isFinite(statusCode) && statusCode >= 400);
}

function normalizeMethods(methods: string[] | undefined): string[] {
  return methods?.map((method) => method.toUpperCase()) ?? [];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
