/**
 * Lexia Core5 Reading Scraper
 *
 * Scrapes Lexia Core5 Reading to get student reading progress
 * Uses student credentials provided in .env.local
 */

const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const LEXIA_CREDS = {
  username: process.env.LEXIA_USERNAME || 'hyBrady',
  password: process.env.LEXIA_PASSWORD || 'cga11016',
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeLexia() {
  console.log('=== Lexia Core5 Reading Scraper ===\n');
  console.log('Username:', LEXIA_CREDS.username);

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
    progress: {},
    levels: [],
    units: [],
    scrapedAt: new Date().toISOString(),
  };

  try {
    // ============================================
    // NAVIGATE TO LEXIA
    // ============================================
    console.log('[1] Going to Lexia Core5...');
    await page.goto('https://www.lexiacore5.com', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);
    await page.screenshot({ path: '/tmp/lexia-01-landing.png', fullPage: true });
    console.log('    URL:', page.url());

    // ============================================
    // HANDLE LOGIN
    // ============================================
    console.log('[2] Looking for login form...');

    // Try to find student login
    const studentLoginClicked = await page.evaluate(() => {
      const links = document.querySelectorAll('a, button');
      for (const link of links) {
        const text = link.textContent?.toLowerCase() || '';
        if (text.includes('student') && (text.includes('login') || text.includes('sign'))) {
          link.click();
          return link.textContent;
        }
      }
      return null;
    });

    if (studentLoginClicked) {
      console.log('    Clicked:', studentLoginClicked);
      await delay(2000);
    }

    await page.screenshot({ path: '/tmp/lexia-02-login.png', fullPage: true });
    console.log('    Login URL:', page.url());

    // Try entering credentials
    try {
      // Look for username field
      const usernameField = await page.$('input[type="text"], input[name="username"], input[name="login"], input[id*="user"]');
      if (usernameField) {
        await usernameField.fill(LEXIA_CREDS.username);
        console.log('    Entered username');
      }

      // Look for password field
      const passwordField = await page.$('input[type="password"], input[name="password"]');
      if (passwordField) {
        await passwordField.fill(LEXIA_CREDS.password);
        console.log('    Entered password');
      }

      await delay(1000);
      await page.screenshot({ path: '/tmp/lexia-03-creds.png', fullPage: true });

      // Submit form
      const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Go")');
      if (submitBtn) {
        await submitBtn.click();
        console.log('    Submitted login');
        await delay(5000);
      }

    } catch (e) {
      console.log('    Login form error:', e.message);
    }

    await page.screenshot({ path: '/tmp/lexia-04-after-login.png', fullPage: true });
    console.log('[3] After login URL:', page.url());

    // ============================================
    // EXTRACT STUDENT PROGRESS
    // ============================================
    console.log('[4] Extracting student progress...');

    const pageData = await page.evaluate(() => {
      const body = document.body.innerText;

      // Look for level info
      const levelMatch = body.match(/Level\s*:?\s*(\d+)/i);

      // Look for progress percentage
      const progressMatch = body.match(/(\d+)\s*%/);

      // Look for units completed
      const unitMatch = body.match(/Unit\s*:?\s*(\d+)/i);

      // Look for student name
      const nameMatch = body.match(/(?:Hi|Hello|Welcome)[,\s]+(\w+)/i);

      // Look for skills/activities
      const skillMatches = body.match(/(?:Skill|Activity|Lesson|Unit)\s*[:\d]+[^\n]*/gi) || [];

      return {
        name: nameMatch ? nameMatch[1] : null,
        level: levelMatch ? levelMatch[1] : null,
        progress: progressMatch ? progressMatch[1] : null,
        unit: unitMatch ? unitMatch[1] : null,
        skills: skillMatches,
        fullText: body.substring(0, 3000),
      };
    });

    console.log('    Student:', pageData.name);
    console.log('    Level:', pageData.level);
    console.log('    Progress:', pageData.progress);
    console.log('    Unit:', pageData.unit);

    results.student = {
      name: pageData.name || 'Hyro',
    };
    results.progress = {
      level: pageData.level,
      unit: pageData.unit,
      percent: pageData.progress,
    };
    results.pageText = pageData.fullText;

    // ============================================
    // LOOK FOR DASHBOARD/PROGRESS PAGE
    // ============================================
    console.log('[5] Looking for progress dashboard...');

    // Try clicking progress/dashboard links
    for (const keyword of ['Progress', 'Dashboard', 'My Level', 'My Skills', 'Student']) {
      const clicked = await page.evaluate((kw) => {
        const els = document.querySelectorAll('a, button, [role="tab"], nav *');
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
        await page.screenshot({ path: `/tmp/lexia-05-${keyword.toLowerCase()}.png`, fullPage: true });
        break;
      }
    }

    // ============================================
    // SAVE RESULTS
    // ============================================
    fs.writeFileSync('/tmp/lexia-results.json', JSON.stringify(results, null, 2));
    console.log('\n=== Results saved to /tmp/lexia-results.json ===');
    fs.writeFileSync('/tmp/lexia-page-text.txt', pageData.fullText);

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/lexia-error.png', fullPage: true });
  } finally {
    console.log('\n[Keeping browser open for 30 seconds for manual inspection...]');
    await delay(30000);
    await browser.close();
  }

  return results;
}

scrapeLexia();
