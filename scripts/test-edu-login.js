/**
 * Test script for education platform login flows
 * Tests the actual login flows that will be used by the scraper
 * Run with: node scripts/test-edu-login.js <boost|zearn|lexia>
 */

const { chromium } = require('playwright');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const PLATFORMS = {
  boost: {
    name: 'Canyon Grove Boost',
    loginUrl: 'https://boost.lifted-management.com',
    googleEmail: process.env.BOOST_GMAIL || process.env.CANYON_GROVE_USERNAME || 'hyrob11016@canyongrove.com',
    googlePassword: process.env.BOOST_PASSWORD || process.env.CANYON_GROVE_PASSWORD || 'grove123',
    loginType: 'google_oauth',
  },
  zearn: {
    name: 'Zearn Math',
    loginUrl: 'https://www.zearn.org',
    username: process.env.ZEARN_USERNAME || 'HyroBrady2',
    password: process.env.ZEARN_PASSWORD || 'speedymoon87',
    loginType: 'multi_step',
  },
  lexia: {
    name: 'Lexia Core5',
    loginUrl: 'https://www.lexiacore5.com',
    username: process.env.LEXIA_USERNAME || 'hyBrady',
    password: process.env.LEXIA_PASSWORD || 'cga11016',
    loginType: 'direct',
  },
};

