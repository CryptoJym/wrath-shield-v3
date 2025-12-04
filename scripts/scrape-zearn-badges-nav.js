/**
 * Zearn Badges Navigation Scraper
 *
 * Uses the left/right arrows on the Badges page to navigate through
 * all missions and capture completed badges for each.
 */

const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const ZEARN_CREDS = {
  username: process.env.ZEARN_USERNAME || 'HyroBrady2',
  password: process.env.ZEARN_PASSWORD || 'speedymoon87',
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeZearnBadges() {
  console.log('=== Zearn Badges Navigation Scraper ===\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  const allMissions = [];

  try {
    // LOGIN
    console.log('[1] Logging in...');
    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);

    await page.fill('#user_login_field, input[name="user[login]"]', ZEARN_CREDS.username);
    await page.fill('#user_password_field, input[name="user[password]"]', ZEARN_CREDS.password);
    await page.click('button:has-text("Sign in"), input[type="submit"]');
    await delay(5000);
    console.log('    Logged in');

    // NAVIGATE TO BADGES
    console.log('\n[2] Going to Badges page...');
    await page.click('text=Badges');
    await delay(3000);

    // CAPTURE CURRENT MISSION (G6 M5)
    console.log('\n[3] Capturing badges from each mission...');
    console.log('    Starting at current mission (G6 M5)');

    // Function to extract badge data from current mission view
    async function extractMissionBadges() {
      return await page.evaluate(() => {
        const body = document.body.innerText;

        // Get mission info from header
        const missionMatch = body.match(/(G\d+)\s*MISSION\s*(\d+)/i);
        const missionNameMatch = body.match(/MISSION\s*\d+\s*\n?\s*([A-Za-z\s]+?)(?:\n|LESSON)/i);

        // Count badge elements
        const allBadgeSlots = document.querySelectorAll('[class*="badge"], [class*="lesson-badge"], circle, [class*="circle"]');
        let earnedCount = 0;
        let lockedCount = 0;
        let inProgressCount = 0;

        // Look for specific badge indicators in the badge grid
        const badgeArea = document.querySelector('[class*="badge-grid"], [class*="lesson-badges"], main');
        if (badgeArea) {
          // Earned badges usually have a solid fill or specific class
          const earned = badgeArea.querySelectorAll('[class*="earned"], [class*="complete"], [fill="#"], img[src*="badge"]');
          earnedCount = earned.length;

          // Check for specific colors/states
          const svgs = badgeArea.querySelectorAll('svg, [class*="badge-icon"]');
          svgs.forEach(svg => {
            const fill = svg.getAttribute('fill') || '';
            const classes = svg.className?.toString() || '';
            if (fill.includes('#') && !fill.includes('gray') && !fill.includes('grey')) {
              // Colored = earned
            }
          });
        }

        // Alternative: count circles/badges by their appearance
        // Pink/colored circle = earned, Yellow outline = in progress, Gray = locked
        const circles = document.querySelectorAll('circle, [class*="circle"], [class*="dot"]');

        return {
          grade: missionMatch ? missionMatch[1] : null,
          missionNumber: missionMatch ? parseInt(missionMatch[2]) : null,
          missionName: missionNameMatch ? missionNameMatch[1].trim() : null,
          earnedBadges: earnedCount,
          totalSlots: allBadgeSlots.length,
          pageText: body.substring(0, 2000),
        };
      });
    }

    // Capture current mission (should be G6 M5)
    let currentMission = await extractMissionBadges();
    console.log(`    Current: ${currentMission.grade} Mission ${currentMission.missionNumber} - ${currentMission.missionName}`);
    allMissions.push({ ...currentMission, position: 'current' });
    await page.screenshot({ path: `/tmp/zearn-badge-G${currentMission.grade}M${currentMission.missionNumber}.png`, fullPage: true });

    // NAVIGATE LEFT (to previous missions) - Click left arrow multiple times
    console.log('\n[4] Navigating LEFT to find previous missions...');

    let leftClickCount = 0;
    const maxLeftClicks = 10; // Safety limit

    while (leftClickCount < maxLeftClicks) {
      // Find and click the left arrow button
      const leftArrowClicked = await page.evaluate(() => {
        // Look for left arrow by various selectors
        const selectors = [
          'button[aria-label*="previous"]',
          'button[aria-label*="left"]',
          '[class*="arrow-left"]',
          '[class*="prev"]',
          'svg[class*="left"]',
          'button:has(svg[class*="left"])',
          '[class*="carousel-control-prev"]',
        ];

        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            el.click();
            return true;
          }
        }

        // Try finding by position - leftmost clickable element near the mission header
        const allButtons = document.querySelectorAll('button, [role="button"], a');
        for (const btn of allButtons) {
          const rect = btn.getBoundingClientRect();
          // Left side of page, in the mission header area
          if (rect.left < 600 && rect.top > 100 && rect.top < 300) {
            const svg = btn.querySelector('svg');
            if (svg) {
              btn.click();
              return true;
            }
          }
        }

        // Try clicking the teal/cyan circle with left arrow
        const circles = document.querySelectorAll('circle, [class*="circle"]');
        for (const c of circles) {
          const parent = c.closest('button, a, [role="button"]');
          if (parent) {
            const rect = parent.getBoundingClientRect();
            if (rect.left < 550) { // Left side
              parent.click();
              return 'left-circle';
            }
          }
        }

        return false;
      });

      if (!leftArrowClicked) {
        // Try using Playwright's locator for the arrow
        try {
          // The teal circle with arrow is likely an SVG or button
          const leftArrow = await page.locator('button, [role="button"]').filter({
            has: page.locator('svg')
          }).first();

          const box = await leftArrow.boundingBox();
          if (box && box.x < 550) {
            await leftArrow.click();
            console.log('    Clicked left arrow via Playwright locator');
          } else {
            console.log('    No left arrow found, reached beginning');
            break;
          }
        } catch (e) {
          console.log('    No more left arrows');
          break;
        }
      }

      await delay(1500);
      leftClickCount++;

      // Check if mission changed
      const newMission = await extractMissionBadges();

      // Check if we're on a different mission
      if (newMission.missionNumber !== currentMission.missionNumber ||
          newMission.grade !== currentMission.grade) {
        console.log(`    Found: ${newMission.grade} Mission ${newMission.missionNumber} - ${newMission.missionName}`);
        allMissions.push({ ...newMission, position: `left-${leftClickCount}` });
        await page.screenshot({ path: `/tmp/zearn-badge-${newMission.grade}M${newMission.missionNumber}.png`, fullPage: true });
        currentMission = newMission;
      } else {
        console.log(`    Same mission after click ${leftClickCount}, might be at start`);
        if (leftClickCount > 2) break; // Give it a few tries then stop
      }
    }

    // NAVIGATE BACK TO START AND GO RIGHT
    console.log('\n[5] Going back to start and navigating RIGHT...');

    // Go back to badges fresh
    await page.goto('https://www.zearn.org', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);
    await page.click('text=Badges');
    await delay(3000);

    // Now click RIGHT to see if there are future missions
    let rightClickCount = 0;
    const maxRightClicks = 3;
    currentMission = await extractMissionBadges();

    while (rightClickCount < maxRightClicks) {
      const rightArrowClicked = await page.evaluate(() => {
        const allButtons = document.querySelectorAll('button, [role="button"], a');
        for (const btn of allButtons) {
          const rect = btn.getBoundingClientRect();
          // Right side of page
          if (rect.right > 900 && rect.top > 100 && rect.top < 300) {
            const svg = btn.querySelector('svg');
            if (svg) {
              btn.click();
              return true;
            }
          }
        }
        return false;
      });

      if (!rightArrowClicked) {
        console.log('    No right arrow or at end');
        break;
      }

      await delay(1500);
      rightClickCount++;

      const newMission = await extractMissionBadges();
      if (newMission.missionNumber !== currentMission.missionNumber ||
          newMission.grade !== currentMission.grade) {
        console.log(`    Found: ${newMission.grade} Mission ${newMission.missionNumber}`);
        // Only add if not already captured
        const exists = allMissions.find(m =>
          m.grade === newMission.grade && m.missionNumber === newMission.missionNumber
        );
        if (!exists) {
          allMissions.push({ ...newMission, position: `right-${rightClickCount}` });
          await page.screenshot({ path: `/tmp/zearn-badge-${newMission.grade}M${newMission.missionNumber}.png`, fullPage: true });
        }
        currentMission = newMission;
      }
    }

    // SUMMARY
    console.log('\n=== MISSIONS FOUND ===');
    allMissions.forEach(m => {
      console.log(`${m.grade} Mission ${m.missionNumber}: ${m.missionName || 'Unknown'}`);
      console.log(`  Earned badges: ${m.earnedBadges}, Total slots: ${m.totalSlots}`);
    });

    // Save results
    const results = {
      student: { name: 'Hyro', class: 'SJ Tuesday 6 25-26' },
      missions: allMissions,
      totalBadges: allMissions.reduce((sum, m) => sum + (m.earnedBadges || 0), 0),
      scrapedAt: new Date().toISOString(),
    };

    fs.writeFileSync('/tmp/zearn-badges-all.json', JSON.stringify(results, null, 2));
    console.log('\n=== Results saved to /tmp/zearn-badges-all.json ===');

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/zearn-badges-error.png', fullPage: true });
  } finally {
    console.log('\n[Keeping browser open for 20 seconds...]');
    await delay(20000);
    await browser.close();
  }

  return allMissions;
}

scrapeZearnBadges();
