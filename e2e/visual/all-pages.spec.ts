import { test, expect } from '@playwright/test';
import { BasePage } from '../pages';

/**
 * Universal Visual Regression Tests
 *
 * This test suite automatically crawls through ALL pages in the application
 * and captures visual snapshots for regression testing.
 *
 * Run with: npx playwright test e2e/visual/all-pages.spec.ts
 */

// All pages discovered in the application
const ALL_PAGES = [
  // Core Pages
  { path: '/', name: 'home' },
  { path: '/feed', name: 'feed' },
  { path: '/digest', name: 'digest' },
  { path: '/tasks', name: 'tasks' },
  { path: '/inbox', name: 'inbox' },
  { path: '/approvals', name: 'approvals' },
  { path: '/comms', name: 'comms' },
  { path: '/metrics', name: 'metrics' },
  { path: '/metrics/psych', name: 'metrics-psych' },
  { path: '/relationships', name: 'relationships' },
  { path: '/systems', name: 'systems' },
  { path: '/orchestration', name: 'orchestration' },
  { path: '/privacy', name: 'privacy' },
  { path: '/council', name: 'council' },

  // Chat System
  { path: '/chat', name: 'chat' },
  { path: '/chat/modern', name: 'chat-modern' },
  { path: '/chat/inline', name: 'chat-inline' },
  { path: '/chat/ui-demo', name: 'chat-ui-demo' },

  // Executive Assistant
  { path: '/ea', name: 'ea-dashboard' },
  { path: '/ea/learn', name: 'ea-learn' },

  // Finance
  { path: '/finance', name: 'finance' },
  { path: '/finance/reimbursements', name: 'finance-reimbursements' },
  { path: '/finance/print', name: 'finance-print' },

  // Legal
  { path: '/legal', name: 'legal' },
  { path: '/legal/actions', name: 'legal-actions' },
  { path: '/legal/timeline', name: 'legal-timeline' },

  // Agents
  { path: '/agents', name: 'agents' },
  { path: '/agents/graph', name: 'agents-graph' },
  { path: '/agents/roster', name: 'agents-roster' },

  // PM (Project Management)
  { path: '/pm', name: 'pm' },
  { path: '/pm/github', name: 'pm-github' },

  // Hyro Education System
  { path: '/hyro', name: 'hyro' },
  { path: '/hyro/forge', name: 'hyro-forge' },
  { path: '/hyro/forge/session', name: 'hyro-session' },
  { path: '/hyro/forge/tutor', name: 'hyro-tutor' },
  { path: '/hyro/forge/reading', name: 'hyro-reading' },
  { path: '/hyro/forge/quests', name: 'hyro-quests' },
  { path: '/hyro/forge/analytics', name: 'hyro-analytics' },
  { path: '/hyro/forge/proficiency', name: 'hyro-proficiency' },
  { path: '/hyro/forge/srs', name: 'hyro-srs' },
  { path: '/hyro/forge/comprehension', name: 'hyro-comprehension' },
  { path: '/hyro/forge/reflections', name: 'hyro-reflections' },
  { path: '/hyro/forge/intel', name: 'hyro-intel' },
  { path: '/hyro/forge/diagnostic', name: 'hyro-diagnostic' },
  { path: '/hyro/forge/sphere-grid', name: 'hyro-sphere-grid' },
  { path: '/hyro/forge/about', name: 'hyro-about' },
  { path: '/hyro/forge/onboarding', name: 'hyro-onboarding' },
  { path: '/hyro/forge/parent', name: 'hyro-parent' },
  { path: '/hyro/forge/parent/weekly', name: 'hyro-parent-weekly' },
  { path: '/hyro/manifold', name: 'hyro-manifold' },
  { path: '/hyro/observer', name: 'hyro-observer' },

  // EEG
  { path: '/eeg', name: 'eeg' },
];

test.describe('Visual Regression - All Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);
    });
  });

  for (const { path, name } of ALL_PAGES) {
    test(`visual snapshot: ${name} (${path})`, async ({ page }) => {
      const basePage = new BasePage(page);

      // Navigate to the page
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Wait for page to stabilize
      await basePage.waitForPageLoad();

      // Scroll to load any lazy content
      await basePage.scrollToBottom();
      await basePage.scrollToTop();

      // Additional wait for any async content
      await page.waitForTimeout(1000);

      // Take and compare screenshot
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        maxDiffPixels: 500, // Allow some variance
        threshold: 0.3, // 30% threshold
        animations: 'disabled',
      });
    });
  }
});

test.describe('Visual Regression - Responsive', () => {
  const viewports = [
    { width: 375, height: 667, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1920, height: 1080, name: 'desktop-large' },
  ];

  // Test key pages at different viewports
  const keyPages = [
    { path: '/', name: 'home' },
    { path: '/chat', name: 'chat' },
    { path: '/tasks', name: 'tasks' },
    { path: '/ea', name: 'ea' },
  ];

  for (const viewport of viewports) {
    for (const { path, name } of keyPages) {
      test(`responsive: ${name} @ ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        const basePage = new BasePage(page);
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await basePage.waitForPageLoad();

        await expect(page).toHaveScreenshot(`${name}-${viewport.name}.png`, {
          fullPage: true,
          maxDiffPixels: 300,
          animations: 'disabled',
        });
      });
    }
  }
});
