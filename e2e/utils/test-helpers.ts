import { Page, expect } from '@playwright/test';

/**
 * E2E Test Utilities
 *
 * Common helper functions for Playwright tests
 */

/**
 * Wait for all network requests to complete
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // Continue even if timeout - some pages have long-polling
  }
}

/**
 * Take a screenshot with timestamp
 */
export async function timestampedScreenshot(page: Page, prefix: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return page.screenshot({
    path: `e2e/screenshots/${prefix}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Check for console errors
 */
export async function expectNoConsoleErrors(page: Page) {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Wait a bit for any async errors
  await page.waitForTimeout(500);

  // Filter out known acceptable errors
  const realErrors = errors.filter((e) => {
    // Ignore some common non-critical errors
    if (e.includes('Failed to load resource: net::ERR_FAILED')) return false;
    if (e.includes('favicon.ico')) return false;
    return true;
  });

  expect(realErrors).toEqual([]);
}

/**
 * Wait for page to be interactive
 */
export async function waitForInteractive(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => document.readyState === 'complete');
}

/**
 * Get all links on the page
 */
export async function getAllLinks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links
      .map((a) => a.getAttribute('href'))
      .filter((href): href is string => href !== null && href.startsWith('/'));
  });
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }, selector);
}

/**
 * Retry an action until it succeeds
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Mock API response
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: object,
  status = 200
) {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Generate test data IDs
 */
export function generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
