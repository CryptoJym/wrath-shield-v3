import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Wrath Shield Visual Testing
 *
 * Features:
 * - Visual regression testing with screenshot comparison
 * - Multi-browser support (Chrome, Firefox, Safari, Mobile)
 * - Parallel test execution
 * - HTML report generation
 * - Video recording on failure
 * - Trace collection for debugging
 */

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test file patterns
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],

  // Maximum time for a single test (increased for cold compilation)
  timeout: 60 * 1000,

  // Maximum time for expect() assertions
  expect: {
    timeout: 5000,
    // Visual comparison settings
    toHaveScreenshot: {
      maxDiffPixels: 100, // Allow small differences
      threshold: 0.2, // 20% threshold for pixel differences
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.05, // 5% of pixels can differ
    },
  },

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests (more on CI)
  retries: process.env.CI ? 2 : 0,

  // Number of parallel workers (reduced for cold compilation stability)
  workers: process.env.CI ? 1 : 2,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-results.json' }],
    ['list'], // Console output
  ],

  // Shared settings for all projects
  use: {
    // Base URL for the application
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4242',

    // Collect trace when retrying a failed test
    trace: 'on-first-retry',

    // Record video on failure
    video: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Emulate color scheme
    colorScheme: 'dark', // Match your app's default

    // Ignore HTTPS errors (useful for local dev)
    ignoreHTTPSErrors: true,

    // Action timeout
    actionTimeout: 10000,

    // Navigation timeout (increased for cold compilation)
    navigationTimeout: 45000,
  },

  // Configure projects for major browsers and devices
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet viewport
    {
      name: 'iPad',
      use: { ...devices['iPad (gen 7)'] },
    },

    // Visual regression project (uses Chrome with specific settings)
    {
      name: 'visual',
      use: {
        ...devices['Desktop Chrome'],
        // Disable animations for consistent screenshots
        launchOptions: {
          args: ['--disable-animations'],
        },
      },
      testMatch: ['**/visual/**/*.spec.ts'],
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'DISABLE_AUTH=1 npm run dev',
    url: 'http://localhost:4242',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      DISABLE_AUTH: '1', // Bypass Clerk auth for E2E testing
    },
  },

  // Output folder for test artifacts
  outputDir: 'test-results',

  // Preserve output on failure
  preserveOutput: 'failures-only',

  // Global setup/teardown
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
});
