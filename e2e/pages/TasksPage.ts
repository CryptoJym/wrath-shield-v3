import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Tasks Page Object Model
 *
 * Tests for the task management interface
 */
export class TasksPage extends BasePage {
  readonly taskList: Locator;
  readonly taskItems: Locator;
  readonly addTaskButton: Locator;
  readonly filterButtons: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.taskList = page.locator('[data-testid="task-list"], .task-list, ul, .tasks');
    this.taskItems = page.locator('[data-testid="task-item"], .task-item, li');
    this.addTaskButton = page.locator('button:has-text("Add"), button:has-text("New"), [data-testid="add-task"]');
    this.filterButtons = page.locator('[data-testid="filter"], .filter-button, button[data-filter]');
    this.searchInput = page.locator('input[placeholder*="search" i], input[type="search"]');
  }

  async goto() {
    await super.goto('/tasks');
  }

  async expectTasksLoaded() {
    await this.waitForPageLoad();
    await expect(this.mainContent).toBeVisible();
  }

  async getTaskCount(): Promise<number> {
    await this.waitForPageLoad();
    return await this.taskItems.count();
  }
}
