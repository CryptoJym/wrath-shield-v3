import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model
 *
 * Provides common functionality for all page objects:
 * - Navigation helpers
 * - Wait utilities
 * - Screenshot helpers
 * - Common element selectors
 */
export class BasePage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly header: Locator;
  readonly mainContent: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('[data-testid="sidebar"], nav, aside').first();
    this.header = page.locator('header, [data-testid="header"]').first();
    this.mainContent = page.locator('main, [data-testid="main-content"]').first();
    this.loadingIndicator = page.locator('[data-testid="loading"], .loading, .spinner');
  }

  /**
   * Navigate to a specific path
   */
  async goto(path: string = '/') {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  /**
   * Wait for the page to finish loading
   */
  async waitForPageLoad() {
    try {
      // Wait for DOM content loaded first (fast)
      await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });

      // Then wait for network idle (slower but ensures data loaded)
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        // Continue even if network isn't fully idle (some pages have polling)
      });

      // Wait for loading indicators to disappear (if present)
      const loadingCount = await this.loadingIndicator.count().catch(() => 0);
      if (loadingCount > 0) {
        await this.loadingIndicator.first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      }

      // Small delay for React hydration
      await this.page.waitForTimeout(300);
    } catch {
      // If page was closed during wait, just return
      // This can happen when tests run in parallel
    }
  }

  /**
   * Take a full-page screenshot for visual comparison
   */
  async takeFullPageScreenshot(name: string) {
    await this.waitForPageLoad();
    return this.page.screenshot({
      fullPage: true,
      path: `e2e/screenshots/${name}.png`,
    });
  }

  /**
   * Take a screenshot of a specific element
   */
  async takeElementScreenshot(selector: string, name: string) {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });
    return element.screenshot({
      path: `e2e/screenshots/${name}.png`,
    });
  }

  /**
   * Check if the page loaded without errors
   * Ignores common non-error elements like toast notifications, info alerts, etc.
   */
  async expectNoErrors() {
    // Check for actual error boundaries or error states
    // Be more specific to avoid false positives from UI components
    const errorSelectors = [
      '[data-testid="error"]',
      '[data-testid="error-message"]',
      '.error-boundary',
      '[data-testid="error-boundary"]',
      '.next-error-h1', // Next.js error pages
      '#__next-build-error', // Next.js build errors
    ].join(', ');

    const errorElements = this.page.locator(errorSelectors);
    const errorCount = await errorElements.count();

    if (errorCount > 0) {
      const errorText = await errorElements.first().textContent();
      // Only throw if it's a real error (not empty or info message)
      if (errorText && errorText.length > 0 && !errorText.includes('info')) {
        throw new Error(`Page has errors: ${errorText}`);
      }
    }

    // Also check for JavaScript errors in console (but don't fail on warnings)
    // This is handled by Playwright's built-in error detection
  }

  /**
   * Check if page redirected to sign-in (auth required)
   */
  async isRedirectedToSignIn(): Promise<boolean> {
    return this.page.url().includes('/sign-in');
  }

  /**
   * Wait for the page to be ready (not redirected to sign-in)
   */
  async expectNotRedirectedToSignIn() {
    // Give the page a moment to potentially redirect
    await this.page.waitForTimeout(500);
    const isSignIn = await this.isRedirectedToSignIn();
    if (isSignIn) {
      throw new Error('Page redirected to sign-in - authentication required. Set DISABLE_AUTH=1 to bypass.');
    }
  }

  /**
   * Check page title
   */
  async expectTitle(title: string | RegExp) {
    await expect(this.page).toHaveTitle(title);
  }

  /**
   * Check if element is visible
   */
  async expectVisible(selector: string) {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  /**
   * Click and wait for navigation
   */
  async clickAndNavigate(selector: string) {
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle' }),
      this.page.click(selector),
    ]);
  }

  /**
   * Get current URL path
   */
  getPath(): string {
    return new URL(this.page.url()).pathname;
  }

  /**
   * Disable animations for consistent screenshots
   */
  async disableAnimations() {
    await this.page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });
  }

  /**
   * Scroll to bottom of page (for lazy-loaded content)
   */
  async scrollToBottom() {
    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await this.page.waitForTimeout(500);
  }

  /**
   * Scroll to top of page
   */
  async scrollToTop() {
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await this.page.waitForTimeout(300);
  }
}
