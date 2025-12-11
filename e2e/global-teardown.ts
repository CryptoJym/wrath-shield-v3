import { FullConfig } from '@playwright/test';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Global Teardown for Playwright Tests
 *
 * Runs once after all tests to:
 * - Clean up test artifacts
 * - Reset any global state
 * - Generate summary reports
 */

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Starting Playwright Global Teardown...');

  // Clean up temporary test data (if any)
  const tempTestDir = join(process.cwd(), '.data', 'test', 'e2e');
  if (existsSync(tempTestDir)) {
    try {
      rmSync(tempTestDir, { recursive: true });
      console.log('✅ Cleaned up temporary test data');
    } catch (error) {
      console.warn('⚠️ Could not clean temp data:', error);
    }
  }

  // Log test completion
  console.log('✅ Global Teardown Complete');
  console.log('📊 View report: npx playwright show-report\n');
}

export default globalTeardown;
