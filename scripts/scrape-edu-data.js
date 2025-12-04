/**
 * Education Data Scraper & ZEP Memory Sync
 *
 * Scrapes Hyro's education platforms and stores data in ZEP memory:
 * - Zearn Math: Lessons, progress, completed work
 * - Boost: Resources available
 *
 * Also generates a curriculum progress report.
 *
 * Run with: node scripts/scrape-edu-data.js
 */

const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.local' });

// Platform credentials
const PLATFORMS = {
  zearn: {
    name: 'Zearn Math',
    loginUrl: 'https://www.zearn.org',
    username: process.env.ZEARN_USERNAME || 'HyroBrady2',
    password: process.env.ZEARN_PASSWORD || 'speedymoon87',
  },
  boost: {
    name: 'Canyon Grove Boost',
    loginUrl: 'https://boost.lifted-management.com',
    googleEmail: process.env.BOOST_GMAIL || 'hyrob11016@canyongrove.com',
    googlePassword: process.env.BOOST_PASSWORD || 'grove123',
  },
};

// Collected data
const scrapedData = {
  zearn: {
    lessons: [],
    progress: {},
    completedWork: [],
  },
  boost: {
    resources: [],
    activities: [],
  },
  syncedAt: new Date().toISOString(),
};

/**
 * Scrape Zearn Math dashboard
 */
