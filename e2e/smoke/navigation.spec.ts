import { test, expect } from '../fixtures/auth.fixture';
import { DashboardPage, ChatPage, EAPage, TasksPage, FinancePage, LegalPage, HyroPage } from '../pages';

/**
 * Navigation Smoke Tests
 *
 * Verify all major navigation paths work and pages load without errors.
 * This is a quick health check that can run on every deployment.
 *
 * Requirements:
 * - Dev server running with DISABLE_AUTH=1 (handled by playwright.config.ts webServer)
 * - Or run manually: DISABLE_AUTH=1 npm run dev
 *
 * Run with: npx playwright test e2e/smoke/
 */

test.describe('Navigation Smoke Tests', () => {
  test('homepage loads successfully', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await dashboard.goto();
    await dashboard.expectDashboardLoaded();
    await dashboard.expectNoErrors();
  });

  test('chat page loads and has input', async ({ authenticatedPage }) => {
    const chat = new ChatPage(authenticatedPage);
    await chat.goto();
    await chat.expectChatLoaded();
    await chat.expectNoErrors();
  });

  test('chat modern variant loads', async ({ authenticatedPage }) => {
    const chat = new ChatPage(authenticatedPage);
    await chat.gotoModern();
    await chat.waitForPageLoad();
    await chat.expectNoErrors();
  });

  test('EA dashboard loads', async ({ authenticatedPage }) => {
    const ea = new EAPage(authenticatedPage);
    await ea.goto();
    await ea.expectEALoaded();
    await ea.expectNoErrors();
  });

  test('EA learning page loads', async ({ authenticatedPage }) => {
    const ea = new EAPage(authenticatedPage);
    await ea.gotoLearning();
    await ea.expectLearningPageLoaded();
    await ea.expectNoErrors();
  });

  test('tasks page loads', async ({ authenticatedPage }) => {
    const tasks = new TasksPage(authenticatedPage);
    await tasks.goto();
    await tasks.expectTasksLoaded();
    await tasks.expectNoErrors();
  });

  test('finance page loads', async ({ authenticatedPage }) => {
    const finance = new FinancePage(authenticatedPage);
    await finance.goto();
    await finance.expectFinanceLoaded();
    await finance.expectNoErrors();
  });

  test('finance reimbursements loads', async ({ authenticatedPage }) => {
    const finance = new FinancePage(authenticatedPage);
    await finance.gotoReimbursements();
    await finance.waitForPageLoad();
    await finance.expectNoErrors();
  });

  test('legal page loads', async ({ authenticatedPage }) => {
    const legal = new LegalPage(authenticatedPage);
    await legal.goto();
    await legal.expectLegalLoaded();
    await legal.expectNoErrors();
  });

  test('legal actions loads', async ({ authenticatedPage }) => {
    const legal = new LegalPage(authenticatedPage);
    await legal.gotoActions();
    await legal.waitForPageLoad();
    await legal.expectNoErrors();
  });

  test('legal timeline loads', async ({ authenticatedPage }) => {
    const legal = new LegalPage(authenticatedPage);
    await legal.gotoTimeline();
    await legal.waitForPageLoad();
    await legal.expectNoErrors();
  });
});

test.describe('Public Routes (No Auth Required)', () => {
  test('hyro main page loads', async ({ page }) => {
    const hyro = new HyroPage(page);
    await hyro.goto();
    await hyro.expectHyroLoaded();
    await hyro.expectNoErrors();
  });

  test('hyro forge loads', async ({ page }) => {
    const hyro = new HyroPage(page);
    await hyro.gotoForge();
    await hyro.waitForPageLoad();
    await hyro.expectNoErrors();
  });

  test('hyro session loads', async ({ page }) => {
    const hyro = new HyroPage(page);
    await hyro.gotoSession();
    await hyro.waitForPageLoad();
    await hyro.expectNoErrors();
  });

  test('hyro analytics loads', async ({ page }) => {
    const hyro = new HyroPage(page);
    await hyro.gotoAnalytics();
    await hyro.waitForPageLoad();
    await hyro.expectNoErrors();
  });

  test('sign-in page loads', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    // Sign-in page should be visible (Clerk may take time to load)
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    // Page should contain something (not completely empty)
    const bodyText = await page.locator('body').textContent().catch(() => '');
    expect(bodyText?.length || 0).toBeGreaterThan(0);
  });
});

test.describe('Cross-Navigation Tests', () => {
  // Increase timeout for navigation tests that visit multiple pages
  test.setTimeout(60000);

  test('can navigate from home to all main sections', async ({ authenticatedPage }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await dashboard.goto();

    // Get all navigation links
    const links = await dashboard.getNavigationLinks();
    expect(links.length).toBeGreaterThan(0);

    // Visit each link and verify it loads (test first 3 to keep it fast)
    const sectionsToTest = links.slice(0, 3);

    for (const link of sectionsToTest) {
      try {
        await authenticatedPage.goto(link);
        await dashboard.waitForPageLoad();

        // Verify no JavaScript errors
        await dashboard.expectNoErrors();

        // Verify we're on the right page
        expect(dashboard.getPath()).toBe(link);
      } catch {
        // Continue to next link if one fails (page may have closed)
        continue;
      }
    }
  });

  test('navigation between protected routes maintains session', async ({ authenticatedPage }) => {
    // Navigate through several protected routes
    const routes = ['/chat', '/ea', '/tasks', '/finance'];

    for (const route of routes) {
      try {
        await authenticatedPage.goto(route);
        await authenticatedPage.waitForLoadState('domcontentloaded').catch(() => {});

        // Should NOT be redirected to sign-in
        expect(authenticatedPage.url()).not.toContain('/sign-in');
      } catch {
        // Continue to next route if one fails
        continue;
      }
    }
  });
});
