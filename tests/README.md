# E2E Testing with Playwright

This directory contains end-to-end (E2E) tests for the 3D Weather City application using Playwright.

## Test Structure

```
tests/
└── e2e/
    ├── smoke.spec.js           # Basic smoke tests
    ├── search.spec.js          # Search functionality tests
    ├── ui-components.spec.js    # UI component tests
    ├── mobile-responsive.spec.js # Mobile responsiveness tests
    ├── accessibility.spec.js   # Accessibility tests
    └── performance.spec.js     # Performance tests
```

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests with UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Debug tests
```bash
npm run test:e2e:debug
```

### View test report
```bash
npm run test:e2e:report
```

## Test Coverage

### Smoke Tests (`smoke.spec.js`)
- Application loading
- Initial weather data display
- Basic navigation

### Search Tests (`search.spec.js`)
- Search input functionality
- Autocomplete suggestions
- Clear button
- Form submission
- Search with autocomplete selection

### UI Component Tests (`ui-components.spec.js`)
- Weather drawer toggle
- View mode switching (Minimal, Compact, Informational)
- Time slider
- Mode toggle (3D/AR)
- Component visibility and styling

### Mobile Responsiveness Tests (`mobile-responsive.spec.js`)
- Mobile viewport rendering
- Touch-friendly button sizes
- Drawer accessibility on mobile
- Search button positioning
- Tablet viewport support

### Accessibility Tests (`accessibility.spec.js`)
- Heading hierarchy
- Button labels and ARIA attributes
- Keyboard navigation
- Color contrast
- Focus management

### Performance Tests (`performance.spec.js`)
- Load time
- Time to Interactive
- Rapid user interactions
- Memory leak detection
- Canvas rendering efficiency

## Configuration

Tests are configured in `playwright.config.js` at the root of the project. The configuration includes:

- **Browsers**: Chromium, Firefox, WebKit
- **Mobile devices**: iPhone 12, Pixel 5
- **Base URL**: `http://localhost:3000`
- **Auto-start dev server**: Tests automatically start the dev server
- **Retries**: 2 retries on CI, 0 locally
- **Screenshots**: On failure
- **Videos**: Retained on failure
- **Traces**: On first retry

## Writing New Tests

1. Create a new test file in `tests/e2e/`
2. Import Playwright test utilities:
   ```javascript
   import { test, expect } from '@playwright/test'
   ```
3. Use `test.describe()` to group related tests
4. Use `test.beforeEach()` for setup
5. Use `await page.goto('/')` to navigate
6. Use Playwright's auto-waiting features (no manual timeouts needed when possible)

## Best Practices

- Use semantic selectors (getByRole, getByText, getByPlaceholder)
- Avoid hard-coded timeouts when possible (use Playwright's auto-waiting)
- Test user interactions, not implementation details
- Keep tests independent and isolated
- Use descriptive test names
- Group related tests in describe blocks

## CI/CD Integration

The tests are configured to run in CI environments:
- Retries: 2 attempts on failure
- Workers: 1 (sequential execution)
- Trace collection: Enabled for debugging

## Troubleshooting

### Tests fail with "Navigation timeout"
- Ensure the dev server is running on port 3000
- Check that `OPENWEATHER_API_KEY` is set (tests may need mock data)

### Tests fail with "Element not visible"
- Increase timeout if needed: `await expect(element).toBeVisible({ timeout: 10000 })`
- Check if element is in a drawer that needs to be opened first

### Browser not found
- Run `npx playwright install` to install browsers

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-test)