async function scrapeZearn(browser) {
  console.log('\n=== Scraping Zearn Math ===');
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login to Zearn
    console.log('[1] Logging in to Zearn...');
    await page.goto(PLATFORMS.zearn.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Fill login form (directly on main page)
    await page.fill('#user_login_field, input[name="user[login]"]', PLATFORMS.zearn.username);
    await page.fill('#user_password_field, input[name="user[password]"]', PLATFORMS.zearn.password);
    await page.click('button:has-text("Sign in"), input[type="submit"], button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForTimeout(5000);
    console.log('[2] Logged in, URL:', page.url());

    // Check if login succeeded
    const pageContent = await page.content();
    if (!pageContent.includes('Sign Out') && !pageContent.includes('Next Up') && !pageContent.includes('Math Library')) {
      console.log('Login may have failed, checking...');
      await page.screenshot({ path: '/tmp/zearn-scrape-check.png', fullPage: true });
    }

    // Extract lessons and progress from dashboard
    console.log('[3] Extracting lesson data...');

    // Get current working lesson from the header
    const currentLesson = await page.$eval('body', body => {
      // Look for "You're currently working on:" text
      const text = body.innerText;
      const currentMatch = text.match(/You're currently working on[:\s]+([^\n]+)/i);
      if (currentMatch) {
        return {
          title: currentMatch[1].trim(),
          status: 'in_progress',
          type: 'current',
        };
      }
      return null;
    }).catch(() => null);

    if (currentLesson) {
      console.log('  - Current lesson:', currentLesson.title);
      scrapedData.zearn.lessons.push(currentLesson);
    }

    // Extract all lesson cards by looking at the page structure directly
    // The page has cards with "Lesson X" and status info
    const lessonData = await page.evaluate(() => {
      const lessons = [];
      const body = document.body.innerText;

      // Parse "Lesson Unlocked!" blocks
      const unlockedMatch = body.match(/Lesson Unlocked![\s\S]*?Lesson\s+(\d+)\s+([^\n]+)/gi);
      if (unlockedMatch) {
        unlockedMatch.forEach(match => {
          const lessonMatch = match.match(/Lesson\s+(\d+)\s+([^\n]+)/i);
          if (lessonMatch) {
            lessons.push({
              lessonNumber: parseInt(lessonMatch[1]),
              title: lessonMatch[2].trim(),
              status: 'unlocked',
              type: 'lesson',
            });
          }
        });
      }

      // Parse "Lesson Complete!" blocks
      const completeMatch = body.match(/Lesson Complete![\s\S]*?Lesson\s+(\d+)\s+([^\n]+)/gi);
      if (completeMatch) {
        completeMatch.forEach(match => {
          const lessonMatch = match.match(/Lesson\s+(\d+)\s+([^\n]+)/i);
          if (lessonMatch) {
            lessons.push({
              lessonNumber: parseInt(lessonMatch[1]),
              title: lessonMatch[2].trim(),
              status: 'completed',
              type: 'lesson',
            });
          }
        });
      }

      // Look for completed activities
      const completedActivities = [];
      if (body.includes('TOWER OF POWER') && body.includes('COMPLETED!')) {
        completedActivities.push({ name: 'Tower of Power', status: 'completed' });
      }
      if (body.includes('math') && body.includes('chat') && body.includes('COMPLETED!')) {
        completedActivities.push({ name: 'Math Chat', status: 'completed' });
      }

      // Extract student name and class
      const studentMatch = body.match(/Hi\s+(\w+)/i);
      const classMatch = body.match(/SJ\s+([^\n]+)/i);

      return {
        lessons,
        completedActivities,
        studentName: studentMatch ? studentMatch[1] : null,
        classInfo: classMatch ? classMatch[1].trim() : null,
      };
    });

    console.log(`  - Found ${lessonData.lessons.length} lessons`);
    lessonData.lessons.forEach(l => {
      console.log(`    - Lesson ${l.lessonNumber}: ${l.title} [${l.status}]`);
    });
    scrapedData.zearn.lessons.push(...lessonData.lessons);

    console.log(`  - Found ${lessonData.completedActivities.length} completed activities`);
    lessonData.completedActivities.forEach(a => {
      console.log(`    - ${a.name} [${a.status}]`);
    });
    scrapedData.zearn.completedWork.push(...lessonData.completedActivities);

    // Store student/class info
    scrapedData.zearn.progress = {
      studentName: lessonData.studentName,
      classInfo: lessonData.classInfo,
      lessonsCompleted: lessonData.lessons.filter(l => l.status === 'completed').length,
      lessonsUnlocked: lessonData.lessons.filter(l => l.status === 'unlocked').length,
      activitiesCompleted: lessonData.completedActivities.length,
    };
    console.log('  - Progress:', scrapedData.zearn.progress);

    // Take final screenshot for verification
    await page.screenshot({ path: '/tmp/zearn-scraped.png', fullPage: true });
    console.log('[4] Zearn scrape complete');

    // Try to get more detailed info from math library
    console.log('[5] Checking Math Library...');
    const mathLibraryLink = await page.$('a:has-text("Math Library"), [href*="library"]');
    if (mathLibraryLink) {
      await mathLibraryLink.click();
      await page.waitForTimeout(3000);

      const libraryContent = await page.$$eval('.grade, .module, .topic, [class*="grade"]', items => {
        return items.map(item => ({
          name: item.textContent?.trim().substring(0, 100),
        })).filter(i => i.name);
      }).catch(() => []);

      if (libraryContent.length > 0) {
        console.log(`  - Math Library has ${libraryContent.length} items`);
        scrapedData.zearn.progress.libraryItems = libraryContent.length;
      }
    }

  } catch (error) {
    console.error('Zearn scrape error:', error.message);
    await page.screenshot({ path: '/tmp/zearn-scrape-error.png', fullPage: true });
  } finally {
    await context.close();
  }
}

/**
 * Scrape Boost resources
 */
async function scrapeBoost(browser) {
  console.log('\n=== Scraping Boost Resources ===');
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to Boost
    console.log('[1] Navigating to Boost...');
    await page.goto(PLATFORMS.boost.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Click Google sign-in
    console.log('[2] Looking for Google sign-in...');
    const googleButton = await page.$('a:has-text("Google"), a.kc-social-item-google, a[href*="broker/google"]');
    if (googleButton) {
      await googleButton.click();
      await page.waitForTimeout(3000);
    }

    // Handle Google OAuth if on Google page
    if (page.url().includes('accounts.google.com')) {
      console.log('[3] Handling Google OAuth...');

      // Email
      await page.waitForSelector('input[type="email"], input[name="identifier"]', { timeout: 10000 });
      await page.fill('input[type="email"], input[name="identifier"]', PLATFORMS.boost.googleEmail);
      await page.click('#identifierNext, button:has-text("Next")');
      await page.waitForTimeout(2000);

      // Password
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await page.fill('input[type="password"]', PLATFORMS.boost.googlePassword);
      await page.click('#passwordNext, button:has-text("Next"), button:has-text("Sign in")');
      await page.waitForTimeout(5000);
    }

    console.log('[4] Post-login URL:', page.url());

    // Wait for Boost dashboard to load
    await page.waitForTimeout(3000);

    // Check if we're logged in
    const pageContent = await page.content();
    if (pageContent.includes('Welcome')) {
      console.log('[5] Successfully logged into Boost!');

      // Extract available resources/links
      const resources = await page.$$eval('a', els => {
        return els.map(el => ({
          text: el.textContent?.trim().substring(0, 100),
          href: el.href,
        })).filter(r => r.text && r.href && !r.href.includes('javascript'));
      });

      console.log(`  - Found ${resources.length} links/resources`);

      // Filter for educational resources
      const eduResources = resources.filter(r => {
        const text = r.text.toLowerCase();
        return text.includes('lexia') ||
               text.includes('zearn') ||
               text.includes('math') ||
               text.includes('reading') ||
               text.includes('lesson') ||
               text.includes('activity') ||
               text.includes('resource');
      });

      console.log(`  - ${eduResources.length} appear to be educational`);
      scrapedData.boost.resources = eduResources;

      // Try to explore the search/browse functionality
      const searchInput = await page.$('input[type="search"], input[placeholder*="search" i]');
      if (searchInput) {
        console.log('[6] Searching for activities...');
        await searchInput.fill('math');
        await page.waitForTimeout(2000);

        const searchResults = await page.$$eval('[class*="result"], [class*="item"], [class*="card"]', items => {
          return items.map(item => ({
            title: item.querySelector('h2, h3, h4, .title')?.textContent?.trim(),
            description: item.querySelector('p, .description')?.textContent?.trim()?.substring(0, 200),
          })).filter(i => i.title);
        }).catch(() => []);

        console.log(`  - Search returned ${searchResults.length} results`);
        scrapedData.boost.activities = searchResults;
      }

      await page.screenshot({ path: '/tmp/boost-scraped.png', fullPage: true });
    } else {
      console.log('[5] May not be fully logged in');
      await page.screenshot({ path: '/tmp/boost-scrape-check.png', fullPage: true });
    }

    console.log('[7] Boost scrape complete');

  } catch (error) {
    console.error('Boost scrape error:', error.message);
    await page.screenshot({ path: '/tmp/boost-scrape-error.png', fullPage: true });
  } finally {
    await context.close();
  }
}

/**
 * Generate curriculum progress report
 */
function generateProgressReport() {
  console.log('\n=== Curriculum Progress Report ===');
  console.log('Generated:', scrapedData.syncedAt);
  console.log('');

  // Zearn progress
  console.log('ZEARN MATH:');
  console.log('-----------');
  if (scrapedData.zearn.lessons.length > 0) {
    scrapedData.zearn.lessons.forEach((lesson, i) => {
      const status = lesson.status || lesson.type || 'unknown';
      console.log(`  ${i + 1}. ${lesson.title || 'Untitled'} [${status}]`);
    });
  } else {
    console.log('  No lessons found');
  }

  if (Object.keys(scrapedData.zearn.progress).length > 0) {
    console.log('');
    console.log('  Progress Metrics:');
    Object.entries(scrapedData.zearn.progress).forEach(([key, value]) => {
      console.log(`    - ${key}: ${value}`);
    });
  }

  if (scrapedData.zearn.completedWork.length > 0) {
    console.log('');
    console.log('  Completed Work:');
    scrapedData.zearn.completedWork.forEach((work, i) => {
      console.log(`    ${i + 1}. ${work.title}${work.completedAt ? ` (${work.completedAt})` : ''}`);
    });
  }

  // Boost resources
  console.log('');
  console.log('BOOST RESOURCES:');
  console.log('----------------');
  if (scrapedData.boost.resources.length > 0) {
    scrapedData.boost.resources.slice(0, 10).forEach((resource, i) => {
      console.log(`  ${i + 1}. ${resource.text}`);
    });
    if (scrapedData.boost.resources.length > 10) {
      console.log(`  ... and ${scrapedData.boost.resources.length - 10} more`);
    }
  } else {
    console.log('  No resources found');
  }

  if (scrapedData.boost.activities.length > 0) {
    console.log('');
    console.log('  Math Activities:');
    scrapedData.boost.activities.slice(0, 5).forEach((activity, i) => {
      console.log(`    ${i + 1}. ${activity.title}`);
      if (activity.description) {
        console.log(`       ${activity.description.substring(0, 80)}...`);
      }
    });
  }

  console.log('');
  console.log('=================================');

  return scrapedData;
}

/**
 * Store data in ZEP memory via API
 */
async function storeInZepMemory() {
  console.log('\n=== Storing in ZEP Memory ===');

  // We'll call the API endpoint to store the data
  // The endpoint uses the education-memory module internally

  const eduData = {
    platform: 'sync',
    subject: 'all',
    data: scrapedData,
    timestamp: new Date().toISOString(),
  };

  try {
    // Try to call the hyro education sync API if the server is running
    const response = await fetch('http://localhost:4242/api/hyro/education/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eduData),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('ZEP sync result:', result);
    } else {
      console.log('API sync failed, will store directly');
      // Fall back to writing a JSON file that can be imported later
      const fs = require('fs');
      const outputPath = '/tmp/hyro-education-data.json';
      fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2));
      console.log(`Data saved to ${outputPath}`);
    }
  } catch (error) {
    console.log('Could not reach API, saving to file instead');
    const fs = require('fs');
    const outputPath = '/tmp/hyro-education-data.json';
    fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2));
    console.log(`Data saved to ${outputPath}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Hyro Education Data Scraper');
  console.log('===========================');
  console.log('');

  const browser = await chromium.launch({ headless: false }); // Visible for debugging

  try {
    // Scrape both platforms
    await scrapeZearn(browser);
    await scrapeBoost(browser);

    // Generate report
    generateProgressReport();

    // Store in ZEP
    await storeInZepMemory();

    console.log('\nScraping complete!');
    console.log('Screenshots saved to /tmp/');
    console.log('Data saved to /tmp/hyro-education-data.json');

  } catch (error) {
    console.error('Main error:', error);
  } finally {
    await browser.close();
  }
}

// Run
main();
