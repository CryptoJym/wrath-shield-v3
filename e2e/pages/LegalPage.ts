import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Legal Page Object Model
 *
 * Tests for the legal case management interface
 */
export class LegalPage extends BasePage {
  readonly caseList: Locator;
  readonly caseDetails: Locator;
  readonly actionItems: Locator;
  readonly timeline: Locator;
  readonly documentList: Locator;

  constructor(page: Page) {
    super(page);
    this.caseList = page.locator('[data-testid="case-list"], .case-list');
    this.caseDetails = page.locator('[data-testid="case-details"], .case-details');
    this.actionItems = page.locator('[data-testid="action-items"], .action-items');
    this.timeline = page.locator('[data-testid="timeline"], .timeline');
    this.documentList = page.locator('[data-testid="documents"], .documents');
  }

  async goto() {
    await super.goto('/legal');
  }

  async gotoActions() {
    await super.goto('/legal/actions');
  }

  async gotoTimeline() {
    await super.goto('/legal/timeline');
  }

  async expectLegalLoaded() {
    await this.waitForPageLoad();
    await expect(this.mainContent).toBeVisible();
  }
}