async function testBoostLogin() {
  console.log('\n=== Testing Boost Login (Google OAuth) ===');
  const config = PLATFORMS.boost;
  console.log(`Email: ${config.googleEmail}`);
  console.log(`Password: ${config.googlePassword ? '*'.repeat(config.googlePassword.length) : 'NOT SET'}`);

  const browser = await chromium.launch({ headless: false }); // Visible for debugging
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to Boost
    console.log('\n[1] Navigating to Boost...');
    await page.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Current URL:', page.url());
    await page.screenshot({ path: '/tmp/boost-test-1-initial.png', fullPage: true });

    // Step 2: Click Google sign-in button
    console.log('\n[2] Looking for Google sign-in button...');
    const googleButton = await page.$('a:has-text("Google"), a.kc-social-item-google, a[href*="broker/google"]');
    if (googleButton) {
      console.log('Found Google button, clicking...');
      await googleButton.click();
      await page.waitForTimeout(3000);
    } else {
      // Check if there's a regular login form instead
      const loginForm = await page.$('#username, input[name="username"]');
      if (loginForm) {
        console.log('Found username/password form, Boost might allow direct login too');
      } else {
        console.log('Could not find Google button or login form');
        const buttons = await page.$$eval('a, button', els =>
          els.map(e => ({ text: e.textContent?.trim().substring(0, 50), href: e.href || '' }))
        );
        console.log('Available buttons/links:', JSON.stringify(buttons.slice(0, 10), null, 2));
      }
    }

    console.log('Current URL after click:', page.url());
    await page.screenshot({ path: '/tmp/boost-test-2-after-google.png', fullPage: true });

    // Step 3: Handle Google login
    if (page.url().includes('accounts.google.com')) {
      console.log('\n[3] On Google login page...');

      // Email
      await page.waitForSelector('input[type="email"], input[name="identifier"]', { timeout: 10000 });
      await page.fill('input[type="email"], input[name="identifier"]', config.googleEmail);
      console.log('Filled email');

      await page.click('#identifierNext, button:has-text("Next")');
      await page.waitForTimeout(2000);

      // Password
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await page.fill('input[type="password"]', config.googlePassword);
      console.log('Filled password');

      await page.screenshot({ path: '/tmp/boost-test-3-password.png', fullPage: true });

      await page.click('#passwordNext, button:has-text("Next"), button:has-text("Sign in")');
      await page.waitForTimeout(5000);
    }

    console.log('\n[4] Final URL:', page.url());
    await page.screenshot({ path: '/tmp/boost-test-4-final.png', fullPage: true });

    // Wait for the app to fully load (SPA)
    await page.waitForTimeout(3000);

    // Check success - look for "Welcome" text or being on boost domain with a code (OAuth success)
    const pageContent = await page.content();
    const url = page.url();
    const hasWelcome = pageContent.includes('Welcome');
    const hasCode = url.includes('code=') && url.includes('boost.lifted-management.com');
    const onBoostDomain = url.includes('boost.lifted-management.com') && !url.includes('auth.lifted-management');

    if (hasWelcome || hasCode || onBoostDomain) {
      console.log('\n SUCCESS: Logged into Boost!');
      console.log('  - Has "Welcome" text:', hasWelcome);
      console.log('  - Has OAuth code:', hasCode);
      console.log('  - On Boost domain:', onBoostDomain);

      // Try to navigate to dashboard/resources
      console.log('\n[5] Looking for assignments/resources...');
      if (pageContent.includes('assignment') || pageContent.includes('resource') || pageContent.includes('search')) {
        console.log('Found dashboard/resource content');
      }

      // Try to explore what resources are available
      console.log('\n[6] Exploring page content...');
      const links = await page.$$eval('a', els =>
        els.map(e => ({ text: e.textContent?.trim().substring(0, 50), href: e.href || '' }))
          .filter(l => l.text && l.href)
          .slice(0, 15)
      );
      console.log('Available links:', JSON.stringify(links, null, 2));
    } else {
      console.log('\n FAILED: Could not log into Boost');
      console.log('Final URL:', page.url());
    }

    // Keep open for inspection
    console.log('\nBrowser will close in 30 seconds...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\nError:', error.message);
    await page.screenshot({ path: '/tmp/boost-test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

async function testZearnLogin() {
  console.log('\n=== Testing Zearn Login ===');
  const config = PLATFORMS.zearn;
  console.log(`Username: ${config.username}`);
  console.log(`Password: ${config.password ? '*'.repeat(config.password.length) : 'NOT SET'}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to Zearn
    console.log('\n[1] Navigating to Zearn...');
    await page.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Current URL:', page.url());
    await page.screenshot({ path: '/tmp/zearn-test-1-initial.png', fullPage: true });

    // Step 2: Click Sign In link
    console.log('\n[2] Looking for Sign In link...');
    const signInLink = await page.$('a:has-text("Sign In"), a[href*="signin"]');
    if (signInLink) {
      console.log('Found Sign In link, clicking...');
      await signInLink.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('Could not find Sign In link');
    }

    console.log('Current URL:', page.url());
    await page.screenshot({ path: '/tmp/zearn-test-2-signin.png', fullPage: true });

    // Step 3: Fill login form
    console.log('\n[3] Looking for login form...');

    // Username
    const usernameInput = await page.$('#user_login_field, input[name="user[login]"]');
    if (usernameInput) {
      await usernameInput.fill(config.username);
      console.log('Filled username');
    } else {
      console.log('Could not find username field');
      const inputs = await page.$$eval('input', els =>
        els.map(e => ({ id: e.id, name: e.name, type: e.type, placeholder: e.placeholder }))
      );
      console.log('Available inputs:', JSON.stringify(inputs, null, 2));
    }

    // Password
    const passwordInput = await page.$('#user_password_field, input[name="user[password]"], input[type="password"]');
    if (passwordInput) {
      await passwordInput.fill(config.password);
      console.log('Filled password');
    }

    await page.screenshot({ path: '/tmp/zearn-test-3-filled.png', fullPage: true });

    // Step 4: Submit
    console.log('\n[4] Submitting login...');
    const submitButton = await page.$('button:has-text("Sign in"), input[type="submit"], button[type="submit"]');
    if (submitButton) {
      await submitButton.click();
      await page.waitForTimeout(5000);
    }

    console.log('\n[5] Final URL:', page.url());
    await page.screenshot({ path: '/tmp/zearn-test-4-final.png', fullPage: true });

    // Check success
    if (page.url().includes('/student') || page.url().includes('/home')) {
      console.log('\n SUCCESS: Logged into Zearn!');
    } else {
      console.log('\n FAILED or needs verification');
      // Check for error messages
      const errorText = await page.$eval('.error, .alert, [role="alert"]', el => el.textContent).catch(() => null);
      if (errorText) {
        console.log('Error message:', errorText);
      }
    }

    console.log('\nBrowser will close in 30 seconds...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\nError:', error.message);
    await page.screenshot({ path: '/tmp/zearn-test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

async function testLexiaLogin() {
  console.log('\n=== Testing Lexia Login ===');
  const config = PLATFORMS.lexia;
  console.log(`Username: ${config.username}`);
  console.log(`Password: ${config.password ? '*'.repeat(config.password.length) : 'NOT SET'}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to Lexia
    console.log('\n[1] Navigating to Lexia...');
    await page.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Current URL:', page.url());
    await page.screenshot({ path: '/tmp/lexia-test-1-initial.png', fullPage: true });

    // Check for unsupported browser
    if (page.url().includes('unsupportedBrowser')) {
      console.log('\n WARNING: Lexia redirected to unsupported browser page');
      console.log('Lexia may need to be accessed via Boost Resources tab');

      // Try with different user agent
      console.log('\nTrying with Chrome user agent...');
      await context.close();

      const newContext = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const newPage = await newContext.newPage();
      await newPage.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
      console.log('URL with Chrome UA:', newPage.url());
      await newPage.screenshot({ path: '/tmp/lexia-test-chrome-ua.png', fullPage: true });

      if (newPage.url().includes('unsupportedBrowser')) {
        console.log('Still redirected to unsupported browser page');
        console.log('Lexia must be accessed via Boost Resources tab');
      }

      await newContext.close();
    } else {
      // Try to login
      console.log('\n[2] Looking for login form...');

      const usernameInput = await page.$('input[name="username"], input[id="username"], input[type="text"]');
      if (usernameInput) {
        await usernameInput.fill(config.username);
        console.log('Filled username');
      }

      const passwordInput = await page.$('input[type="password"]');
      if (passwordInput) {
        await passwordInput.fill(config.password);
        console.log('Filled password');
      }

      await page.screenshot({ path: '/tmp/lexia-test-2-filled.png', fullPage: true });

      const submitButton = await page.$('button[type="submit"], input[type="submit"]');
      if (submitButton) {
        await submitButton.click();
        await page.waitForTimeout(5000);
      }

      console.log('\nFinal URL:', page.url());
      await page.screenshot({ path: '/tmp/lexia-test-3-final.png', fullPage: true });
    }

    console.log('\nBrowser will close in 30 seconds...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\nError:', error.message);
    await page.screenshot({ path: '/tmp/lexia-test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

// Main
const platform = process.argv[2] || 'boost';

console.log('Education Platform Login Tester');
console.log('================================');
console.log(`Testing: ${platform}`);
console.log('');

switch (platform.toLowerCase()) {
  case 'boost':
    testBoostLogin();
    break;
  case 'zearn':
    testZearnLogin();
    break;
  case 'lexia':
    testLexiaLogin();
    break;
  case 'all':
    (async () => {
      await testBoostLogin();
      await testZearnLogin();
      await testLexiaLogin();
    })();
    break;
  default:
    console.log('Usage: node scripts/test-edu-login.js <boost|zearn|lexia|all>');
}
