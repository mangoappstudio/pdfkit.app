# Offline PWA

The app uses Next's manifest convention, PNG installation icons and a small
service worker generated after **both** production builds. No PWA dependency or
processing endpoint is needed. The design follows the installed Next.js 16.2.4
PWA/static-export guides and the service-worker install/activate lifecycle:

- https://nextjs.org/docs/app/guides/progressive-web-apps
- https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

`scripts/build-offline.mjs` discovers every app page and all emitted static chunks,
including dynamically imported PDF.js, html2canvas and encryption code. It adds
the PDF.js worker, manifest and installation icons explicitly. The resource list,
worker code, HTML and public asset contents identify a versioned cache. Node
serves the generated `public/sw.js`; static export copies the final worker into
`out/sw.js`. Self-hosters must run `yarn build`, not just `next build`, and deploy
`public` alongside `.next`. Deploy the full build atomically. HTTPS is required
outside localhost. Both hosts return no-store headers for worker update checks.

Installation downloads in bounded batches with omitted credentials. A completion
marker is written only after every successful response has been cached. Any
fetch, redirect, HTTP or storage failure rejects installation and removes that
partial version; the active version remains untouched. The UI asks the controlling
worker to verify the marker and all cache keys before announcing readiness. A
failed registration or installation leaves online functionality available and
provides a retry; reconnection also retries.

Runtime caching is read-only. Only listed same-origin GET assets and known page
navigations are served from cache; PDF.js HEAD preflight is synthesized with no
body from its cached GET. Query-bearing assets, unknown paths, external resources,
blob URLs and writes never enter the cache. Navigation queries can read a known
page but are never persisted. The completion marker contains only the build ID.
No document data is put into Cache Storage, IndexedDB or localStorage.

Navigation uses full cached documents once a worker controls the app. This avoids
Next's router-state-dependent RSC/prefetch variants and mixing versions; RSC
requests receive a network error so Next can fall back to document navigation.
The tradeoff is a full page transition between tools (save work before leaving,
as with existing tool navigation). Pages and immutable app chunks use cache-first
responses, so an active session stays on its complete version. There is no
`skipWaiting` or forced reload. New workers wait until all app clients close;
activation then removes old app caches. Other origin caches are untouched.

Browser-managed storage can be evicted; readiness checks detect missing entries,
but a complete offline install cannot be guaranteed permanently. If retry cannot
restore a partially evicted active version, clear the site's storage and prepare
again online. Initial preparation downloads every tool's code and uses more data
and storage than visiting only the homepage. No support website or remote HTML
resources are mirrored. Existing rasterization, memory and browser limitations
continue to apply.

## Reproducible checks

Use the repository's selected Node runtime and install dependencies as documented
in AGENTS.md. Browser checks use an externally provisioned Playwright module and
Chromium; no browser-test dependency is added to the production bundle.

```sh
yarn lint
node --experimental-strip-types --test scripts/*.test.mjs
yarn build
yarn test:seo .next/server/app
yarn start -p 3104
# In another shell, set PDFKIT_PLAYWRIGHT_MODULE to the Playwright ESM entrypoint.
# Set PDFKIT_CHROMIUM_EXECUTABLE if using an existing Chrome installation.
PDFKIT_OFFLINE=1 PDFKIT_UX_PHASE=exports node scripts/check-ux.mjs
node scripts/check-offline-lifecycle.mjs
yarn build:cloudflare
yarn test:seo
```

The offline export suite visits only the homepage online, waits for readiness,
then disables networking and opens a fresh tab. It checks every route/reload,
internal navigation, worker HEAD/GET and downloads for all 18 tools, inspecting
PDF content/page counts, encryption round trips, image ZIP names and flattened
redaction pixels. Cache keys and document-processing network writes are checked.
The lifecycle suite uses a local proxy to inject registration, asset and quota
failures, tests retry and failed-update survival, verifies Chromium installability,
and simulates successive worker versions while preserving unsaved HTML input.
Unit tests independently exercise cache selection, eviction, incomplete installs,
retry, update cleanup, privacy and HEAD handling.

## Evidence and coverage limits (issue #28)

Desktop and 375px installation/readiness screenshots are committed in
[offline-28/desktop.png](offline-28/desktop.png) and
[offline-28/mobile.png](offline-28/mobile.png). The UI extends the existing gray,
white and blue navigation styling; it adds a native expandable details row and
keeps preparation/retry feedback in the same place on every page.

Automated Chromium checks exercise desktop and narrow layouts; they do not certify
physical mobile installation, Safari/Firefox, OS-level installation dialogs,
low-memory devices or storage eviction policy across browsers. Chromium's
installability criteria are checked in a persistent profile; actual home-screen
and OS installation remain manual follow-ups. The lifecycle proxy simulates
successive worker builds and interrupted preparation; it is not a rolling CDN
deployment test. Native wrappers and native releases are outside this change.

Available local checks passed: `git diff --check`, `yarn lint` (five pre-existing
image warnings), `node --experimental-strip-types --test scripts/*.test.mjs`
(eight tests), `yarn build`, `yarn test:seo .next/server/app`,
`yarn build:cloudflare`, and `yarn test:seo`. Both builds cover 21 local pages.
The all-tools offline output suite ran against Node production and the Wrangler
static preview; the final static run also compares every cached response's hash
before and after processing. Registration, asset and storage fault injection,
retry, update lifecycle and a fresh browser-process offline launch were checked
against Node production. No document-processing network writes or uncaught page
errors were observed. The Playwright default browser revision was unavailable;
tests used the already installed Chromium headless shell via
`PDFKIT_CHROMIUM_EXECUTABLE`, without downloading or adding dependencies.
