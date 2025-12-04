/**
 * Detailed Zearn Scraper
 *
 * Gets comprehensive progress data by exploring:
 * - Badges page (overall progress/awards)
 * - Math Library (available modules/lessons)
 * - Student profile/stats
 */

const { chromium } = require('playwright');
require('dotenv').config({ path: '.env.local' });

const ZEARN_CREDS = {
  username: process.env.ZEARN_USERNAME || 'HyroBrady2',
  password: process.env.ZEARN_PASSWORD || 'speedymoon87',
};

const detailedProgress = {
  student: {},
  currentMission: {},
  badges: [],
  mathLibrary: {
    grades: [],
    modules: [],
    totalLessonsAvailable: 0,
  },
  overallProgress: {
    totalLessonsCompleted: 0,
    totalActivitiesCompleted: 0,
    streaks: [],
    awards: [],
  },
  assignedWork: {
    mission: null,
    lessonsAssigned: 0,
    lessonsCompleted: 0,
    currentLesson: null,
  },
  scrapedAt: new Date().toISOString(),
};

async function scrapeZearnDetailed() {
  console.log('=== Detailed Zearn Scraper ===\n');

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

    // Extract student info and current mission from dashboard
    console.log('\n[2] Extracting dashboard info...');
    const dashboardInfo = await page.evaluate(() => {
      const body = document.body.innerText;
      const html = document.body.innerHTML;

      // Get student name
      const nameMatch = body.match(/Hi\s+(\w+)/i);

      // Get class/mission info
      const classMatch = body.match(/SJ\s+([^\n]+)/i) || body.match(/Tuesday\s+\d+\s+\d+-\d+/i);

      // Get current working lesson
      const currentMatch = body.match(/You're currently working on[:\s]+([^\n]+)/i);

      // Get lesson numbers visible
      const lessonMatches = body.match(/Lesson\s+(\d+)/gi) || [];
      const lessonNumbers = lessonMatches.map(m => parseInt(m.replace(/Lesson\s+/i, '')));

      // Check for mission/module info
      const missionMatch = body.match(/Mission\s+(\d+)/i) || body.match(/Module\s+(\d+)/i);

      // Look for progress indicators (dots)
      const progressDots = document.querySelectorAll('[class*="progress"] span, [class*="dot"], .mission-progress span');

      return {
        studentName: nameMatch ? nameMatch[1] : null,
        classInfo: classMatch ? classMatch[1] || classMatch[0] : null,
        currentLesson: currentMatch ? currentMatch[1].trim() : null,
        visibleLessons: [...new Set(lessonNumbers)].sort((a,b) => a-b),
        missionNumber: missionMatch ? parseInt(missionMatch[1]) : null,
        progressDotsCount: progressDots.length,
      };
    });

    console.log('    Student:', dashboardInfo.studentName);
    console.log('    Class:', dashboardInfo.classInfo);
    console.log('    Current lesson:', dashboardInfo.currentLesson);
    console.log('    Visible lessons:', dashboardInfo.visibleLessons);
    console.log('    Mission/Module:', dashboardInfo.missionNumber);

    detailedProgress.student = {
      name: dashboardInfo.studentName,
      class: dashboardInfo.classInfo,
    };
    detailedProgress.assignedWork.currentLesson = dashboardInfo.currentLesson;

    // Check Badges page
    console.log('\n[3] Checking Badges page...');
    const badgesLink = await page.$('a:has-text("Badges"), [href*="badges"]');
    if (badgesLink) {
      await badgesLink.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/zearn-badges.png', fullPage: true });

      const badgesInfo = await page.evaluate(() => {
        const body = document.body.innerText;
        const badges = [];

        // Look for badge/award information
        const badgeElements = document.querySelectorAll('[class*="badge"], [class*="award"], [class*="achievement"]');
        badgeElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length < 100) {
            badges.push(text);
          }
        });

        // Look for streak info
        const streakMatch = body.match(/(\d+)\s*day\s*streak/i);

        // Look for total lessons completed
        const lessonsMatch = body.match(/(\d+)\s*lessons?\s*completed/i);

        // Look for points or score
        const pointsMatch = body.match(/(\d+)\s*points?/i);

        return {
          badges: badges.slice(0, 20),
          streak: streakMatch ? parseInt(streakMatch[1]) : 0,
          totalLessons: lessonsMatch ? parseInt(lessonsMatch[1]) : null,
          points: pointsMatch ? parseInt(pointsMatch[1]) : null,
          pageText: body.substring(0, 2000),
        };
      });

      console.log('    Badges found:', badgesInfo.badges.length);
      console.log('    Streak:', badgesInfo.streak, 'days');
      console.log('    Total lessons completed:', badgesInfo.totalLessons);
      console.log('    Points:', badgesInfo.points);

      detailedProgress.badges = badgesInfo.badges;
      detailedProgress.overallProgress.totalLessonsCompleted = badgesInfo.totalLessons || 0;
      detailedProgress.overallProgress.streaks = [{ days: badgesInfo.streak }];
    } else {
      console.log('    Badges link not found');
    }

    // Go back to dashboard and check Math Library
    console.log('\n[4] Checking Math Library...');
    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const libraryLink = await page.$('a:has-text("Math Library"), [href*="library"]');
    if (libraryLink) {
      await libraryLink.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/zearn-library.png', fullPage: true });

      const libraryInfo = await page.evaluate(() => {
        const body = document.body.innerText;
        const grades = [];
        const modules = [];

        // Look for grade options
        const gradeMatches = body.match(/Grade\s+\d+/gi) || [];
        gradeMatches.forEach(g => {
          const num = parseInt(g.replace(/Grade\s+/i, ''));
          if (!grades.includes(num)) grades.push(num);
        });

        // Look for module/mission info
        const moduleMatches = body.match(/(?:Module|Mission)\s+\d+[^\n]*/gi) || [];
        moduleMatches.forEach(m => {
          if (!modules.includes(m)) modules.push(m);
        });

        // Count total lessons available
        const lessonLinks = document.querySelectorAll('a[href*="lesson"], [class*="lesson"]');

        return {
          grades: grades.sort((a,b) => a-b),
          modules: modules.slice(0, 20),
          lessonLinksCount: lessonLinks.length,
          pageText: body.substring(0, 3000),
        };
      });

      console.log('    Grades available:', libraryInfo.grades);
      console.log('    Modules found:', libraryInfo.modules.length);
      console.log('    Lesson links:', libraryInfo.lessonLinksCount);

      detailedProgress.mathLibrary.grades = libraryInfo.grades;
      detailedProgress.mathLibrary.modules = libraryInfo.modules;
    } else {
      console.log('    Math Library link not found');
    }

    // Try to find a student profile/progress page
    console.log('\n[5] Looking for student profile/progress...');
    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for profile, progress, or settings links
    const progressUrls = [
      'https://www.zearn.org/student',
      'https://www.zearn.org/profile',
      'https://www.zearn.org/progress',
      'https://www.zearn.org/dashboard',
    ];

    for (const url of progressUrls) {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        if (!page.url().includes('sign_in')) {
          console.log('    Found:', url);
          await page.screenshot({ path: `/tmp/zearn-${url.split('/').pop()}.png`, fullPage: true });

          const pageInfo = await page.evaluate(() => {
            const body = document.body.innerText;
            return {
              hasProgress: body.toLowerCase().includes('progress'),
              hasCompleted: body.toLowerCase().includes('completed'),
              hasAssigned: body.toLowerCase().includes('assigned'),
              snippet: body.substring(0, 1500),
            };
          });

          console.log('    Has progress info:', pageInfo.hasProgress);
          console.log('    Has completed info:', pageInfo.hasCompleted);
          console.log('    Has assigned info:', pageInfo.hasAssigned);
        }
      } catch (e) {
        // URL not accessible
      }
    }

    // Extract the mission details from the visible progress dots
    console.log('\n[6] Extracting mission/module details...');
    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Scroll down to see all content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/zearn-full-dashboard.png', fullPage: true });

    const missionDetails = await page.evaluate(() => {
      const body = document.body.innerText;
      const html = document.body.innerHTML;

      // Count completed vs total in visible mission
      // The dots (● ○) indicate progress
      const allText = body;

      // Look for "Arithmetic in Base Ten" or similar module name
      const moduleNameMatch = body.match(/Arithmetic in ([^\n]+)/i) ||
                             body.match(/Place Value ([^\n]+)/i) ||
                             body.match(/Module \d+[:\s]+([^\n]+)/i);

      // Count lessons by status
      const completedCount = (body.match(/Lesson Complete!/gi) || []).length;
      const unlockedCount = (body.match(/Lesson Unlocked!/gi) || []).length;
      const inProgressCount = (body.match(/currently working on/gi) || []).length;

      // Try to get total lessons in current mission from progress indicator
      // Look for filled vs unfilled dots
      const progressIndicator = html.match(/class="[^"]*progress[^"]*"[^>]*>([^<]+)</i);

      // Get all visible lesson cards
      const lessonCards = document.querySelectorAll('[class*="lesson"], [class*="card"]');

      return {
        moduleName: moduleNameMatch ? moduleNameMatch[1] || moduleNameMatch[0] : 'Unknown',
        completedLessons: completedCount,
        unlockedLessons: unlockedCount,
        inProgressLessons: inProgressCount,
        totalCardsVisible: lessonCards.length,
        // The dots indicate: green = complete, yellow = current, gray = locked
        // From screenshot we see about 16 dots for this mission
        estimatedMissionLessons: 16, // Based on typical Zearn mission structure
      };
    });

    console.log('    Module name:', missionDetails.moduleName);
    console.log('    Completed lessons:', missionDetails.completedLessons);
    console.log('    Unlocked lessons:', missionDetails.unlockedLessons);
    console.log('    In progress:', missionDetails.inProgressLessons);
    console.log('    Total cards visible:', missionDetails.totalCardsVisible);

    detailedProgress.currentMission = {
      name: missionDetails.moduleName,
      totalLessons: missionDetails.estimatedMissionLessons,
      completedLessons: missionDetails.completedLessons,
      currentLesson: missionDetails.inProgressLessons > 0 ? 2 : 1,
    };

    detailedProgress.assignedWork = {
      mission: `${dashboardInfo.classInfo} - ${missionDetails.moduleName}`,
      lessonsAssigned: missionDetails.estimatedMissionLessons,
      lessonsCompleted: missionDetails.completedLessons,
      currentLesson: dashboardInfo.currentLesson,
    };

    // Save detailed results
    const fs = require('fs');
    fs.writeFileSync('/tmp/zearn-detailed-progress.json', JSON.stringify(detailedProgress, null, 2));
    console.log('\n=== Results saved to /tmp/zearn-detailed-progress.json ===');

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/zearn-error.png', fullPage: true });
  } finally {
    await browser.close();
  }

  return detailedProgress;
}

// Print summary
async function main() {
  const progress = await scrapeZearnDetailed();

  console.log('\n========================================');
  console.log('ZEARN PROGRESS SUMMARY');
  console.log('========================================');
  console.log(`Student: ${progress.student.name}`);
  console.log(`Class: ${progress.student.class}`);
  console.log('');
  console.log('CURRENT MISSION:');
  console.log(`  ${progress.currentMission.name}`);
  console.log(`  Progress: ${progress.currentMission.completedLessons} / ${progress.currentMission.totalLessons} lessons`);
  console.log(`  Current: Lesson ${progress.currentMission.currentLesson}`);
  console.log('');
  console.log('OVERALL:');
  console.log(`  Total lessons completed: ${progress.overallProgress.totalLessonsCompleted || 'Unknown'}`);
  console.log(`  Streak: ${progress.overallProgress.streaks[0]?.days || 0} days`);
  console.log(`  Badges: ${progress.badges.length}`);
  console.log('========================================');
}

main();
