import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Chat Page Object Model
 *
 * Tests for the AI chat interface
 */
export class ChatPage extends BasePage {
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly messageList: Locator;
  readonly agentSelector: Locator;
  readonly clearButton: Locator;

  constructor(page: Page) {
    super(page);
    this.messageInput = page.locator('textarea, input[type="text"]').last();
    this.sendButton = page.locator('button:has-text("Send"), button[type="submit"], [data-testid="send-button"]').first();
    this.messageList = page.locator('[data-testid="messages"], .messages, .chat-messages');
    this.agentSelector = page.locator('[data-testid="agent-selector"], select, .agent-selector');
    this.clearButton = page.locator('button:has-text("Clear"), [data-testid="clear-chat"]');
  }

  async goto() {
    await super.goto('/chat');
  }

  async gotoModern() {
    await super.goto('/chat/modern');
  }

  async gotoInline() {
    await super.goto('/chat/inline');
  }

  async expectChatLoaded() {
    await this.waitForPageLoad();
    await expect(this.messageInput).toBeVisible({ timeout: 10000 });
  }

  async sendMessage(message: string) {
    await this.messageInput.fill(message);
    await this.sendButton.click();
    // Wait for response
    await this.page.waitForTimeout(1000);
  }

  async expectMessageVisible(text: string) {
    await expect(this.page.locator(`text=${text}`).first()).toBeVisible({ timeout: 30000 });
  }

  async getMessageCount(): Promise<number> {
    const messages = await this.page.locator('[data-testid="message"], .message').all();
    return messages.length;
  }
}
