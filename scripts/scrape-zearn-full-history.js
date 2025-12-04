/**
 * FULL Zearn History Scraper
 *
 * Actually navigates the site to get:
 * - All badges earned
 * - All completed missions/modules
 * - Full lesson history
 * - Calendar view
 * - Submissions
 */

const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.local' });

const ZEARN_CREDS = {
  username: process.env.ZEARN_USERNAME || 'HyroBrady2',
  password: process.env.ZEARN_PASSWORD || 'speedymoon87',
};

const fullHistory = {
  student: {},
  badges: [],
  completedMissions: [],
  currentMission: {},
  calendar: [],
  submissions: [],
  mathLibrary: {},
  allProgress: {},
  scrapedAt: new Date().toISOString(),
};

async function scrapeZearnFullHistory() {
  console.log('=== FULL Zearn History Scraper ===\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('[1] Logging in...');
    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#user_login_field, input[name="user[login]"]', ZEARN_CREDS.username);
    await page.fill('#user_password_field, input[name="user[password]"]', ZEARN_CREDS.password);
    await page.click('button:has-text("Sign in"), input[type="submit"]');
    await page.waitForTimeout(5000);
    console.log('    Logged in, URL:', page.url());

    // Get student info from main page
    const studentInfo = await page.evaluate(() => {
      const body = document.body.innerText;
      const nameMatch = body.match(/Hi\s+(\w+)/i);
      const classMatch = body.match(/SJ\s+([^\n]+)/i);
      return {
        name: nameMatch ? nameMatch[1] : null,
        class: classMatch ? classMatch[1] : null,
      };
    });
    fullHistory.student = studentInfo;
    console.log('    Student:', studentInfo.name, '- Class:', studentInfo.class);

    // ============================================
    // NAVIGATE TO BADGES PAGE
    // ============================================
    console.log('\n[2] Navigating to BADGES page...');

    // Click on Badges in the menu
    try {
      await page.click('text=Badges');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/zearn-badges-page.png', fullPage: true });

      const badgesData = await page.evaluate(() => {
        const body = document.body.innerText;
        const html = document.body.innerHTML;

        // Get all badge elements
        const badges = [];
        const badgeElements = document.querySelectorAll('[class*="badge"], [class*="award"], .achievement, [data-badge]');
        badgeElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length < 200) {
            badges.push(text);
          }
        });

        // Look for badge counts
        const badgeCountMatch = body.match(/(\d+)\s*badges?/i);

        // Look for specific badge types
        const missionBadges = (body.match(/Mission\s+\d+\s+Complete/gi) || []);
        const streakBadges = (body.match(/\d+\s*Day\s*Streak/gi) || []);

        return {
          badges,
          badgeCount: badgeCountMatch ? parseInt(badgeCountMatch[1]) : 0,
          missionBadges,
          streakBadges,
          pageText: body,
        };
      });

      console.log('    Badge count:', badgesData.badgeCount);
      console.log('    Mission badges:', badgesData.missionBadges);
      console.log('    Streak badges:', badgesData.streakBadges);
      console.log('    Page text snippet:', badgesData.pageText.substring(0, 500));
      fullHistory.badges = badgesData;
    } catch (e) {
      console.log('    Error on badges page:', e.message);
    }

    // ============================================
    // NAVIGATE TO MATH LIBRARY
    // ============================================
    console.log('\n[3] Navigating to MATH LIBRARY...');

    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    try {
      await page.click('text=Math Library');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/zearn-math-library.png', fullPage: true });

      const libraryData = await page.evaluate(() => {
        const body = document.body.innerText;

        // Get all grade/mission info
        const missions = [];
        const missionMatches = body.match(/(?:G\d+\s*)?Mission\s+\d+[^\n]*/gi) || [];
        missionMatches.forEach(m => missions.push(m.trim()));

        // Look for grade info
        const gradeMatches = body.match(/Grade\s+\d+/gi) || [];

        // Look for completed indicators
        const completedMissions = [];
        const completeMatches = body.match(/Mission\s+\d+[^\.]*(?:Complete|100%)/gi) || [];
        completeMatches.forEach(m => completedMissions.push(m.trim()));

        return {
          missions,
          grades: gradeMatches,
          completedMissions,
          pageText: body,
        };
      });

      console.log('    Missions found:', libraryData.missions.slice(0, 10));
      console.log('    Completed missions:', libraryData.completedMissions);
      console.log('    Grades:', libraryData.grades);
      fullHistory.mathLibrary = libraryData;
    } catch (e) {
      console.log('    Error on math library:', e.message);
    }

    // ============================================
    // LOOK FOR CALENDAR/SCHEDULE
    // ============================================
    console.log('\n[4] Looking for CALENDAR/SCHEDULE...');

    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for calendar icon or link
    try {
      const calendarLink = await page.$('[class*="calendar"], a[href*="calendar"], a[href*="schedule"], [data-calendar]');
      if (calendarLink) {
        await calendarLink.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/zearn-calendar.png', fullPage: true });

        const calendarData = await page.evaluate(() => {
          const body = document.body.innerText;
          return {
            pageText: body,
          };
        });

        console.log('    Calendar text:', calendarData.pageText.substring(0, 500));
        fullHistory.calendar = calendarData;
      } else {
        // Try clicking the calendar icon visible in screenshot
        const calIcon = await page.$('svg, [class*="calendar"], button:has([class*="calendar"])');
        if (calIcon) {
          await calIcon.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: '/tmp/zearn-calendar-click.png', fullPage: true });
        }
      }
    } catch (e) {
      console.log('    Error finding calendar:', e.message);
    }

    // ============================================
    // CHECK ALL VISIBLE NAVIGATION LINKS
    // ============================================
    console.log('\n[5] Checking ALL navigation links...');

    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const navLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a, button').forEach(el => {
        const text = el.textContent?.trim();
        const href = el.getAttribute('href');
        if (text && text.length < 50) {
          links.push({ text, href });
        }
      });
      return links;
    });

    console.log('    Navigation links:');
    navLinks.forEach(l => console.log(`      - ${l.text}: ${l.href || '(button)'}`));

    // ============================================
    // SCROLL AND CAPTURE FULL PAGE
    // ============================================
    console.log('\n[6] Scrolling to capture ALL content...');

    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Scroll down multiple times to load all content
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: '/tmp/zearn-scrolled-full.png', fullPage: true });

    // Get ALL text content after scrolling
    const fullPageData = await page.evaluate(() => {
      const body = document.body.innerText;

      // Extract ALL lesson mentions
      const lessonMentions = body.match(/Lesson\s+\d+[^\n]*/gi) || [];

      // Extract ALL mission mentions
      const missionMentions = body.match(/(?:G\d+\s*)?Mission\s+\d+[^\n]*/gi) || [];

      // Extract completion status
      const completions = body.match(/(?:Lesson|Mission)\s+\d+[^\.]*(?:Complete|Completed|✓|100%)/gi) || [];

      // Look for grade level info
      const gradeInfo = body.match(/Grade\s+\d+/gi) || [];
      const g6Mentions = body.match(/G6[^\n]*/gi) || [];
      const g4Mentions = body.match(/G4[^\n]*/gi) || [];

      return {
        allText: body,
        lessonMentions,
        missionMentions,
        completions,
        gradeInfo,
        g6Mentions,
        g4Mentions,
      };
    });

    console.log('    Lesson mentions:', fullPageData.lessonMentions.slice(0, 20));
    console.log('    Mission mentions:', fullPageData.missionMentions);
    console.log('    Completions found:', fullPageData.completions);
    console.log('    G6 mentions:', fullPageData.g6Mentions);
    console.log('    G4 mentions:', fullPageData.g4Mentions);

    fullHistory.allProgress = fullPageData;

    // ============================================
    // TRY DIFFERENT URLS
    // ============================================
    console.log('\n[7] Trying different Zearn URLs...');

    const urlsToTry = [
      'https://www.zearn.org/students',
      'https://www.zearn.org/student/progress',
      'https://www.zearn.org/student/badges',
      'https://www.zearn.org/student/calendar',
      'https://www.zearn.org/student/submissions',
      'https://www.zearn.org/student/history',
      'https://www.zearn.org/dashboard',
      'https://www.zearn.org/progress',
      'https://www.zearn.org/missions',
      'https://www.zearn.org/library',
    ];

    for (const url of urlsToTry) {
      try {
        console.log(`    Trying: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        const currentUrl = page.url();
        if (!currentUrl.includes('sign_in') && currentUrl !== 'https://www.zearn.org/') {
          console.log(`      -> Landed on: ${currentUrl}`);
          await page.screenshot({ path: `/tmp/zearn-${url.split('/').pop() || 'root'}.png`, fullPage: true });

          const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 1000));
          console.log(`      Content: ${pageContent.substring(0, 200)}...`);
        }
      } catch (e) {
        // URL not accessible
      }
    }

    // ============================================
    // SAVE ALL RESULTS
    // ============================================
    const fs = require('fs');
    fs.writeFileSync('/tmp/zearn-full-history.json', JSON.stringify(fullHistory, null, 2));
    console.log('\n=== Full history saved to /tmp/zearn-full-history.json ===');

    // Print full page text for analysis
    console.log('\n=== FULL PAGE TEXT FOR ANALYSIS ===');
    console.log(fullHistory.allProgress?.allText || 'No text captured');

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/zearn-error.png', fullPage: true });
  } finally {
    await browser.close();
  }

  return fullHistory;
}

scrapeZearnFullHistory();
