import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Executive Assistant Page Object Model
 *
 * Tests for the EA dashboard and learning interface
 */
export class EAPage extends BasePage {
  readonly statusPanel: Locator;
  readonly inboxSection: Locator;
  readonly learningSection: Locator;
  readonly actionButtons: Locator;
  readonly continuityNarrative: Locator;

  constructor(page: Page) {
    super(page);
    this.statusPanel = page.locator('[data-testid="ea-status"], .ea-status');
    this.inboxSection = page.locator('[data-testid="inbox"], .inbox');
    this.learningSection = page.locator('[data-testid="learning"], .learning');
    this.actionButtons = page.locator('button[data-action], .action-button');
    this.continuityNarrative = page.locator('[data-testid="continuity"], .continuity-narrative');
  }

  async goto() {
    await super.goto('/ea');
  }

  async gotoLearning() {
    await super.goto('/ea/learn');
  }

  async expectEALoaded() {
    await this.waitForPageLoad();
    await expect(this.mainContent).toBeVisible();
  }

  async expectLearningPageLoaded() {
    await this.waitForPageLoad();
    await expect(this.mainContent).toBeVisible();
  }
}
