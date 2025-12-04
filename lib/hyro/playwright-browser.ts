/**
 * Playwright Browser Automation Module
 *
 * Provides robust browser automation for education platform scraping using Playwright.
 * Playwright offers better reliability and modern browser support compared to Puppeteer.
 */

import { ensureServerOnly } from '../server-only-guard';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

ensureServerOnly('lib/hyro/playwright-browser');

// Browser instance for reuse
let browserInstance: Browser | null = null;

// Browser launch options
const BROWSER_OPTIONS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
  ],
};

// Default viewport
const DEFAULT_VIEWPORT = {
  width: 1920,
  height: 1080,
};

// Default user agent
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Get or create browser instance
 */
export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    console.log('[PlaywrightBrowser] Launching new browser instance');
    browserInstance = await chromium.launch(BROWSER_OPTIONS);
  }
  return browserInstance;
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    console.log('[PlaywrightBrowser] Closing browser instance');
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Create a new browser context with default settings
 */
export async function createContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return browser.newContext({
    viewport: DEFAULT_VIEWPORT,
    userAgent: DEFAULT_USER_AGENT,
    acceptDownloads: true,
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  });
}

/**
 * Create a new page with default settings
 */
export async function createPage(): Promise<{ page: Page; context: BrowserContext }> {
  const context = await createContext();
  const page = await context.newPage();

  // Set default timeout
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);

  return { page, context };
}

/**
 * Safe text extraction from element
 */
export async function safeGetText(page: Page, selector: string, defaultValue = ''): Promise<string> {
  try {
    const element = await page.$(selector);
    if (!element) return defaultValue;
    const text = await element.textContent();
    return text?.trim() || defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Safe attribute extraction from element
 */
export async function safeGetAttribute(page: Page, selector: string, attr: string, defaultValue = ''): Promise<string> {
  try {
    const element = await page.$(selector);
    if (!element) return defaultValue;
    const value = await element.getAttribute(attr);
    return value || defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Wait for element and get text
 */
export async function waitAndGetText(page: Page, selector: string, timeout = 10000): Promise<string | null> {
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    return await safeGetText(page, selector);
  } catch {
    return null;
  }
}

/**
 * Safe click with wait
 */
export async function safeClick(page: Page, selector: string, timeout = 10000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    await page.click(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe type with wait
 */
export async function safeType(page: Page, selector: string, text: string, timeout = 10000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    await page.fill(selector, text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Take screenshot for debugging
 */
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const path = `/tmp/${name}-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`[PlaywrightBrowser] Screenshot saved to ${path}`);
  return path;
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(page: Page, timeout = 15000): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // Navigation timeout is acceptable, page might already be loaded
  }
}

/**
 * Check if element exists
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    const element = await page.$(selector);
    return element !== null;
  } catch {
    return false;
  }
}

/**
 * Get all matching elements' text content
 */
export async function getAllTexts(page: Page, selector: string): Promise<string[]> {
  try {
    const elements = await page.$$(selector);
    const texts: string[] = [];
    for (const element of elements) {
      const text = await element.textContent();
      if (text?.trim()) {
        texts.push(text.trim());
      }
    }
    return texts;
  } catch {
    return [];
  }
}

/**
 * Extract data from multiple elements matching a pattern
 */
export async function extractFromElements<T>(
  page: Page,
  containerSelector: string,
  extractor: (element: any, index: number) => Promise<T | null>
): Promise<T[]> {
  const results: T[] = [];
  try {
    const elements = await page.$$(containerSelector);
    for (let i = 0; i < elements.length; i++) {
      const data = await extractor(elements[i], i);
      if (data !== null) {
        results.push(data);
      }
    }
  } catch (error) {
    console.warn(`[PlaywrightBrowser] Error extracting from elements: ${error}`);
  }
  return results;
}

// Export types for consumers
export type { Browser, BrowserContext, Page };
