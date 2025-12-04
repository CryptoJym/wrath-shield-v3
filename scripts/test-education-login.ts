/**
 * Test script for education platform login flows
 * Run with: npx ts-node scripts/test-education-login.ts <platform>
 */

import { chromium } from 'playwright';

const PLATFORMS = {
  boost: {
    name: 'Canyon Grove Boost',
    loginUrl: 'https://boost.lifted-management.com',
    googleEmail: process.env.BOOST_GMAIL || 'hyrob11016@canyongrove.com',
    googlePassword: process.env.BOOST_PASSWORD || 'grove123',
  },
  lexia: {
    name: 'Lexia Core5',
    loginUrl: 'https://www.lexiacore5.com',
    username: process.env.LEXIA_USERNAME || 'hyBrady',
    password: process.env.LEXIA_PASSWORD || 'cga11016',
  },
  zearn: {
    name: 'Zearn Math',
    loginUrl: 'https://www.zearn.org/signin',
    studentLoginUrl: 'https://www.zearn.org/student_signin',
    username: process.env.ZEARN_USERNAME || 'HyroBrady2',
    password: process.env.ZEARN_PASSWORD || 'speedymoon87',
    classCode: process.env.ZEARN_CLASS_CODE || 'PP3T6F',
  },
};

async function testBoostLogin() {
  console.log('Testing Boost login with Google OAuth...');
  const browser = await chromium.launch({ headless: false }); // Visible for debugging
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to Boost
    await page.goto(PLATFORMS.boost.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded:', page.url());

    // Take screenshot to see what we're dealing with
    await page.screenshot({ path: '/tmp/boost-1-initial.png', fullPage: true });
    console.log('Screenshot saved: /tmp/boost-1-initial.png');

    // Look for "Sign in with Google" button
    const googleButton = await page.$('button:has-text("Google"), a:has-text("Google"), [data-provider="google"], .google-signin, .social-login-google');
    if (googleButton) {
      console.log('Found Google sign-in button');
      await googleButton.click();
      await page.waitForTimeout(3000);
    } else {
      // List all buttons on the page
      const buttons = await page.$$eval('button, a[role="button"], input[type="submit"]', (els) =>
        els.map(e => ({ text: e.textContent?.trim(), class: e.className, id: e.id }))
      );
      console.log('Available buttons:', buttons);
    }

    await page.screenshot({ path: '/tmp/boost-2-after-click.png', fullPage: true });
    console.log('Screenshot saved: /tmp/boost-2-after-click.png');

    // If we're on Google login page, fill in credentials
    if (page.url().includes('accounts.google.com') || page.url().includes('auth.lifted-management')) {
      console.log('On Google/Auth page:', page.url());

      // Wait for email input
      await page.waitForSelector('input[type="email"], input[name="identifier"]', { timeout: 10000 });
      await page.fill('input[type="email"], input[name="identifier"]', PLATFORMS.boost.googleEmail);
      await page.screenshot({ path: '/tmp/boost-3-email-filled.png', fullPage: true });

      // Click next
      const nextButton = await page.$('#identifierNext, button:has-text("Next"), input[type="submit"]');
      if (nextButton) {
        await nextButton.click();
        await page.waitForTimeout(2000);
      }

      // Wait for password input
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await page.fill('input[type="password"]', PLATFORMS.boost.googlePassword);
      await page.screenshot({ path: '/tmp/boost-4-password-filled.png', fullPage: true });

      // Click sign in
      const signInButton = await page.$('#passwordNext, button:has-text("Sign in"), button:has-text("Next"), input[type="submit"]');
      if (signInButton) {
        await signInButton.click();
        await page.waitForTimeout(5000);
      }
    }

    await page.screenshot({ path: '/tmp/boost-5-final.png', fullPage: true });
    console.log('Final URL:', page.url());
    console.log('Screenshot saved: /tmp/boost-5-final.png');

    // Wait a bit to see result
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: '/tmp/boost-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

async function testLexiaLogin() {
  console.log('Testing Lexia login...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(PLATFORMS.lexia.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded:', page.url());
    await page.screenshot({ path: '/tmp/lexia-1-initial.png', fullPage: true });

    // Find login form elements
    const inputs = await page.$$eval('input', (els) =>
      els.map(e => ({ type: e.type, name: e.name, id: e.id, placeholder: e.placeholder, class: e.className }))
    );
    console.log('Input fields:', inputs);

    // Try to find username field
    const usernameField = await page.$('input[name="username"], input[id="username"], input[placeholder*="username" i], input[type="text"]:first-of-type');
    if (usernameField) {
      await usernameField.fill(PLATFORMS.lexia.username);
      console.log('Filled username');
    }

    // Try to find password field
    const passwordField = await page.$('input[type="password"], input[name="password"], input[id="password"]');
    if (passwordField) {
      await passwordField.fill(PLATFORMS.lexia.password);
      console.log('Filled password');
    }

    await page.screenshot({ path: '/tmp/lexia-2-filled.png', fullPage: true });

    // Click login
    const loginButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
    if (loginButton) {
      await loginButton.click();
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: '/tmp/lexia-3-final.png', fullPage: true });
    console.log('Final URL:', page.url());

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: '/tmp/lexia-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

async function testZearnLogin() {
  console.log('Testing Zearn login...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Try student sign-in page
    await page.goto(PLATFORMS.zearn.studentLoginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded:', page.url());
    await page.screenshot({ path: '/tmp/zearn-1-initial.png', fullPage: true });

    // Find all inputs
    const inputs = await page.$$eval('input', (els) =>
      els.map(e => ({ type: e.type, name: e.name, id: e.id, placeholder: e.placeholder, class: e.className }))
    );
    console.log('Input fields:', inputs);

    // Find all buttons
    const buttons = await page.$$eval('button, a[role="button"], input[type="submit"]', (els) =>
      els.map(e => ({ text: e.textContent?.trim(), class: e.className, id: e.id }))
    );
    console.log('Buttons:', buttons);

    // Look for class code input
    const classCodeInput = await page.$('input[name="class_code"], input[placeholder*="class" i], input[id*="class" i]');
    if (classCodeInput) {
      await classCodeInput.fill(PLATFORMS.zearn.classCode);
      console.log('Filled class code');
    }

    // Look for username
    const usernameInput = await page.$('input[name="username"], input[placeholder*="username" i], input[id*="username" i]');
    if (usernameInput) {
      await usernameInput.fill(PLATFORMS.zearn.username);
      console.log('Filled username');
    }

    // Look for password
    const passwordInput = await page.$('input[type="password"], input[name="password"]');
    if (passwordInput) {
      await passwordInput.fill(PLATFORMS.zearn.password);
      console.log('Filled password');
    }

    await page.screenshot({ path: '/tmp/zearn-2-filled.png', fullPage: true });

    // Click sign in
    const signInButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in")');
    if (signInButton) {
      await signInButton.click();
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: '/tmp/zearn-3-final.png', fullPage: true });
    console.log('Final URL:', page.url());

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: '/tmp/zearn-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

async function inspectPage(url: string, name: string) {
  console.log(`Inspecting ${name} at ${url}...`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded:', page.url());

    // Get all form elements
    const forms = await page.$$eval('form', (els) =>
      els.map(e => ({ action: e.action, method: e.method, id: e.id, class: e.className }))
    );
    console.log('Forms:', forms);

    // Get all inputs
    const inputs = await page.$$eval('input', (els) =>
      els.map(e => ({ type: e.type, name: e.name, id: e.id, placeholder: e.placeholder, class: e.className }))
    );
    console.log('Inputs:', inputs);

    // Get all buttons
    const buttons = await page.$$eval('button, a[role="button"], input[type="submit"], a.btn', (els) =>
      els.map(e => ({
        tag: e.tagName,
        text: e.textContent?.trim().substring(0, 50),
        class: e.className,
        id: e.id,
        href: (e as HTMLAnchorElement).href || ''
      }))
    );
    console.log('Buttons:', buttons);

    await page.screenshot({ path: `/tmp/${name}-inspect.png`, fullPage: true });
    console.log(`Screenshot saved: /tmp/${name}-inspect.png`);

    // Keep browser open for manual inspection
    console.log('Press Ctrl+C to close...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

// Main
const platform = process.argv[2] || 'inspect';

switch (platform) {
  case 'boost':
    testBoostLogin();
    break;
  case 'lexia':
    testLexiaLogin();
    break;
  case 'zearn':
    testZearnLogin();
    break;
  case 'inspect':
    const url = process.argv[3] || 'https://boost.lifted-management.com';
    inspectPage(url, 'page');
    break;
  default:
    console.log('Usage: npx ts-node scripts/test-education-login.ts <boost|lexia|zearn|inspect> [url]');
}
