import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Finance Page Object Model
 *
 * Tests for the finance dashboard and reports
 */
export class FinancePage extends BasePage {
  readonly summaryPanel: Locator;
  readonly transactionList: Locator;
  readonly chartArea: Locator;
  readonly dateSelector: Locator;
  readonly reportButton: Locator;

  constructor(page: Page) {
    super(page);
    this.summaryPanel = page.locator('[data-testid="finance-summary"], .finance-summary');
    this.transactionList = page.locator('[data-testid="transactions"], .transactions');
    this.chartArea = page.locator('canvas, svg, [data-testid="chart"]');
    this.dateSelector = page.locator('[data-testid="date-selector"], input[type="date"]');
    this.reportButton = page.locator('button:has-text("Report"), [data-testid="generate-report"]');
  }

  async goto() {
    await super.goto('/finance');
  }

  async gotoReimbursements() {
    await super.goto('/finance/reimbursements');
  }

  async gotoPrint() {
    await super.goto('/finance/print');
  }

  async expectFinanceLoaded() {
    await this.waitForPageLoad();
    await expect(this.mainContent).toBeVisible();
  }
}
