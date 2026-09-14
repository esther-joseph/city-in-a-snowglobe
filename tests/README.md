# E2E Testing with Playwright

End-to-end tests for City In A Snowglobe.

## Structure

```
tests/e2e/
├── smoke.spec.js              # Loading, initial weather, basic navigation
├── search.spec.js             # Search input, autocomplete, clear, submit
├── ui-components.spec.js      # Drawer, view modes, charts, mode toggle
├── mobile-responsive.spec.js  # Pixel 5 profile
├── tablet-responsive.spec.js  # Galaxy Tab S4 profile
├── accessibility.spec.js      # Headings, labels, keyboard, ARIA
├── performance.spec.js        # Load time, interaction, canvas
└── support/
    ├── app.js                 # gotoApp / openDrawer and shared locators
    └── weatherFixture.js      # Canned /api/openweather responses
```

## Running

```bash
npx playwright install chromium   # once
npm test                          # whole suite
npm run test:ui                   # interactive runner
npm run test:report               # last HTML report
npm test -- tests/e2e/smoke.spec.js
npm test -- --project="Mobile Chrome"
```

The dev server starts automatically (`webServer` in `playwright.config.js`) and
an already-running one on port 3000 is reused.

## How the suite is set up

**Always start through `gotoApp(page)`.** It does two things a plain
`page.goto('/')` cannot:

- Seeds `sessionStorage['app-has-reloaded']` before navigation. The app reloads
  itself once per session on first launch, and anything clicked before that
  lands dies with "Target page, context or browser has been closed".
- Stubs `/api/openweather` from `support/weatherFixture.js`, so runs are
  deterministic, spend no OpenWeather quota, and can assert autocomplete
  results instead of skipping when the network is slow.

**The suite runs serially** with a 90s per-test budget and a 15s expect
timeout. Every test renders a full WebGL scene; parallel contexts starve each
other, and mobile emulation renders the scene on the CPU. A full run takes
about six minutes — that is expected, not a hang.

**Projects**: `chromium` and `Mobile Chrome`. Firefox, WebKit and the iPhone 12
profile are commented out in the config because they need browsers that
`npx playwright install chromium` does not fetch. To enable them:

```bash
npx playwright install firefox webkit
```

then uncomment the matching project blocks.

## Writing new tests

- Use the locators exported from `support/app.js` rather than re-deriving them.
  `getByRole('button', { name: /search/i })` matches the "Clear search" button
  too, which is why `searchButton` targets `.search-button`.
- Avoid comma selectors in assertions unless you add `.first()`; several
  components render both a wrapper and an inner element with related class
  names, and strict mode fails on the ambiguity.
- Prefer waiting on a condition over `waitForTimeout`. The autocomplete has a
  300ms debounce, so `expect(suggestions).toBeVisible()` is enough.
- Add fixture data to `support/weatherFixture.js` rather than hitting the live
  API.
