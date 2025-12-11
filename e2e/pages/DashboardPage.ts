import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Dashboard / Home Page Object Model
 *
 * The main landing page showing system status and quick access
 */
export class DashboardPage extends BasePage {
  readonly welcomeMessage: Locator;
  readonly quickActions: Locator;
  readonly systemStatus: Locator;
  readonly recentActivity: Locator;
  readonly navigationCards: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeMessage = page.locator('h1, [data-testid="welcome"]');
    this.quickActions = page.locator('[data-testid="quick-actions"], .quick-actions');
    this.systemStatus = page.locator('[data-testid="system-status"], .system-status');
    this.recentActivity = page.locator('[data-testid="recent-activity"], .recent-activity');
    this.navigationCards = page.locator('[data-testid="nav-card"], .nav-card, a[href^="/"]');
  }

  async goto() {
    await super.goto('/');
  }

  async expectDashboardLoaded() {
    await this.waitForPageLoad();
    await expect(this.mainContent).toBeVisible();
  }

  async getNavigationLinks(): Promise<string[]> {
    const links = await this.page.locator('a[href^="/"]').all();
    const hrefs: string[] = [];
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('/api') && !href.includes('sign-')) {
        hrefs.push(href);
      }
    }
    return [...new Set(hrefs)]; // Remove duplicates
  }

  async navigateToSection(sectionName: string) {
    const link = this.page.locator(`a:has-text("${sectionName}")`).first();
    await link.click();
    await this.waitForPageLoad();
  }
}
