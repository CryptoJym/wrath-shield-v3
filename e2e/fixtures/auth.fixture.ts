import { test as base, Page, BrowserContext } from '@playwright/test';

/**
 * Authentication Fixtures for E2E Testing
 *
 * Provides different authentication states for testing:
 * - unauthenticatedPage: No auth, tests public routes
 * - authenticatedPage: Logged in user (requires DISABLE_AUTH=1 or mock)
 *
 * The app supports DISABLE_AUTH=1 env var to bypass Clerk authentication.
 * For E2E tests, we use this approach rather than real Clerk auth.
 */

interface AuthFixtures {
  /**
   * Page without authentication
   * Use for testing public routes like /sign-in, /privacy, /hyro
   */
  unauthenticatedPage: Page;

  /**
   * Page with mocked authentication state
   * Use for testing protected routes
   * Note: Requires DISABLE_AUTH=1 in env (set in playwright.config.ts)
   */
  authenticatedPage: Page;

  /**
   * Browser context with authentication cookies/storage
   * Use for complex multi-page auth scenarios
   */
  authenticatedContext: BrowserContext;
}

export const test = base.extend<AuthFixtures>({
  /**
   * Unauthenticated page - used for public routes
   */
  unauthenticatedPage: async ({ page }, use) => {
    // No setup needed - just use the page as-is
    await use(page);
  },

  /**
   * Authenticated page - relies on DISABLE_AUTH=1
   * The webServer in playwright.config.ts starts with this env var
   */
  authenticatedPage: async ({ page }, use) => {
    // Verify auth is disabled (the webServer should have DISABLE_AUTH=1)
    // Just navigate to a protected route - it should work
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle').catch(() => {});

    // Check we weren't redirected to sign-in
    if (page.url().includes('/sign-in')) {
      throw new Error(
        'Authentication redirect detected. ' +
          'Make sure the dev server is running with DISABLE_AUTH=1. ' +
          'The webServer in playwright.config.ts should set this automatically.'
      );
    }

    await use(page);
  },

  /**
   * Authenticated browser context
   * Useful for tests that need multiple pages or tabs
   */
  authenticatedContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to verify auth bypass is working
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});

    if (page.url().includes('/sign-in')) {
      await context.close();
      throw new Error(
        'Authentication redirect detected. ' +
          'Make sure the dev server is running with DISABLE_AUTH=1.'
      );
    }

    await page.close();
    await use(context);
    await context.close();
  },
});

export { expect } from '@playwright/test';

/**
 * Test Data for Auth Testing
 */
export const testUsers = {
  standard: {
    email: 'test@example.com',
    name: 'Test User',
  },
  admin: {
    email: 'admin@example.com',
    name: 'Admin User',
  },
};

/**
 * Public routes that don't require authentication
 */
export const publicRoutes = [
  '/sign-in',
  '/sign-up',
  '/privacy',
  '/api/health',
  '/api/system/status',
  '/hyro',
  '/hyro/forge',
  '/hyro/session',
  '/hyro/analytics',
];

/**
 * Protected routes that require authentication
 */
export const protectedRoutes = [
  '/',
  '/chat',
  '/chat/modern',
  '/ea',
  '/ea/learning',
  '/tasks',
  '/finance',
  '/finance/reimbursements',
  '/legal',
  '/legal/actions',
  '/legal/timeline',
];

/**
 * Helper to check if a route is public
 */
export function isPublicRoute(path: string): boolean {
  return publicRoutes.some((route) => path.startsWith(route));
}
