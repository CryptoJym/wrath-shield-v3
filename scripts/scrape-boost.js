/**
 * Boost Learning Scraper
 *
 * Scrapes Boost Learning to get class progress and compare with Hyro's progress
 * Uses Google OAuth via the school's Keycloak auth
 */

const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const BOOST_CREDS = {
  // Credentials for Boost Learning via Canyon Grove
  username: 'hyrob11016',
  email: process.env.BOOST_GMAIL || 'hyrob11016@canyongrove.com',
  password: process.env.BOOST_PASSWORD || 'grove123',
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeBoost() {
  console.log('=== Boost Learning Scraper ===\n');
  console.log('Email:', BOOST_CREDS.email);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  const results = {
    student: {},
    classProgress: {},
    curriculum: {},
    assignments: [],
    schedule: [],
    pageText: '',
    scrapedAt: new Date().toISOString(),
  };

  try {
    // ============================================
    // START FROM CANYON GROVE WEBSITE
    // ============================================
    console.log('[1] Going to Canyon Grove website...');
    await page.goto('https://www.canyongrove.com', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);
    await page.screenshot({ path: '/tmp/boost-01-canyongrove.png', fullPage: true });
    console.log('    URL:', page.url());

    // ============================================
    // FIND AND CLICK BOOST LOGIN LINK
    // ============================================
    console.log('[2] Looking for Boost Login link...');

    // Look for Boost link on the page
    const boostLink = await page.$('a:has-text("Boost"), a[href*="boost"], a:has-text("Student Login"), a:has-text("Login")');
    if (boostLink) {
      const href = await boostLink.getAttribute('href');
      console.log('    Found Boost link:', href);
      await boostLink.click();
      await delay(3000);
    } else {
      // Try to find it in navigation or footer
      console.log('    Looking in navigation...');
      const allLinks = await page.$$eval('a', links => links.map(l => ({ text: l.textContent?.trim(), href: l.href })));
      console.log('    Available links:', allLinks.filter(l => l.text && l.text.length < 30).slice(0, 20));

      // Try direct navigation to common Boost URLs
      console.log('[2b] Trying direct Boost URL...');
      await page.goto('https://boost.canyongrove.com', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      if (!page.url().includes('boost')) {
        await page.goto('https://canyongrove.boostlearning.com', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      }
    }

    await page.screenshot({ path: '/tmp/boost-02-after-click.png', fullPage: true });
    console.log('    Current URL:', page.url());

    // ============================================
    // HANDLE LOGIN
    // ============================================
    console.log('[3] Handling login...');
    console.log('    Username:', BOOST_CREDS.username);
    console.log('    Password:', BOOST_CREDS.password);

    // Wait for any login form to appear
    await delay(2000);

    // Try to fill in login credentials
    try {
      // Look for various username field patterns
      const usernameSelectors = [
        'input[name="Username"]',
        'input[name="username"]',
        'input[id="Username"]',
        'input[id="username"]',
        'input[name="email"]',
        'input[type="email"]',
        'input[type="text"]:first-of-type',
        'input[placeholder*="user"]',
        'input[placeholder*="email"]'
      ];

      let usernameField = null;
      for (const sel of usernameSelectors) {
        usernameField = await page.$(sel);
        if (usernameField) {
          console.log('    Found username field:', sel);
          break;
        }
      }

      if (usernameField) {
        await usernameField.fill(BOOST_CREDS.username);
        console.log('    Entered username');
        await delay(500);
      }

      // Fill in password
      const passwordField = await page.$('input[type="password"]');
      if (passwordField) {
        await passwordField.fill(BOOST_CREDS.password);
        console.log('    Entered password');
        await delay(500);
      }

      await page.screenshot({ path: '/tmp/boost-03-login-filled.png', fullPage: true });

      // Click the login button
      const loginSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign In")',
        'button:has-text("Log In")',
        'input[value="Login"]',
        'input[value="Sign In"]'
      ];

      for (const sel of loginSelectors) {
        const loginBtn = await page.$(sel);
        if (loginBtn) {
          console.log('    Clicking login button:', sel);
          await loginBtn.click();
          break;
        }
      }

      await delay(5000);
      await page.screenshot({ path: '/tmp/boost-04-after-login.png', fullPage: true });
      console.log('[4] After login URL:', page.url());

    } catch (e) {
      console.log('    Login form error:', e.message);
    }

    // Wait for main app to load
    await delay(5000);
    await page.screenshot({ path: '/tmp/boost-05-dashboard.png', fullPage: true });
    console.log('[4] Dashboard URL:', page.url());

    // ============================================
    // EXTRACT STUDENT INFO
    // ============================================
    console.log('[5] Extracting student info...');

    const pageData = await page.evaluate(() => {
      const body = document.body.innerText;
      const html = document.body.innerHTML;

      // Extract student name
      const nameMatch = body.match(/(?:Hi|Hello|Welcome),?\s*(\w+)/i);

      // Look for class/grade info
      const classMatch = body.match(/(?:Class|Grade|Room)\s*:?\s*([^\n]+)/i);

      // Look for curriculum/schedule
      const curriculumMatch = body.match(/(?:Current|This Week|Schedule)[^\n]*/gi) || [];

      // Look for progress percentages
      const progressMatch = body.match(/\d+\s*%/g) || [];

      // Look for lessons/units
      const lessonMatches = body.match(/(?:Lesson|Unit|Chapter)\s*\d+[^\n]*/gi) || [];

      return {
        name: nameMatch ? nameMatch[1] : null,
        class: classMatch ? classMatch[1].trim() : null,
        curriculum: curriculumMatch,
        progress: progressMatch,
        lessons: lessonMatches,
        fullText: body,
      };
    });

    console.log('    Student:', pageData.name);
    console.log('    Class:', pageData.class);
    console.log('    Progress indicators:', pageData.progress);
    console.log('    Lessons found:', pageData.lessons.slice(0, 5));

    results.student = {
      name: pageData.name,
      class: pageData.class,
    };
    results.pageText = pageData.fullText;
    results.curriculum = {
      current: pageData.curriculum,
      lessons: pageData.lessons,
    };

    // ============================================
    // LOOK FOR CLASS SCHEDULE OR PROGRESS
    // ============================================
    console.log('[6] Looking for class schedule/curriculum...');

    // Try to click on schedule/curriculum links
    const navLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a, button, [role="button"], [role="tab"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length < 50) {
          links.push({ text, href: el.getAttribute('href') });
        }
      });
      return links;
    });

    console.log('    Navigation links:');
    navLinks.slice(0, 15).forEach(l => console.log(`      - ${l.text}`));

    // Click on curriculum/schedule if available
    for (const keyword of ['Schedule', 'Curriculum', 'Progress', 'Class', 'Dashboard', 'Home']) {
      const clicked = await page.evaluate((kw) => {
        const els = document.querySelectorAll('a, button, [role="tab"]');
        for (const el of els) {
          if (el.textContent?.toLowerCase().includes(kw.toLowerCase())) {
            el.click();
            return el.textContent;
          }
        }
        return null;
      }, keyword);

      if (clicked) {
        console.log(`    Clicked: ${clicked}`);
        await delay(2000);
        await page.screenshot({ path: `/tmp/boost-06-${keyword.toLowerCase()}.png`, fullPage: true });

        // Get content after navigation
        const content = await page.evaluate(() => document.body.innerText.substring(0, 2000));
        console.log(`    Content: ${content.substring(0, 300)}...`);
        break;
      }
    }

    // ============================================
    // SAVE RESULTS
    // ============================================
    fs.writeFileSync('/tmp/boost-results.json', JSON.stringify(results, null, 2));
    console.log('\n=== Results saved to /tmp/boost-results.json ===');

    // Save page text for analysis
    fs.writeFileSync('/tmp/boost-page-text.txt', results.pageText);

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/boost-error.png', fullPage: true });
  } finally {
    console.log('\n[Keeping browser open for 30 seconds for manual inspection...]');
    await delay(30000);
    await browser.close();
  }

  return results;
}

scrapeBoost();
