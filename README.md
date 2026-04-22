# ui-chaos

`ui-chaos` is a frontend chaos-engineering library for staging and test environments. It stress-clicks your UI, fuzzes inputs, injects API latency and failures, and records the exact scenario that led to a crash. When something breaks, it can export a ready-to-run Playwright or Cypress reproduction file.

## Why teams use it

- Catch fragile button handlers, race conditions, broken loading states, and slow-network regressions before production users do.
- Reproduce flaky UI crashes with generated Playwright or Cypress tests instead of guesswork.
- Run it only in staging, preview, QA, or internal builds.

## Install

```bash
npm install ui-chaos
```

## Quick Start

```ts
import { initChaos } from 'ui-chaos';

const chaos = initChaos({
  enabled: import.meta.env.MODE === 'staging',
  target: document.getElementById('app-root'),
  intervalMs: 80,
  historySize: 75,
  seed: 42,
  exportFormat: 'playwright',
  detectEmptyTarget: true,
  network: {
    enabled: true,
    minDelayMs: 500,
    maxDelayMs: 2000,
    failureRate: 0.2,
    failureMode: ['network-error', 'http-error'],
    includeUrls: ['/api/', '/graphql'],
    excludeUrls: ['/api/health'],
    statusCodes: [500, 503, 504]
  }
});
```

The returned controller exposes:

- `start()`
- `stop()`
- `destroy()`
- `runOnce()`
- `getHistory()`
- `getNetworkHistory()`
- `getScenario()`
- `exportScenario(format?)`
- `downloadScenario(format?)`
- `reportCrash(reason, kind?)`

## Scenario Recording

When `ui-chaos` detects a crash, it stops the monkey, captures both UI and network chaos history, and generates repro files in the format you choose:

```ts
import { initChaos } from 'ui-chaos';

initChaos({
  enabled: import.meta.env.MODE === 'staging',
  exportFormat: 'both',
  downloadOnCrash: false,
  network: {
    enabled: true,
    minDelayMs: 1000,
    maxDelayMs: 5000,
    failureRate: 0.15,
    includeUrls: ['/api/']
  },
  onCrash(event) {
    console.log(event.reason);
    console.log(event.scenario.actions);
    console.log(event.scenario.network);
    console.log(event.exports.playwright);
    console.log(event.exports.cypress);
  }
});
```

## Network Chaos

Use the `network` option to slow down or fail matching requests:

```ts
initChaos({
  enabled: import.meta.env.MODE === 'staging',
  enableMonkey: false,
  network: {
    enabled: true,
    minDelayMs: 10000,
    maxDelayMs: 10000,
    failureRate: 0.3,
    failureMode: 'http-error',
    statusCodes: [503],
    methods: ['GET', 'POST'],
    includeUrls: ['/api/orders', '/graphql'],
    interceptFetch: true,
    interceptXhr: true
  }
});
```

Supported behaviors:

- Request delay injection with `minDelayMs` and `maxDelayMs`
- Random network failures with `failureMode: 'network-error'`
- Random HTTP failures with `failureMode: 'http-error'`
- URL and method targeting
- `fetch` and `XMLHttpRequest` interception

## Recommended Production Usage

Keep `ui-chaos` behind a staging or preview flag:

```ts
const chaos = initChaos({
  enabled: import.meta.env.MODE === 'staging' || import.meta.env.VITE_UI_CHAOS === 'true',
  log: true,
  seed: 1234,
  detectTargetRemoval: true,
  detectEmptyTarget: false,
  network: {
    enabled: true,
    minDelayMs: 250,
    maxDelayMs: 1500,
    failureRate: 0.1,
    includeUrls: ['/api/']
  }
});
```

Use `detectEmptyTarget: true` only when an empty root actually indicates a crash in your app. It is disabled by default to avoid false positives.

Set `seed` when you want deterministic chaos decisions across runs. The exported scenario also includes the seed for easier replay.

## Opting Elements Out

Add either attribute below to skip a control:

```html
<button data-chaos-ignore>Do Not Click</button>
<input data-ui-chaos-ignore />
```

You can also override discovery with custom selectors:

```ts
initChaos({
  interactionSelector: 'button, input, [data-chaos-target]',
  excludeSelector: '[data-chaos-ignore], .no-monkey-zone'
});
```

## Manual Crash Reporting

If your framework catches errors in an error boundary, you can still export the scenario explicitly:

```ts
const chaos = initChaos({
  enabled: true,
  downloadOnCrash: false
});

try {
  // app code
} catch (error) {
  chaos.reportCrash(error instanceof Error ? error.message : 'Unknown crash');
}
```

## Development

```bash
npm run build
npm test
```
