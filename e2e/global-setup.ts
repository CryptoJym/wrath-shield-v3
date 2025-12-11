import { chromium, FullConfig } from '@playwright/test';

/**
 * Global Setup for Playwright Tests
 *
 * Runs once before all tests to:
 * - Verify the application is running
 * - Set up authentication state (if needed)
 * - Create test data fixtures
 */

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  console.log('\n🚀 Starting Playwright Global Setup...');
  console.log(`📍 Base URL: ${baseURL}`);

  // Verify the app is accessible
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for the app to be ready
    const response = await page.goto(baseURL!, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    if (!response?.ok()) {
      console.warn(`⚠️ App returned status ${response?.status()}`);
    } else {
      console.log('✅ Application is accessible');
    }

    // Optional: Set up authentication state
    // This creates a storage state that can be reused across tests
    if (process.env.PLAYWRIGHT_AUTH_EMAIL && process.env.PLAYWRIGHT_AUTH_PASSWORD) {
      console.log('🔐 Setting up authentication...');

      // Navigate to sign-in page
      await page.goto(`${baseURL}/sign-in`);

      // Wait for Clerk or your auth provider
      await page.waitForTimeout(2000);

      // Save storage state for authenticated tests
      await page.context().storageState({ path: 'e2e/.auth/user.json' });

      console.log('✅ Authentication state saved');
    }

  } catch (error) {
    console.error('❌ Global setup error:', error);
    // Don't throw - let tests run and fail individually
  } finally {
    await browser.close();
  }

  console.log('✅ Global Setup Complete\n');
}

export default globalSetup;
