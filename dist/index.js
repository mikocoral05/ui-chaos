var A = Object.defineProperty;
var I = (r, e, t) => e in r ? A(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t;
var i = (r, e, t) => I(r, typeof e != "symbol" ? e + "" : e, t);
class L {
  constructor(e) {
    i(this, "observer", null);
    i(this, "started", !1);
    i(this, "didTargetEverHaveContent");
    i(this, "handleError", (e) => {
      const t = e.message || "Unhandled window error";
      this.options.onCrash({
        kind: "error",
        reason: t,
        timestamp: Date.now()
      });
    });
    i(this, "handleRejection", (e) => {
      const t = e.reason instanceof Error ? e.reason.message : String(e.reason);
      this.options.onCrash({
        kind: "unhandledrejection",
        reason: t,
        timestamp: Date.now()
      });
    });
    this.options = e, this.didTargetEverHaveContent = this.hasMeaningfulContent(e.target);
  }
  start() {
    this.started || (this.started = !0, window.addEventListener("error", this.handleError), window.addEventListener("unhandledrejection", this.handleRejection), this.observer = new MutationObserver(() => {
      this.evaluateTargetState();
    }), this.observer.observe(document.body, { childList: !0, subtree: !0 }));
  }
  stop() {
    this.started && (this.started = !1, window.removeEventListener("error", this.handleError), window.removeEventListener("unhandledrejection", this.handleRejection), this.observer && (this.observer.disconnect(), this.observer = null));
  }
  evaluateTargetState() {
    const e = this.options.target;
    if (this.hasMeaningfulContent(e) && (this.didTargetEverHaveContent = !0), this.options.detectTargetRemoval && !document.body.contains(e)) {
      this.options.onCrash({
        kind: "target-removed",
        reason: "Target element was removed from the document.",
        timestamp: Date.now()
      });
      return;
    }
    this.options.detectEmptyTarget && this.didTargetEverHaveContent && !this.hasMeaningfulContent(e) && this.options.onCrash({
      kind: "empty-target",
      reason: "Target element became empty after previously rendering content.",
      timestamp: Date.now()
    });
  }
  hasMeaningfulContent(e) {
    var t;
    return e.childElementCount > 0 ? !0 : !!((t = e.textContent) != null && t.trim());
  }
}
const F = "http://localhost:3000/", x = "ui-chaos reproduced crash scenario";
function b(r, e = {}) {
  const t = C(r, e), s = [], n = !!t.crash;
  s.push("import { test } from '@playwright/test';"), s.push(""), s.push(`test(${u(e.testName ?? x)}, async ({ page }) => {`), s.push("  const pageErrors: string[] = [];"), s.push("  page.on('pageerror', (error) => {"), s.push("    pageErrors.push(error.message);"), s.push("  });"), s.push(""), typeof t.seed == "number" && (s.push(`  // Scenario seed: ${t.seed}`), s.push("")), s.push(...P(t.network)), s.push(`  await page.goto(${u(t.url)});`), s.push(""), t.crash && (s.push(`  // Captured crash reason: ${t.crash.kind} - ${t.crash.reason}`), s.push(""));
  for (const o of t.actions)
    s.push(`  // Action ${o.id} at ${new Date(o.timestamp).toISOString()}`), s.push(j(o));
  return n ? (s.push(""), s.push("  if (pageErrors.length > 0) {"), s.push(
    "    throw new Error(`Replayed crash scenario produced page errors:\\n${pageErrors.join('\\n')}`);"
  ), s.push("  }")) : (s.push(""), s.push("  // No crash was captured for this scenario. Add your own assertions here if needed.")), s.push("});"), s.push(""), s.join(`
`);
}
function v(r, e = {}) {
  const t = C(r, e), s = [];
  s.push(`describe(${u(e.testName ?? x)}, () => {`), s.push("  it('replays the captured UI actions', () => {"), typeof t.seed == "number" && (s.push(`    // Scenario seed: ${t.seed}`), s.push("")), s.push(...z(t.network)), s.push(`    cy.visit(${u(t.url)});`), s.push(""), t.crash && (s.push(`    // Captured crash reason: ${t.crash.kind} - ${t.crash.reason}`), s.push(""));
  for (const n of t.actions)
    s.push(`    // Action ${n.id} at ${new Date(n.timestamp).toISOString()}`), s.push(O(n));
  return s.push("  });"), s.push("});"), s.push(""), s.join(`
`);
}
function H(r, e = "both") {
  return e === "playwright" ? { playwright: b(r) } : e === "cypress" ? { cypress: v(r) } : {
    playwright: b(r),
    cypress: v(r)
  };
}
function U(r, e) {
  if (!X())
    return !1;
  const t = new Blob([r], { type: "text/plain;charset=utf-8" }), s = URL.createObjectURL(t), n = document.createElement("a");
  return n.href = s, n.download = e, n.style.display = "none", document.body.appendChild(n), n.click(), document.body.removeChild(n), URL.revokeObjectURL(s), !0;
}
function D(r, e = {}) {
  const t = q(e.baseFileName ?? "ui-chaos-crash"), s = [];
  r.playwright && s.push({
    content: r.playwright,
    filename: `${t}.spec.ts`
  }), r.cypress && s.push({
    content: r.cypress,
    filename: `${t}.cy.ts`
  });
  const n = [];
  for (const o of s)
    U(o.content, o.filename) && n.push(o.filename);
  return n;
}
function C(r, e) {
  var t, s;
  if (Array.isArray(r)) {
    const n = ((t = r[0]) == null ? void 0 : t.timestamp) ?? Date.now(), o = ((s = r[r.length - 1]) == null ? void 0 : s.timestamp) ?? n;
    return {
      url: e.url ?? E(),
      startedAt: n,
      endedAt: o,
      actions: [...r],
      network: []
    };
  }
  return {
    ...r,
    url: e.url ?? r.url ?? E(),
    actions: [...r.actions],
    network: [...r.network]
  };
}
function j(r) {
  const e = u(r.selector);
  switch (r.type) {
    case "click":
      return `  await page.locator(${e}).click();`;
    case "dblclick":
      return `  await page.locator(${e}).dblclick();`;
    case "type":
      return `  await page.locator(${e}).fill(${u(r.value ?? "")});`;
    case "select":
      return `  await page.locator(${e}).selectOption(${u(r.optionValue ?? "")});`;
    case "scroll":
      return `  await page.locator(${e}).evaluate((element, top) => { element.scrollTop = top; }, ${r.scrollTop ?? 0});`;
    default:
      return `  // Unsupported action type: ${r.type}`;
  }
}
function O(r) {
  const e = u(r.selector);
  switch (r.type) {
    case "click":
      return `    cy.get(${e}).click();`;
    case "dblclick":
      return `    cy.get(${e}).dblclick();`;
    case "type":
      return `    cy.get(${e}).clear().type(${u(r.value ?? "")}, { parseSpecialCharSequences: false });`;
    case "select":
      return `    cy.get(${e}).select(${u(r.optionValue ?? "")});`;
    case "scroll":
      return `    cy.get(${e}).scrollTo(0, ${r.scrollTop ?? 0});`;
    default:
      return `    // Unsupported action type: ${r.type}`;
  }
}
function P(r) {
  if (r.length === 0)
    return [];
  const e = [];
  return e.push(`  const networkChaos = ${JSON.stringify(r)};`), e.push("  await page.route('**/*', async (route) => {"), e.push("    const request = route.request();"), e.push(
    "    const index = networkChaos.findIndex((entry) => !entry.used && entry.url === request.url() && entry.method === request.method());"
  ), e.push("    if (index === -1) {"), e.push("      await route.continue();"), e.push("      return;"), e.push("    }"), e.push(""), e.push("    const entry = networkChaos[index];"), e.push("    entry.used = true;"), e.push(""), e.push("    if (entry.delayMs > 0) {"), e.push("      await new Promise((resolve) => setTimeout(resolve, entry.delayMs));"), e.push("    }"), e.push(""), e.push("    if (entry.failureMode === 'network-error') {"), e.push("      await route.abort('failed');"), e.push("      return;"), e.push("    }"), e.push(""), e.push("    if (entry.failureMode === 'http-error') {"), e.push("      await route.fulfill({"), e.push("        status: entry.statusCode ?? 503,"), e.push("        contentType: 'application/json',"), e.push(
    "        body: JSON.stringify({ error: 'Injected by ui-chaos', url: entry.url, method: entry.method })"
  ), e.push("      });"), e.push("      return;"), e.push("    }"), e.push(""), e.push("    await route.continue();"), e.push("  });"), e.push(""), e;
}
function z(r) {
  if (r.length === 0)
    return [];
  const e = [];
  return e.push(`    const networkChaos = ${JSON.stringify(r)};`), e.push("    networkChaos.forEach((entry) => {"), e.push("      cy.intercept({ method: entry.method, url: entry.url, times: 1 }, (req) => {"), e.push("        if (entry.failureMode === 'network-error') {"), e.push("          req.reply({ forceNetworkError: true, delay: entry.delayMs });"), e.push("          return;"), e.push("        }"), e.push(""), e.push("        if (entry.failureMode === 'http-error') {"), e.push("          req.reply({"), e.push("            statusCode: entry.statusCode ?? 503,"), e.push("            delay: entry.delayMs,"), e.push("            headers: { 'x-ui-chaos': 'true' },"), e.push(
    "            body: { error: 'Injected by ui-chaos', url: entry.url, method: entry.method }"
  ), e.push("          });"), e.push("          return;"), e.push("        }"), e.push(""), e.push("        req.continue((res) => {"), e.push("          if (entry.delayMs > 0) {"), e.push("            res.setDelay(entry.delayMs);"), e.push("          }"), e.push("        });"), e.push("      });"), e.push("    });"), e.push(""), e;
}
function q(r) {
  return r.replace(/(\.spec\.ts|\.cy\.ts|\.ts)$/i, "");
}
function E() {
  var r;
  return typeof window < "u" && ((r = window.location) != null && r.href) ? window.location.href : F;
}
function u(r) {
  return JSON.stringify(r);
}
function X() {
  return typeof window < "u" && typeof document < "u";
}
const B = 'button, input, select, textarea, a[href], [role="button"], [tabindex]:not([tabindex="-1"])', V = "[data-chaos-ignore], [data-ui-chaos-ignore]", G = 6;
class J {
  constructor(e, t, s, n) {
    i(this, "intervalId", null);
    i(this, "actionCounter", 0);
    this.target = e, this.intervalMs = t, this.recorder = s, this.options = n;
  }
  get isRunning() {
    return this.intervalId !== null;
  }
  start() {
    return this.intervalId !== null ? !1 : (this.intervalId = window.setInterval(() => {
      this.runOnce();
    }, this.intervalMs), this.log("Monkey started."), !0);
  }
  stop() {
    this.intervalId !== null && (window.clearInterval(this.intervalId), this.intervalId = null, this.log("Monkey stopped."));
  }
  runOnce() {
    const e = this.getInteractables();
    if (e.length === 0)
      return null;
    const t = e[this.randomIndex(e.length)], s = this.pickActionType(t), n = this.buildAction(t, s);
    try {
      return this.performAction(t, n), this.recorder.record(n), n;
    } catch {
      return null;
    }
  }
  getInteractables() {
    const e = Array.from(
      this.target.querySelectorAll(this.options.interactionSelector)
    );
    return this.matchesSelector(this.target, this.options.interactionSelector) && e.unshift(this.target), e.filter((t) => this.isEligibleElement(t));
  }
  isEligibleElement(e) {
    if (!e || !e.isConnected || this.options.excludeSelector && (this.matchesSelector(e, this.options.excludeSelector) || this.hasMatchingAncestor(e, this.options.excludeSelector)) || this.readBooleanProperty(e, "disabled") || e.getAttribute("aria-disabled") === "true")
      return !1;
    const s = this.readStringProperty(e, "type").toLowerCase();
    if (s === "hidden" || s && s !== "checkbox" && s !== "radio" && this.readBooleanProperty(e, "readOnly"))
      return !1;
    const n = typeof window.getComputedStyle == "function" ? window.getComputedStyle(e) : null;
    if (n && (n.display === "none" || n.visibility === "hidden" || n.pointerEvents === "none"))
      return !1;
    if (typeof e.getBoundingClientRect == "function") {
      const o = e.getBoundingClientRect();
      if (o.width <= 0 || o.height <= 0)
        return !1;
    }
    return !0;
  }
  pickActionType(e) {
    const t = ["click", "dblclick"], s = e.tagName.toLowerCase();
    return this.isTextLikeInput(e) && t.push("type"), s === "select" && this.hasSelectableOptions(e) && t.push("select"), this.isScrollable(e) && t.push("scroll"), t[this.randomIndex(t.length)];
  }
  buildAction(e, t) {
    const s = this.getElementCenter(e), n = e.tagName.toLowerCase(), o = {
      id: ++this.actionCounter,
      type: t,
      selector: this.generateSelector(e),
      timestamp: Date.now(),
      tagName: n,
      text: this.readElementText(e),
      x: s == null ? void 0 : s.x,
      y: s == null ? void 0 : s.y
    };
    return t === "type" && (o.value = this.generateInputValue(e)), t === "select" && (o.optionValue = this.pickOptionValue(e)), t === "scroll" && (o.scrollTop = this.pickScrollTop(e)), o;
  }
  performAction(e, t) {
    switch (t.type) {
      case "click":
        typeof e.click == "function" ? e.click() : e.dispatchEvent(new MouseEvent("click", { bubbles: !0, cancelable: !0 }));
        break;
      case "dblclick":
        e.dispatchEvent(new MouseEvent("dblclick", { bubbles: !0, cancelable: !0 }));
        break;
      case "type":
        this.applyInputValue(e, t.value ?? "");
        break;
      case "select":
        this.applySelectValue(e, t.optionValue ?? "");
        break;
      case "scroll":
        this.applyScroll(e, t.scrollTop ?? 0);
        break;
    }
  }
  applyInputValue(e, t) {
    this.writeProperty(e, "value", t), e.dispatchEvent(new Event("input", { bubbles: !0 })), e.dispatchEvent(new Event("change", { bubbles: !0 }));
  }
  applySelectValue(e, t) {
    this.writeProperty(e, "value", t), e.dispatchEvent(new Event("input", { bubbles: !0 })), e.dispatchEvent(new Event("change", { bubbles: !0 }));
  }
  applyScroll(e, t) {
    this.writeProperty(e, "scrollTop", t), e.dispatchEvent(new Event("scroll", { bubbles: !0 }));
  }
  isTextLikeInput(e) {
    const t = e.tagName.toLowerCase();
    if (t === "textarea")
      return !0;
    if (t !== "input")
      return !1;
    const s = this.readStringProperty(e, "type").toLowerCase();
    return s === "" || s === "text" || s === "search" || s === "email" || s === "password" || s === "tel" || s === "url" || s === "number";
  }
  hasSelectableOptions(e) {
    return this.readArrayProperty(e, "options").some((s) => !(s != null && s.disabled) && typeof (s == null ? void 0 : s.value) == "string");
  }
  pickOptionValue(e) {
    var s;
    const t = this.readArrayProperty(e, "options").filter((n) => !(n != null && n.disabled) && typeof (n == null ? void 0 : n.value) == "string");
    return t.length === 0 ? "" : ((s = t[this.randomIndex(t.length)]) == null ? void 0 : s.value) ?? "";
  }
  isScrollable(e) {
    const t = this.readNumberProperty(e, "scrollHeight"), s = this.readNumberProperty(e, "clientHeight");
    return t > s && s > 0;
  }
  pickScrollTop(e) {
    const t = this.readNumberProperty(e, "scrollHeight"), s = this.readNumberProperty(e, "clientHeight"), n = Math.max(0, t - s);
    return n === 0 ? 0 : Math.floor(this.options.random.next() * (n + 1));
  }
  generateInputValue(e) {
    const t = this.readStringProperty(e, "type").toLowerCase();
    if (t === "number")
      return String(Math.floor(this.options.random.next() * 1e4));
    if (t === "email")
      return `chaos-${Math.floor(this.options.random.next() * 1e4)}@example.test`;
    if (t === "tel")
      return `${Math.floor(1e8 + this.options.random.next() * 9e8)}`;
    if (t === "url")
      return `https://chaos.test/${Math.floor(this.options.random.next() * 1e4)}`;
    const s = "abcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: G }, () => s[this.randomIndex(s.length)]).join("");
  }
  generateSelector(e) {
    const t = this.getStableSelector(e);
    if (t)
      return t;
    const s = [];
    let n = e;
    for (; n && n.nodeType === Node.ELEMENT_NODE; ) {
      const o = this.getStableSelector(n);
      if (o) {
        s.unshift(o);
        break;
      }
      let c = n.tagName.toLowerCase(), l = n.previousElementSibling, d = 1;
      for (; l; )
        l.tagName.toLowerCase() === c && (d += 1), l = l.previousElementSibling;
      if (c += `:nth-of-type(${d})`, s.unshift(c), n = n.parentElement, n === this.target.parentElement)
        break;
    }
    return s.join(" > ") || e.tagName.toLowerCase();
  }
  getStableSelector(e) {
    if (e.id)
      return `#${this.escapeCssIdentifier(e.id)}`;
    const t = e.getAttribute("data-testid");
    if (t)
      return `[data-testid="${this.escapeCssAttribute(t)}"]`;
    const s = e.getAttribute("name");
    if (s)
      return `${e.tagName.toLowerCase()}[name="${this.escapeCssAttribute(s)}"]`;
    const n = e.getAttribute("aria-label");
    return n ? `${e.tagName.toLowerCase()}[aria-label="${this.escapeCssAttribute(n)}"]` : null;
  }
  escapeCssIdentifier(e) {
    return typeof CSS < "u" && typeof CSS.escape == "function" ? CSS.escape(e) : e.replace(/[^a-zA-Z0-9_-]/g, (t) => `\\${t}`);
  }
  escapeCssAttribute(e) {
    return e.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  getElementCenter(e) {
    if (typeof e.getBoundingClientRect != "function")
      return null;
    const t = e.getBoundingClientRect();
    return {
      x: t.left + t.width / 2,
      y: t.top + t.height / 2
    };
  }
  readElementText(e) {
    return (typeof e.textContent == "string" ? e.textContent.trim() : "") || void 0;
  }
  randomIndex(e) {
    return Math.floor(this.options.random.next() * e);
  }
  matchesSelector(e, t) {
    return !t || typeof e.matches != "function" ? !1 : e.matches(t);
  }
  hasMatchingAncestor(e, t) {
    let s = e.parentElement;
    for (; s; ) {
      if (this.matchesSelector(s, t))
        return !0;
      if (s === this.target.parentElement)
        break;
      s = s.parentElement;
    }
    return !1;
  }
  log(e) {
    this.options.log && console.log(`[ui-chaos] ${e}`);
  }
  readBooleanProperty(e, t) {
    return !!e[t];
  }
  readStringProperty(e, t) {
    const s = e[t];
    return typeof s == "string" ? s : "";
  }
  readNumberProperty(e, t) {
    const s = e[t];
    return typeof s == "number" ? s : 0;
  }
  readArrayProperty(e, t) {
    const s = e[t];
    return s ? Array.from(s) : [];
  }
  writeProperty(e, t, s) {
    e[t] = s;
  }
}
const _ = [500, 502, 503, 504], a = {
  managers: [],
  originalFetch: null,
  originalXhr: null,
  fetchInstalled: !1,
  xhrInstalled: !1
};
class Z {
  constructor(e) {
    i(this, "active", !1);
    i(this, "nextEventId", 0);
    this.options = e, K(this);
  }
  get isEnabled() {
    return this.options.config.enabled;
  }
  get isRunning() {
    return this.active;
  }
  start() {
    return !this.isEnabled || this.active ? !1 : (this.active = !0, this.log("Network chaos started."), !0);
  }
  stop() {
    this.active && (this.active = !1, this.log("Network chaos stopped."));
  }
  destroy() {
    this.stop(), Q(this);
  }
  getHistory() {
    return this.options.recorder.getHistory();
  }
  supportsTransport(e) {
    return e === "fetch" ? this.options.config.interceptFetch : this.options.config.interceptXhr;
  }
  canHandleRequest(e, t, s) {
    if (!this.active || !this.supportsTransport(s))
      return !1;
    const n = y(t);
    return oe(n, this.options.config.methods) && ae(e, this.options.config.includeUrls, this.options.config.excludeUrls);
  }
  planRequest(e, t, s) {
    if (!this.canHandleRequest(e, t, s))
      return null;
    const n = y(t), o = w(
      this.options.random,
      this.options.config.minDelayMs,
      this.options.config.maxDelayMs
    ), l = this.options.config.failureRate > 0 && this.options.random.next() < this.options.config.failureRate ? le(this.options.random, this.options.config.failureMode) : void 0;
    if (o <= 0 && !l)
      return null;
    const d = l === "http-error" ? he(this.options.random, this.options.config.statusCodes) : void 0, f = {
      id: ++this.nextEventId,
      timestamp: Date.now(),
      transport: s,
      url: e,
      method: n,
      delayMs: o,
      failureMode: l,
      statusCode: d
    };
    return this.options.recorder.record(f), this.log(
      `Network chaos injected for ${s.toUpperCase()} ${n} ${e}${o > 0 ? ` with ${o}ms delay` : ""}${l ? ` and ${l}` : ""}.`
    ), { event: f };
  }
  log(e) {
    this.options.log && console.log(`[ui-chaos] ${e}`);
  }
}
function K(r) {
  a.managers.push(r), T(), M();
}
function Q(r) {
  a.managers = a.managers.filter(
    (e) => e !== r
  ), T(), M();
}
function T() {
  if (N("fetch")) {
    W();
    return;
  }
  Y();
}
function M() {
  if (N("xhr")) {
    ee();
    return;
  }
  te();
}
function N(r) {
  return a.managers.some((e) => e.supportsTransport(r));
}
function W() {
  if (a.fetchInstalled || typeof window > "u" || typeof window.fetch != "function")
    return;
  a.originalFetch = window.fetch;
  const r = async (e, t) => re(e, t);
  window.fetch = r, globalThis.fetch = r, a.fetchInstalled = !0;
}
function Y() {
  !a.fetchInstalled || !a.originalFetch || (window.fetch = a.originalFetch, globalThis.fetch = a.originalFetch, a.fetchInstalled = !1, a.originalFetch = null);
}
function ee() {
  if (a.xhrInstalled || typeof window > "u" || typeof window.XMLHttpRequest != "function")
    return;
  a.originalXhr = window.XMLHttpRequest;
  const r = a.originalXhr;
  function e() {
    return new m(r);
  }
  const t = e;
  Object.assign(t, {
    UNSENT: 0,
    OPENED: 1,
    HEADERS_RECEIVED: 2,
    LOADING: 3,
    DONE: 4
  }), window.XMLHttpRequest = t, globalThis.XMLHttpRequest = t, a.xhrInstalled = !0;
}
function te() {
  !a.xhrInstalled || !a.originalXhr || (window.XMLHttpRequest = a.originalXhr, globalThis.XMLHttpRequest = a.originalXhr, a.xhrInstalled = !1, a.originalXhr = null);
}
async function re(r, e) {
  if (!a.originalFetch)
    throw new Error("[ui-chaos] fetch is unavailable in this runtime.");
  const t = ne(r, e), s = R(t.url, t.method, "fetch");
  if (!s)
    return S(r, e);
  if (s.event.delayMs > 0 && await $(s.event.delayMs), s.event.failureMode === "network-error")
    throw new TypeError(
      `[ui-chaos] Injected network error for ${s.event.method} ${s.event.url}`
    );
  return s.event.failureMode === "http-error" ? ie(s.event) : S(r, e);
}
function R(r, e, t) {
  const s = [...a.managers].reverse().find((n) => n.canHandleRequest(r, e, t));
  return s ? s.planRequest(r, e, t) : null;
}
function S(r, e) {
  if (!a.originalFetch)
    throw new Error("[ui-chaos] fetch is unavailable in this runtime.");
  return a.originalFetch.call(window, r, e);
}
const h = class h {
  constructor(e) {
    i(this, "upload", null);
    i(this, "onreadystatechange", null);
    i(this, "onload", null);
    i(this, "onerror", null);
    i(this, "onabort", null);
    i(this, "ontimeout", null);
    i(this, "onloadend", null);
    i(this, "onloadstart", null);
    i(this, "onprogress", null);
    i(this, "readyState", h.UNSENT);
    i(this, "response", null);
    i(this, "responseText", "");
    i(this, "responseType", "");
    i(this, "responseURL", "");
    i(this, "responseXML", null);
    i(this, "status", 0);
    i(this, "statusText", "");
    i(this, "timeout", 0);
    i(this, "withCredentials", !1);
    i(this, "nativeXhr", null);
    i(this, "openArgs", null);
    i(this, "listeners", /* @__PURE__ */ new Map());
    i(this, "requestHeaders", /* @__PURE__ */ new Map());
    i(this, "responseHeaders", /* @__PURE__ */ new Map());
    i(this, "aborted", !1);
    this.NativeXhr = e;
  }
  open(e, t, s, n, o) {
    this.openArgs = [e, t, s, n, o], this.readyState = h.OPENED, this.responseURL = p(t), this.dispatchLocalEvent("readystatechange");
  }
  setRequestHeader(e, t) {
    var s;
    this.requestHeaders.set(e, t), (s = this.nativeXhr) == null || s.setRequestHeader(e, t);
  }
  send(e) {
    const [t, s] = this.openArgs ?? ["GET", "", !0, void 0, void 0], n = p(s), o = R(n, t, "xhr");
    if (!o) {
      this.performNativeSend(e);
      return;
    }
    $(o.event.delayMs).then(() => {
      if (!this.aborted) {
        if (o.event.failureMode === "network-error") {
          this.simulateNetworkError();
          return;
        }
        if (o.event.failureMode === "http-error") {
          this.simulateHttpError(o.event.statusCode ?? 503);
          return;
        }
        this.performNativeSend(e);
      }
    });
  }
  abort() {
    var e;
    this.aborted = !0, (e = this.nativeXhr) == null || e.abort(), this.dispatchLocalEvent("abort"), this.dispatchLocalEvent("loadend");
  }
  addEventListener(e, t) {
    var s;
    this.listeners.has(e) || this.listeners.set(e, /* @__PURE__ */ new Set()), (s = this.listeners.get(e)) == null || s.add(t);
  }
  removeEventListener(e, t) {
    var s;
    (s = this.listeners.get(e)) == null || s.delete(t);
  }
  dispatchEvent(e) {
    return this.dispatchLocalEvent(e.type, e), !0;
  }
  getAllResponseHeaders() {
    return this.nativeXhr ? this.nativeXhr.getAllResponseHeaders() : Array.from(this.responseHeaders.entries()).map(([e, t]) => `${e}: ${t}`).join(`\r
`);
  }
  getResponseHeader(e) {
    return this.nativeXhr ? this.nativeXhr.getResponseHeader(e) : this.responseHeaders.get(e.toLowerCase()) ?? null;
  }
  overrideMimeType(e) {
    var t;
    (t = this.nativeXhr) == null || t.overrideMimeType(e);
  }
  performNativeSend(e) {
    const [t, s, n, o, c] = this.openArgs ?? ["GET", "", !0, void 0, void 0], l = new this.NativeXhr();
    this.nativeXhr = l, l.responseType = this.responseType, l.timeout = this.timeout, l.withCredentials = this.withCredentials, se(this, l), l.open(t, s, n ?? !0, o, c);
    for (const [d, f] of this.requestHeaders.entries())
      l.setRequestHeader(d, f);
    l.send(e ?? null);
  }
  simulateNetworkError() {
    this.readyState = h.DONE, this.status = 0, this.statusText = "", this.response = null, this.responseText = "", this.dispatchLocalEvent("readystatechange"), this.dispatchLocalEvent("error"), this.dispatchLocalEvent("loadend");
  }
  simulateHttpError(e) {
    const t = {
      error: "Injected by ui-chaos",
      url: this.responseURL,
      status: e
    };
    this.readyState = h.DONE, this.status = e, this.statusText = `Injected ${e}`, this.responseHeaders.set("content-type", "application/json"), this.responseHeaders.set("x-ui-chaos", "true"), this.responseText = JSON.stringify(t), this.response = this.responseType === "json" ? t : this.responseType === "" || this.responseType === "text" ? this.responseText : null, this.dispatchLocalEvent("readystatechange"), this.dispatchLocalEvent("load"), this.dispatchLocalEvent("loadend");
  }
  dispatchLocalEvent(e, t) {
    const s = t ?? ce(e), n = this.listeners.get(e);
    for (const c of n ?? [])
      c.call(this, s);
    const o = this.getHandler(e);
    typeof o == "function" && o.call(this, s);
  }
  getHandler(e) {
    const t = `on${e}`;
    return this[t];
  }
  syncFromNative(e) {
    this.readyState = e.readyState, this.response = e.response, this.responseType = e.responseType, this.responseURL = e.responseURL, this.status = e.status, this.statusText = e.statusText, this.timeout = e.timeout, this.withCredentials = e.withCredentials;
    try {
      this.responseText = e.responseText;
    } catch {
      this.responseText = "";
    }
  }
};
i(h, "UNSENT", 0), i(h, "OPENED", 1), i(h, "HEADERS_RECEIVED", 2), i(h, "LOADING", 3), i(h, "DONE", 4);
let m = h;
function se(r, e) {
  const t = [
    "readystatechange",
    "loadstart",
    "progress",
    "abort",
    "error",
    "load",
    "timeout",
    "loadend"
  ];
  for (const s of t)
    e.addEventListener(s, (n) => {
      r.syncFromNative(e), r.dispatchEvent(n);
    });
}
function ne(r, e) {
  if (typeof r == "string" || r instanceof URL)
    return {
      url: p(String(r)),
      method: y(g(e, "method") ?? "GET")
    };
  if (r && typeof r == "object") {
    const t = g(r, "url") ?? "", s = g(e, "method") ?? g(r, "method") ?? "GET";
    return {
      url: p(String(t)),
      method: y(String(s))
    };
  }
  return {
    url: p(""),
    method: "GET"
  };
}
function ie(r) {
  const e = JSON.stringify({
    error: "Injected by ui-chaos",
    url: r.url,
    method: r.method,
    status: r.statusCode ?? 503
  });
  return typeof Response < "u" ? new Response(e, {
    status: r.statusCode ?? 503,
    headers: {
      "content-type": "application/json",
      "x-ui-chaos": "true"
    }
  }) : {
    ok: !1,
    status: r.statusCode ?? 503,
    url: r.url,
    headers: {
      get(t) {
        const s = t.toLowerCase();
        return s === "content-type" ? "application/json" : s === "x-ui-chaos" ? "true" : null;
      }
    },
    text: async () => e,
    json: async () => JSON.parse(e)
  };
}
function oe(r, e) {
  return e.length === 0 ? !0 : e.includes(r);
}
function ae(r, e, t) {
  return t.some((s) => k(r, s)) ? !1 : e.length === 0 ? !0 : e.some((s) => k(r, s));
}
function k(r, e) {
  return e ? e.includes("*") ? new RegExp(
    `^${e.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`
  ).test(r) : r.includes(e) : !1;
}
function le(r, e) {
  return e[w(r, 0, e.length - 1)] ?? "network-error";
}
function he(r, e) {
  return e[w(r, 0, e.length - 1)] ?? 503;
}
function w(r, e, t) {
  const s = Math.min(e, t), n = Math.max(e, t);
  return s === n ? s : Math.floor(r.next() * (n - s + 1)) + s;
}
function y(r) {
  return r.toUpperCase();
}
function p(r) {
  var t;
  const e = typeof window < "u" && ((t = window.location) != null && t.href) ? window.location.href : "http://localhost:3000/";
  try {
    return new URL(r, e).toString();
  } catch {
    return r;
  }
}
function ce(r) {
  return typeof Event < "u" ? new Event(r) : { type: r };
}
function g(r, e) {
  if (!r || typeof r != "object")
    return;
  const t = r[e];
  return typeof t == "string" ? t : void 0;
}
async function $(r) {
  r <= 0 || await new Promise((e) => {
    setTimeout(e, r);
  });
}
function ue(r, e) {
  const t = Math.max(0, (r == null ? void 0 : r.minDelayMs) ?? 0), s = Math.max(t, (r == null ? void 0 : r.maxDelayMs) ?? t);
  return {
    enabled: (r == null ? void 0 : r.enabled) ?? !1,
    historySize: Math.max(1, (r == null ? void 0 : r.historySize) ?? e),
    minDelayMs: t,
    maxDelayMs: s,
    failureRate: ge((r == null ? void 0 : r.failureRate) ?? 0, 0, 1),
    failureMode: de(r == null ? void 0 : r.failureMode),
    statusCodes: pe(r == null ? void 0 : r.statusCodes),
    methods: fe(r == null ? void 0 : r.methods),
    includeUrls: (r == null ? void 0 : r.includeUrls) ?? [],
    excludeUrls: (r == null ? void 0 : r.excludeUrls) ?? [],
    interceptFetch: (r == null ? void 0 : r.interceptFetch) ?? !0,
    interceptXhr: (r == null ? void 0 : r.interceptXhr) ?? !0
  };
}
function de(r) {
  return r ? Array.isArray(r) ? r : [r] : ["network-error"];
}
function pe(r) {
  return !r || r.length === 0 ? [..._] : r.filter((e) => Number.isFinite(e) && e >= 400);
}
function fe(r) {
  return (r == null ? void 0 : r.map((e) => e.toUpperCase())) ?? [];
}
function ge(r, e, t) {
  return Math.min(t, Math.max(e, r));
}
class ye {
  constructor(e = 50) {
    i(this, "events", []);
    this.maxSize = e;
  }
  record(e) {
    this.events.push(e), this.events.length > this.maxSize && this.events.shift();
  }
  getHistory() {
    return [...this.events];
  }
  clear() {
    this.events = [];
  }
}
function me(r) {
  if (typeof r != "number" || !Number.isFinite(r))
    return {
      next: () => Math.random()
    };
  let e = we(r);
  return {
    next: () => {
      e += 1831565813;
      let t = e;
      return t = Math.imul(t ^ t >>> 15, t | 1), t ^= t + Math.imul(t ^ t >>> 7, t | 61), ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  };
}
function we(r) {
  const e = Math.floor(r) >>> 0;
  return e === 0 ? 1 : e;
}
class be {
  constructor(e = 50) {
    i(this, "actions", []);
    this.maxSize = e;
  }
  record(e) {
    this.actions.push(e), this.actions.length > this.maxSize && this.actions.shift();
  }
  getHistory() {
    return [...this.actions];
  }
  clear() {
    this.actions = [];
  }
}
class ve {
  constructor(e = {}) {
    i(this, "enabled");
    i(this, "recorder");
    i(this, "networkRecorder");
    i(this, "monkey");
    i(this, "detector");
    i(this, "network");
    i(this, "startedAt");
    i(this, "url");
    i(this, "userAgent");
    i(this, "options");
    i(this, "crash");
    i(this, "destroyed", !1);
    if (this.options = {
      intervalMs: e.intervalMs ?? 100,
      historySize: e.historySize ?? 50,
      autoStart: e.autoStart ?? !0,
      enabled: e.enabled ?? !1,
      log: e.log ?? !0,
      enableMonkey: e.enableMonkey ?? !0,
      interactionSelector: e.interactionSelector ?? B,
      excludeSelector: e.excludeSelector ?? V,
      exportFormat: e.exportFormat ?? "playwright",
      downloadOnCrash: e.downloadOnCrash ?? !1,
      detectTargetRemoval: e.detectTargetRemoval ?? !0,
      detectEmptyTarget: e.detectEmptyTarget ?? !1,
      baseFileName: e.baseFileName,
      onCrash: e.onCrash,
      seed: e.seed
    }, this.startedAt = Date.now(), this.url = e.initialUrl ?? Se(), this.userAgent = ke(), !this.options.enabled) {
      this.enabled = !1, this.recorder = null, this.networkRecorder = null, this.monkey = null, this.detector = null, this.network = null;
      return;
    }
    if (!Ee()) {
      this.enabled = !1, this.recorder = null, this.networkRecorder = null, this.monkey = null, this.detector = null, this.network = null, this.log("Skipping initialization because no browser runtime is available.");
      return;
    }
    const t = e.target ?? document.body;
    if (!t) {
      this.enabled = !1, this.recorder = null, this.networkRecorder = null, this.monkey = null, this.detector = null, this.network = null, this.log("Skipping initialization because no target element was provided.");
      return;
    }
    const s = me(e.seed), n = ue(
      e.network,
      this.options.historySize
    );
    this.enabled = !0, this.recorder = new be(this.options.historySize), this.networkRecorder = new ye(n.historySize), this.monkey = this.options.enableMonkey ? new J(t, this.options.intervalMs, this.recorder, {
      interactionSelector: this.options.interactionSelector,
      excludeSelector: this.options.excludeSelector,
      log: this.options.log,
      random: s
    }) : null, this.network = n.enabled ? new Z({
      config: n,
      log: this.options.log,
      random: s,
      recorder: this.networkRecorder
    }) : null, this.detector = new L({
      target: t,
      detectTargetRemoval: this.options.detectTargetRemoval,
      detectEmptyTarget: this.options.detectEmptyTarget,
      onCrash: (o) => this.handleCrash(o)
    }), this.detector.start(), this.options.autoStart && this.start();
  }
  get isEnabled() {
    return this.enabled && !this.destroyed;
  }
  get isRunning() {
    var e, t;
    return !!((e = this.monkey) != null && e.isRunning || (t = this.network) != null && t.isRunning);
  }
  start() {
    var s, n;
    if (!this.isEnabled)
      return !1;
    const e = ((s = this.monkey) == null ? void 0 : s.start()) ?? !1, t = ((n = this.network) == null ? void 0 : n.start()) ?? !1;
    return e || t;
  }
  stop() {
    var e, t;
    (e = this.monkey) == null || e.stop(), (t = this.network) == null || t.stop();
  }
  destroy() {
    var e, t;
    this.destroyed || (this.stop(), (e = this.detector) == null || e.stop(), (t = this.network) == null || t.destroy(), this.destroyed = !0, this.log("Controller destroyed."));
  }
  runOnce() {
    return !this.isEnabled || !this.monkey ? null : this.monkey.runOnce();
  }
  getHistory() {
    var e;
    return ((e = this.recorder) == null ? void 0 : e.getHistory()) ?? [];
  }
  getNetworkHistory() {
    var e;
    return ((e = this.networkRecorder) == null ? void 0 : e.getHistory()) ?? [];
  }
  getScenario() {
    var e;
    return {
      url: this.url,
      startedAt: this.startedAt,
      endedAt: ((e = this.crash) == null ? void 0 : e.timestamp) ?? Date.now(),
      userAgent: this.userAgent,
      seed: this.options.seed,
      actions: this.getHistory(),
      network: this.getNetworkHistory(),
      crash: this.crash
    };
  }
  exportScenario(e = this.options.exportFormat) {
    return H(this.getScenario(), e);
  }
  downloadScenario(e = this.options.exportFormat) {
    var s;
    const t = xe(
      this.options.baseFileName ?? "ui-chaos-crash",
      ((s = this.crash) == null ? void 0 : s.timestamp) ?? Date.now()
    );
    return D(this.exportScenario(e), {
      baseFileName: t
    });
  }
  reportCrash(e, t = "manual") {
    this.handleCrash({
      kind: t,
      reason: e,
      timestamp: Date.now()
    });
  }
  handleCrash(e) {
    var s;
    if (this.destroyed || this.crash)
      return;
    this.crash = {
      kind: e.kind,
      reason: e.reason,
      timestamp: e.timestamp
    }, this.stop(), (s = this.detector) == null || s.stop(), this.log(`Crash detected: ${e.kind} - ${e.reason}`);
    const t = this.exportScenario(this.options.exportFormat);
    if (this.options.downloadOnCrash && this.downloadScenario(this.options.exportFormat), typeof this.options.onCrash == "function") {
      const n = {
        reason: e.reason,
        kind: e.kind,
        scenario: this.getScenario(),
        exports: t
      };
      try {
        this.options.onCrash(n);
      } catch (o) {
        const c = o instanceof Error ? o.message : "Unknown error while running onCrash callback.";
        this.log(`onCrash callback failed: ${c}`);
      }
    }
  }
  log(e) {
    this.options.log && console.log(`[ui-chaos] ${e}`);
  }
}
function Ee() {
  return typeof window < "u" && typeof document < "u";
}
function Se() {
  var r;
  return typeof window < "u" && ((r = window.location) != null && r.href) ? window.location.href : "http://localhost:3000/";
}
function ke() {
  var r;
  if (typeof window < "u" && ((r = window.navigator) != null && r.userAgent))
    return window.navigator.userAgent;
  if (typeof navigator < "u" && navigator.userAgent)
    return navigator.userAgent;
}
function xe(r, e) {
  const t = new Date(e).toISOString().replace(/[:.]/g, "-");
  return `${r}-${t}`;
}
function Te(r = {}) {
  return new ve(r);
}
export {
  be as ActionRecorder,
  J as ChaosMonkey,
  L as CrashDetector,
  V as DEFAULT_EXCLUDE_SELECTOR,
  B as DEFAULT_INTERACTION_SELECTOR,
  Z as NetworkChaosManager,
  ye as NetworkRecorder,
  ve as UiChaosController,
  me as createRandomSource,
  D as downloadExportBundle,
  U as downloadTextFile,
  v as generateCypressTest,
  b as generatePlaywrightTest,
  H as generateScenarioExports,
  Te as initChaos,
  ue as normalizeNetworkChaosOptions
};
//# sourceMappingURL=index.js.map
