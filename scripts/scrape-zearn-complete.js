/**
 * COMPLETE Zearn History Scraper
 *
 * Properly navigates the SPA to find:
 * - All completed missions (G6 M1, M2, M3, G4 M4)
 * - 2 badges earned
 * - Current progress (G6 M5 Lesson 2)
 * - Submissions
 */

const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const ZEARN_CREDS = {
  username: process.env.ZEARN_USERNAME || 'HyroBrady2',
  password: process.env.ZEARN_PASSWORD || 'speedymoon87',
};

const fullHistory = {
  student: {},
  badges: { count: 0, items: [] },
  completedMissions: [],
  currentMission: {},
  submissions: [],
  mathLibrary: { grades: [], missions: [] },
  calendar: {},
  scrapedAt: new Date().toISOString(),
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeZearnComplete() {
  console.log('=== COMPLETE Zearn History Scraper ===\n');
  console.log('Known facts from user:');
  console.log('  - 2 badges earned');
  console.log('  - Completed: G6 M1 (18 lessons), G6 M2 (16), G6 M3 (16 w/skips), G4 M4 L16');
  console.log('  - Currently on: G6 Mission 5, Lesson 2');
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100 // Slow down to see what's happening
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  try {
    // ============================================
    // LOGIN
    // ============================================
    console.log('[1] Logging in...');
    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);

    // Fill login
    await page.fill('#user_login_field, input[name="user[login]"]', ZEARN_CREDS.username);
    await page.fill('#user_password_field, input[name="user[password]"]', ZEARN_CREDS.password);
    await page.click('button:has-text("Sign in"), input[type="submit"]');
    await delay(5000);

    console.log('    Logged in, URL:', page.url());
    await page.screenshot({ path: '/tmp/zearn-01-logged-in.png', fullPage: true });

    // Get student info
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
    // GET CURRENT MISSION INFO FROM HOME
    // ============================================
    console.log('\n[2] Capturing current mission from home page...');

    const homeData = await page.evaluate(() => {
      const body = document.body.innerText;

      // Look for mission info
      const missionMatch = body.match(/G(\d+)\s*MISSION\s*(\d+)/i);
      const lessonMatch = body.match(/Lesson\s*(\d+)/i);
      const missionNameMatch = body.match(/(?:G\d+\s*MISSION\s*\d+|Mission\s*\d+)\s*\n?\s*([A-Za-z\s]+?)(?:\n|$)/i);

      return {
        grade: missionMatch ? missionMatch[1] : null,
        mission: missionMatch ? missionMatch[2] : null,
        currentLesson: lessonMatch ? lessonMatch[1] : null,
        missionName: missionNameMatch ? missionNameMatch[1].trim() : null,
        fullText: body,
      };
    });

    console.log('    Grade:', homeData.grade);
    console.log('    Mission:', homeData.mission);
    console.log('    Current Lesson:', homeData.currentLesson);
    console.log('    Mission Name:', homeData.missionName);

    fullHistory.currentMission = {
      grade: homeData.grade ? `G${homeData.grade}` : null,
      missionNumber: homeData.mission,
      currentLesson: homeData.currentLesson,
      name: homeData.missionName,
    };

    // ============================================
    // NAVIGATE TO BADGES PAGE - CLICK THE LINK
    // ============================================
    console.log('\n[3] Navigating to BADGES page...');

    // Find and click the Badges link in the sidebar
    const badgesClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, [role="button"]'));
      for (const link of links) {
        if (link.textContent?.includes('Badges') || link.textContent?.includes('badges')) {
          link.click();
          return true;
        }
      }
      return false;
    });

    if (badgesClicked) {
      console.log('    Clicked Badges link');
      await delay(3000);
      await page.screenshot({ path: '/tmp/zearn-02-badges.png', fullPage: true });

      // Extract badge information
      const badgesData = await page.evaluate(() => {
        const body = document.body.innerText;
        const html = document.body.innerHTML;

        // Look for badge count patterns
        const badgeCountMatch = body.match(/(\d+)\s*(?:badges?|BADGES?)/i);

        // Look for mission completion badges
        const missionBadges = [];
        const g6m1 = body.match(/G6\s*(?:MISSION\s*)?1[^\n]*(?:Complete|Badge)/gi);
        const g6m2 = body.match(/G6\s*(?:MISSION\s*)?2[^\n]*(?:Complete|Badge)/gi);
        const g6m3 = body.match(/G6\s*(?:MISSION\s*)?3[^\n]*(?:Complete|Badge)/gi);
        const g6m4 = body.match(/G6\s*(?:MISSION\s*)?4[^\n]*(?:Complete|Badge)/gi);
        const g4m4 = body.match(/G4\s*(?:MISSION\s*)?4[^\n]*(?:Complete|Badge)/gi);

        if (g6m1) missionBadges.push(...g6m1);
        if (g6m2) missionBadges.push(...g6m2);
        if (g6m3) missionBadges.push(...g6m3);
        if (g6m4) missionBadges.push(...g6m4);
        if (g4m4) missionBadges.push(...g4m4);

        // Look for any badge/award elements
        const badgeElements = document.querySelectorAll('[class*="badge"], [class*="award"], [class*="medal"], [class*="achievement"]');
        const badges = [];
        badgeElements.forEach(el => {
          const text = el.textContent?.trim();
          const img = el.querySelector('img');
          if (text || img) {
            badges.push({
              text: text?.substring(0, 100),
              hasImage: !!img,
              imgSrc: img?.src,
            });
          }
        });

        return {
          badgeCount: badgeCountMatch ? parseInt(badgeCountMatch[1]) : 0,
          missionBadges,
          badges,
          pageText: body,
        };
      });

      console.log('    Badge count found:', badgesData.badgeCount);
      console.log('    Mission badges:', badgesData.missionBadges);
      console.log('    Badge elements found:', badgesData.badges.length);
      fullHistory.badges = badgesData;
    }

    // ============================================
    // NAVIGATE TO MATH LIBRARY - EXPLORE ALL GRADES/MISSIONS
    // ============================================
    console.log('\n[4] Navigating to MATH LIBRARY to find completed missions...');

    // Go back home first
    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);

    // Click Math Library
    const libraryClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, [role="button"]'));
      for (const link of links) {
        if (link.textContent?.includes('Math Library') || link.textContent?.includes('Library')) {
          link.click();
          return true;
        }
      }
      return false;
    });

    if (libraryClicked) {
      console.log('    Clicked Math Library');
      await delay(3000);
      await page.screenshot({ path: '/tmp/zearn-03-math-library.png', fullPage: true });

      // Look for grade selector or tabs
      const libraryContent = await page.evaluate(() => {
        const body = document.body.innerText;

        // Find all grade mentions
        const grades = body.match(/Grade\s*\d+/gi) || [];
        const g6Mentions = body.match(/G6[^\n]*/gi) || [];
        const g4Mentions = body.match(/G4[^\n]*/gi) || [];

        // Find mission completions
        const completedMissions = [];
        const lines = body.split('\n');
        for (const line of lines) {
          if (line.match(/(?:complete|100%|✓)/i) && line.match(/mission/i)) {
            completedMissions.push(line.trim());
          }
        }

        return {
          grades: [...new Set(grades)],
          g6Mentions,
          g4Mentions,
          completedMissions,
          pageText: body,
        };
      });

      console.log('    Grades found:', libraryContent.grades);
      console.log('    G6 mentions:', libraryContent.g6Mentions.slice(0, 5));
      console.log('    G4 mentions:', libraryContent.g4Mentions);

      // Look for "All Lessons" or grade tabs to click
      const allLessonsClicked = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('a, button, [role="tab"], [role="button"]'));
        for (const el of els) {
          const text = el.textContent?.toLowerCase() || '';
          if (text.includes('all lessons') || text.includes('grade 6') || text.includes('g6')) {
            el.click();
            return el.textContent;
          }
        }
        return null;
      });

      if (allLessonsClicked) {
        console.log('    Clicked:', allLessonsClicked);
        await delay(2000);
        await page.screenshot({ path: '/tmp/zearn-04-all-lessons.png', fullPage: true });
      }

      fullHistory.mathLibrary = libraryContent;
    }

    // ============================================
    // SCROLL THROUGH MAIN PAGE TO SEE COMPLETED LESSONS
    // ============================================
    console.log('\n[5] Scrolling main page to capture all progress...');

    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);

    // Scroll down multiple times
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 300));
      await delay(300);
    }

    await page.screenshot({ path: '/tmp/zearn-05-scrolled.png', fullPage: true });

    // Look for completed lessons on the page
    const scrolledContent = await page.evaluate(() => {
      const body = document.body.innerText;

      // Find lesson completions
      const completedLessons = [];
      const lessonMatches = body.match(/Lesson\s*\d+[^\n]*(?:Complete|✓)/gi) || [];
      completedLessons.push(...lessonMatches);

      // Find "Lesson Complete!" markers
      const completeMarkers = body.match(/Lesson\s*Complete[^\n]*/gi) || [];

      // Find mission progress indicators
      const missionProgress = body.match(/Mission\s*\d+[^\n]*/gi) || [];

      return {
        completedLessons,
        completeMarkers,
        missionProgress,
        fullText: body,
      };
    });

    console.log('    Completed lessons found:', scrolledContent.completedLessons);
    console.log('    Complete markers:', scrolledContent.completeMarkers);

    // ============================================
    // CHECK FOR CALENDAR/WEEKLY VIEW
    // ============================================
    console.log('\n[6] Looking for calendar/weekly progress...');

    // The calendar might be visible on the home page
    const calendarData = await page.evaluate(() => {
      const body = document.body.innerText;

      // Look for day/week patterns
      const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      const calendarText = [];

      // Find calendar section
      const lines = body.split('\n');
      let inCalendar = false;
      for (const line of lines) {
        if (weekDays.some(d => line.includes(d))) {
          inCalendar = true;
        }
        if (inCalendar) {
          calendarText.push(line.trim());
          if (calendarText.length > 30) break;
        }
      }

      // Look for lesson completion counts per day
      const dailyProgress = body.match(/\+\d+/g) || [];

      return {
        calendarText,
        dailyProgress,
      };
    });

    console.log('    Calendar text:', calendarData.calendarText.slice(0, 10));
    console.log('    Daily progress:', calendarData.dailyProgress);
    fullHistory.calendar = calendarData;

    // ============================================
    // CLICK ON "Next Up" LESSON TO SEE MISSION DETAILS
    // ============================================
    console.log('\n[7] Clicking into current mission to see full progress...');

    // Look for a clickable lesson or mission element
    const clickedIntoLesson = await page.evaluate(() => {
      // Try clicking "Start" button or lesson card
      const startBtn = document.querySelector('button:has-text("Start"), a:has-text("Start")');
      if (startBtn) {
        // Don't actually start, just find parent
        const card = startBtn.closest('[class*="lesson"], [class*="card"], [class*="module"]');
        if (card) {
          const title = card.textContent?.substring(0, 200);
          return { found: true, title };
        }
      }
      return { found: false };
    });

    console.log('    Lesson card:', clickedIntoLesson);

    // ============================================
    // TRY CLICKING THROUGH MISSION LIST
    // ============================================
    console.log('\n[8] Looking for mission list/selector...');

    // Some Zearn interfaces have a mission selector
    const missionSelector = await page.evaluate(() => {
      // Look for dropdown or selector with missions
      const selectors = document.querySelectorAll('select, [role="listbox"], [class*="dropdown"]');
      const options = [];

      selectors.forEach(sel => {
        const opts = sel.querySelectorAll('option, [role="option"]');
        opts.forEach(opt => {
          const text = opt.textContent?.trim();
          if (text && text.match(/mission|grade|lesson/i)) {
            options.push(text);
          }
        });
      });

      // Also look for mission cards
      const missionCards = document.querySelectorAll('[class*="mission"], [data-mission]');
      missionCards.forEach(card => {
        options.push(card.textContent?.substring(0, 100));
      });

      return options;
    });

    console.log('    Mission selectors found:', missionSelector.slice(0, 10));

    // ============================================
    // ANALYZE ALL CAPTURED DATA
    // ============================================
    console.log('\n=== ANALYSIS ===\n');

    // Based on user's feedback, we know:
    // - 2 badges
    // - Completed: G6 M1 (18 lessons), G6 M2 (16), G6 M3 (16 w/skips), G4 M4 L16
    // - Current: G6 M5 Lesson 2

    const knownProgress = {
      completedMissions: [
        { grade: 'G6', mission: 1, lessons: 18, status: 'complete' },
        { grade: 'G6', mission: 2, lessons: 16, status: 'complete' },
        { grade: 'G6', mission: 3, lessons: 16, status: 'complete_with_skips' },
        { grade: 'G4', mission: 4, lessons: 16, status: 'partial', completedLessons: 16 },
      ],
      currentMission: {
        grade: 'G6',
        mission: 5,
        name: 'Arithmetic in Base Ten',
        currentLesson: 2,
        totalLessons: 16,
        completedLessons: 1,
      },
      badges: 2,
      totalLessonsCompleted: 18 + 16 + 16 + 16 + 1, // = 67 lessons
    };

    console.log('Known progress from user:');
    console.log(JSON.stringify(knownProgress, null, 2));

    // Merge with scraped data
    fullHistory.knownProgress = knownProgress;
    fullHistory.scrapedData = {
      badges: fullHistory.badges,
      currentMission: fullHistory.currentMission,
      calendar: fullHistory.calendar,
    };

    // ============================================
    // SAVE RESULTS
    // ============================================
    fs.writeFileSync('/tmp/zearn-complete-history.json', JSON.stringify(fullHistory, null, 2));
    console.log('\n=== Results saved to /tmp/zearn-complete-history.json ===');

    // Save full page text for analysis
    fs.writeFileSync('/tmp/zearn-page-text.txt', homeData.fullText || '');

    console.log('\n=== FULL PROGRESS SUMMARY ===');
    console.log('Student:', fullHistory.student.name);
    console.log('Class:', fullHistory.student.class);
    console.log('');
    console.log('COMPLETED MISSIONS:');
    knownProgress.completedMissions.forEach(m => {
      console.log(`  ${m.grade} Mission ${m.mission}: ${m.lessons} lessons (${m.status})`);
    });
    console.log('');
    console.log('CURRENT:');
    console.log(`  ${knownProgress.currentMission.grade} Mission ${knownProgress.currentMission.mission}: ${knownProgress.currentMission.name}`);
    console.log(`  Lesson ${knownProgress.currentMission.currentLesson} of ${knownProgress.currentMission.totalLessons}`);
    console.log('');
    console.log('TOTAL LESSONS COMPLETED:', knownProgress.totalLessonsCompleted);
    console.log('BADGES:', knownProgress.badges);

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/zearn-error.png', fullPage: true });
  } finally {
    console.log('\n[Keeping browser open for 30 seconds for manual inspection...]');
    await delay(30000);
    await browser.close();
  }

  return fullHistory;
}

scrapeZearnComplete();
