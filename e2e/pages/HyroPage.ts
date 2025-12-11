import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Hyro/Forge Education System Page Object Model
 *
 * Tests for the education and learning platform
 */
export class HyroPage extends BasePage {
  readonly forgeMenu: Locator;
  readonly sessionArea: Locator;
  readonly progressTracker: Locator;
  readonly questList: Locator;
  readonly analyticsPanel: Locator;

  constructor(page: Page) {
    super(page);
    this.forgeMenu = page.locator('[data-testid="forge-menu"], .forge-menu, nav');
    this.sessionArea = page.locator('[data-testid="session"], .session-area');
    this.progressTracker = page.locator('[data-testid="progress"], .progress');
    this.questList = page.locator('[data-testid="quests"], .quest-list');
    this.analyticsPanel = page.locator('[data-testid="analytics"], .analytics');
  }

  async goto() {
    await super.goto('/hyro');
  }

  async gotoForge() {
    await super.goto('/hyro/forge');
  }

  async gotoSession() {
    await super.goto('/hyro/forge/session');
  }

  async gotoQuests() {
    await super.goto('/hyro/forge/quests');
  }

  async gotoAnalytics() {
    await super.goto('/hyro/forge/analytics');
  }

  async gotoTutor() {
    await super.goto('/hyro/forge/tutor');
  }

  async gotoReading() {
    await super.goto('/hyro/forge/reading');
  }

  async gotoManifold() {
    await super.goto('/hyro/manifold');
  }

  async expectHyroLoaded() {
    await this.waitForPageLoad();
    // Hyro uses a different layout - check for any visible content
    // Wait for either main content or the hyro-specific content
    const hyroContent = this.page.locator('main, [data-testid="main-content"], .hyro-content, #root > div, body > div').first();
    await expect(hyroContent).toBeVisible({ timeout: 10000 });
  }
}
