import { test, expect } from '@playwright/test';
import { DashboardPage, ChatPage, TasksPage, HyroPage } from '../pages';

/**
 * User Journey Tests
 *
 * End-to-end tests that simulate real user workflows.
 * These test complete user journeys across multiple pages.
 *
 * Run with: npx playwright test e2e/flows/
 */

test.describe('User Journey: New User Exploration', () => {
  test('user can explore the main sections of the app', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    // Start at homepage
    await dashboard.goto();
    await dashboard.expectDashboardLoaded();

    // Navigate to chat
    await page.goto('/chat');
    const chat = new ChatPage(page);
    await chat.expectChatLoaded();

    // Navigate to tasks
    await page.goto('/tasks');
    const tasks = new TasksPage(page);
    await tasks.expectTasksLoaded();

    // Navigate to EA
    await page.goto('/ea');
    await dashboard.waitForPageLoad();
    await dashboard.expectNoErrors();

    // Navigate to Finance
    await page.goto('/finance');
    await dashboard.waitForPageLoad();
    await dashboard.expectNoErrors();
  });
});

test.describe('User Journey: Chat Interaction', () => {
  test('user can open chat and see the interface', async ({ page }) => {
    const chat = new ChatPage(page);

    // Go to chat
    await chat.goto();
    await chat.expectChatLoaded();

    // Verify the input is ready
    await expect(chat.messageInput).toBeVisible();
    await expect(chat.messageInput).toBeEnabled();

    // Take a screenshot of initial state
    await expect(page).toHaveScreenshot('chat-initial-state.png', {
      maxDiffPixels: 200,
    });
  });

  test('user can navigate between chat variants', async ({ page }) => {
    const chat = new ChatPage(page);

    // Standard chat
    await chat.goto();
    await chat.expectChatLoaded();

    // Modern chat
    await chat.gotoModern();
    await chat.waitForPageLoad();

    // Inline chat
    await chat.gotoInline();
    await chat.waitForPageLoad();

    // All variants loaded successfully
    await chat.expectNoErrors();
  });
});

test.describe('User Journey: Hyro Education Flow', () => {
  test('student can navigate through Hyro Forge sections', async ({ page }) => {
    const hyro = new HyroPage(page);

    // Start at Hyro main
    await hyro.goto();
    await hyro.expectHyroLoaded();

    // Go to Forge
    await hyro.gotoForge();
    await hyro.waitForPageLoad();

    // Check analytics
    await hyro.gotoAnalytics();
    await hyro.waitForPageLoad();

    // Check quests
    await hyro.gotoQuests();
    await hyro.waitForPageLoad();

    // Start a session
    await hyro.gotoSession();
    await hyro.waitForPageLoad();

    // Visit tutor
    await hyro.gotoTutor();
    await hyro.waitForPageLoad();

    await hyro.expectNoErrors();
  });

  test('parent can view child progress', async ({ page }) => {
    const hyro = new HyroPage(page);

    // Go to parent dashboard
    await page.goto('/hyro/forge/parent');
    await hyro.waitForPageLoad();
    await hyro.expectNoErrors();

    // View weekly report
    await page.goto('/hyro/forge/parent/weekly');
    await hyro.waitForPageLoad();
    await hyro.expectNoErrors();
  });
});

test.describe('User Journey: Task Management', () => {
  test('user can view and interact with task list', async ({ page }) => {
    const tasks = new TasksPage(page);

    await tasks.goto();
    await tasks.expectTasksLoaded();

    // Take visual snapshot
    await expect(page).toHaveScreenshot('tasks-list.png', {
      maxDiffPixels: 300,
    });
  });
});

test.describe('User Journey: Executive Assistant', () => {
  test('user can access EA features', async ({ page }) => {
    // EA Dashboard
    await page.goto('/ea');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForPageLoad();
    await dashboard.expectNoErrors();

    // EA Learning
    await page.goto('/ea/learn');
    await dashboard.waitForPageLoad();
    await dashboard.expectNoErrors();

    // Take snapshot of learning page
    await expect(page).toHaveScreenshot('ea-learning.png', {
      maxDiffPixels: 300,
    });
  });
});

test.describe('User Journey: Legal Case Review', () => {
  test('user can navigate legal section', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    // Legal main
    await page.goto('/legal');
    await dashboard.waitForPageLoad();
    await dashboard.expectNoErrors();

    // Legal timeline
    await page.goto('/legal/timeline');
    await dashboard.waitForPageLoad();
    await dashboard.expectNoErrors();

    // Legal actions
    await page.goto('/legal/actions');
    await dashboard.waitForPageLoad();
    await dashboard.expectNoErrors();
  });
});

test.describe('User Journey: Finance Overview', () => {
  test('user can review finance sections', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    // Finance main
    await page.goto('/finance');
    await dashboard.waitForPageLoad();
    await dashboard.expectNoErrors();

    // Reimbursements
    await page.goto('/finance/reimbursements');
    await dashboard.waitForPageLoad();
    await dashboard.expectNoErrors();

    // Print view
    await page.goto('/finance/print');
    await dashboard.waitForPageLoad();
    await dashboard.expectNoErrors();
  });
});
