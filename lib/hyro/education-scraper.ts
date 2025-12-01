/**
 * Education Platform Scraper
 *
 * Uses Playwright for browser automation to scrape assignments from
 * various education platforms. Supports multiple platforms with
 * configurable login and assignment parsing.
 *
 * Supported Platforms:
 * - Canyon Grove Boost
 * - Lexia Core5
 * - Zearn Math
 * - Google Classroom (planned)
 * - Canvas (planned)
 */

import { ensureServerOnly } from '../server-only-guard';
import {
  getBrowser,
  closeBrowser as closePlaywrightBrowser,
  createPage,
  safeType,
  safeClick,
  safeGetText,
  waitForNavigation,
  takeScreenshot,
  elementExists,
  type Page,
  type BrowserContext,
} from './playwright-browser';
import {
  createAssignment,
  updateAssignment,
  getAssignmentByPlatformId,
  getPlatformCredentials,
  upsertPlatformCredentials,
  recordSyncLog,
  type SubjectArea,
} from './education-store';
import { recordAssignment } from './education-memory';
import { safeConfig } from '../safe-config';

ensureServerOnly('lib/hyro/education-scraper');

// Platform configurations
export type PlatformType = 'canyon_grove' | 'google_classroom' | 'canvas' | 'lexia' | 'zearn';

interface PlatformConfig {
  name: string;
  baseUrl: string;
  loginUrl: string;
  assignmentsUrl: string;
  // Login type: 'direct' (form), 'google_oauth' (click Google button), 'multi_step' (click Sign In first)
  loginType?: 'direct' | 'google_oauth' | 'multi_step';
  selectors: {
    usernameInput: string;
    passwordInput: string;
    loginButton: string;
    loginSuccess: string;
    // Optional selectors for special login flows
    googleButton?: string;    // For Google OAuth login
    signInLink?: string;      // For multi-step login (click Sign In first)
    // Assignment selectors
    assignmentCard: string;
    assignmentTitle: string;
    assignmentSubject: string;
    assignmentDueDate: string;
    assignmentStatus: string;
    assignmentScore?: string;
    assignmentDescription?: string;
    assignmentLink?: string;
  };
}

// Platform-specific configurations - updated with correct URLs and selectors
const PLATFORM_CONFIGS: Record<PlatformType, PlatformConfig> = {
  canyon_grove: {
    name: 'Canyon Grove Boost',
    baseUrl: 'https://boost.lifted-management.com',
    loginUrl: 'https://boost.lifted-management.com', // Redirects to auth.lifted-management.com
    assignmentsUrl: 'https://boost.lifted-management.com/dashboard',
    loginType: 'google_oauth', // Uses Google OAuth via Keycloak
    selectors: {
      // Keycloak auth page selectors (auth.lifted-management.com)
      usernameInput: '#username',
      passwordInput: '#password',
      loginButton: '#kc-login',
      // Google OAuth button on Keycloak page
      googleButton: 'a:has-text("Google"), a.kc-social-item-google, a[href*="broker/google"]',
      // Success detection - "Welcome!" text appears on dashboard after login
      loginSuccess: 'text="Welcome", .dashboard, .home, [data-testid="dashboard"], .student-dashboard',
      assignmentCard: '.assignment-card, .assignment-item, [data-assignment-id], .resource-card',
      assignmentTitle: '.assignment-title, h3, .title, .resource-title',
      assignmentSubject: '.subject, .class-name, .course',
      assignmentDueDate: '.due-date, .due, [data-due]',
      assignmentStatus: '.status, .completion-status',
      assignmentScore: '.score, .grade, .points',
      assignmentDescription: '.description, .details, .instructions',
      assignmentLink: 'a[href*="assignment"], a[href*="resource"]',
    },
  },
  google_classroom: {
    name: 'Google Classroom',
    baseUrl: 'https://classroom.google.com',
    loginUrl: 'https://accounts.google.com/signin',
    assignmentsUrl: 'https://classroom.google.com/u/0/h',
    selectors: {
      usernameInput: 'input[type="email"]',
      passwordInput: 'input[type="password"]',
      loginButton: '#identifierNext, #passwordNext',
      loginSuccess: '[data-test-id="stream-container"]',
      assignmentCard: '[data-stream-item-id]',
      assignmentTitle: '.onkcGd, .asQXV',
      assignmentSubject: '.Fm1qlf',
      assignmentDueDate: '.EhRlC',
      assignmentStatus: '.submissionStatus',
    },
  },
  canvas: {
    name: 'Canvas LMS',
    baseUrl: '', // Set per institution
    loginUrl: '', // Set per institution
    assignmentsUrl: '/assignments',
    selectors: {
      usernameInput: '#pseudonym_session_unique_id',
      passwordInput: '#pseudonym_session_password',
      loginButton: '.Button--login',
      loginSuccess: '#dashboard',
      assignmentCard: '.assignment',
      assignmentTitle: '.ig-title',
      assignmentSubject: '.context_module_item',
      assignmentDueDate: '.due_date',
      assignmentStatus: '.submission-status',
    },
  },
  lexia: {
    name: 'Lexia Core5',
    // NOTE: Lexia Core5 requires device registration (teacher email) before student login.
    // Direct web access at lexiacore5.com redirects to /register page asking for teacher's email.
    // Lexia is best accessed through the Boost platform's Resources tab.
    baseUrl: 'https://www.lexiacore5.com',
    loginUrl: 'https://www.lexiacore5.com', // Redirects to /register - needs teacher email first
    assignmentsUrl: 'https://www.lexiacore5.com/student/dashboard',
    loginType: 'direct',
    selectors: {
      // Device registration selectors (not student login)
      usernameInput: 'input[placeholder*="teacher" i], input[type="email"]',
      passwordInput: 'input[name="password"], input[id="password"], input[type="password"]',
      loginButton: 'button:has-text("Save"), button[type="submit"]',
      loginSuccess: '.dashboard, .student-dashboard, .home-page, [data-testid="student-home"], .student-home',
      assignmentCard: '.activity, .lesson, .assignment-item, [data-activity-id], .level-card',
      assignmentTitle: '.activity-title, .lesson-title, h3, .level-name',
      assignmentSubject: '.skill-name, .subject, .level, .strand',
      assignmentDueDate: '.due-date, .deadline',
      assignmentStatus: '.status, .progress, .completion, .progress-bar',
      assignmentScore: '.score, .progress-percent, .units-completed',
    },
  },
  zearn: {
    name: 'Zearn Math',
    baseUrl: 'https://www.zearn.org',
    loginUrl: 'https://www.zearn.org', // Login form is directly on the main page
    assignmentsUrl: 'https://www.zearn.org', // After login, student dashboard appears on same page
    loginType: 'direct', // Form is directly on the page, no need to click Sign In first
    selectors: {
      // Zearn login form selectors - form is on main page
      usernameInput: '#user_login_field, input[name="user[login]"]',
      passwordInput: '#user_password_field, input[name="user[password]"]',
      loginButton: 'button:has-text("Sign in"), input[type="submit"], button[type="submit"]',
      // Success detection - look for "Hi Hyro" or student dashboard elements
      loginSuccess: 'text="Hi Hyro", .sign-out, a:has-text("Sign Out"), .student-dashboard, .next-up',
      assignmentCard: '.mission, .lesson, .tower-card, [data-mission-id], .mission-card',
      assignmentTitle: '.mission-title, .lesson-name, h3, .mission-name',
      assignmentSubject: '.grade-level, .topic, .grade',
      assignmentDueDate: '.due-date, .assigned-date',
      assignmentStatus: '.status, .completed, .in-progress, .mission-status',
      assignmentScore: '.score, .stars, .points, .streak',
    },
  },
};

interface ScrapedAssignment {
  id: string;
  title: string;
  subject: string;
  dueDate: string | null;
  assignedDate: string | null;
  status: 'pending' | 'completed' | 'overdue';
  score?: number;
  maxScore?: number;
  url?: string;
  description?: string;
}

interface ScrapeResult {
  success: boolean;
  assignments: ScrapedAssignment[];
  error?: string;
  syncedAt: number;
  screenshotPath?: string;
}

/**
 * Map subject names to standard subject areas
 */
function mapSubject(subjectName: string): SubjectArea {
  const normalized = subjectName.toLowerCase().trim();

  if (normalized.includes('math') || normalized.includes('algebra') || normalized.includes('geometry') || normalized.includes('calculus')) {
    return 'math';
  }
  if (normalized.includes('read') || normalized.includes('language arts') || normalized.includes('ela') || normalized.includes('literature')) {
    return 'reading';
  }
  if (normalized.includes('writ') || normalized.includes('english') || normalized.includes('composition')) {
    return 'writing';
  }
  if (normalized.includes('science') || normalized.includes('biology') || normalized.includes('chemistry') || normalized.includes('physics') || normalized.includes('earth')) {
    return 'science';
  }
  if (normalized.includes('history') || normalized.includes('social') || normalized.includes('geography') || normalized.includes('civics') || normalized.includes('government')) {
    return 'social_studies';
  }
  if (normalized.includes('art') || normalized.includes('draw') || normalized.includes('paint') || normalized.includes('visual')) {
    return 'art';
  }
  if (normalized.includes('music') || normalized.includes('band') || normalized.includes('choir') || normalized.includes('orchestra')) {
    return 'music';
  }
  if (normalized.includes('pe') || normalized.includes('physical') || normalized.includes('gym') || normalized.includes('health') || normalized.includes('fitness')) {
    return 'pe';
  }

  return 'other';
}

/**
 * Parse date string to timestamp
 */
function parseDate(dateStr: string | null | undefined): number | undefined {
  if (!dateStr) return undefined;

  try {
    // Clean up the string
    const cleaned = dateStr.trim().replace(/\s+/g, ' ');

    // Try direct parsing
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000);
    }

    // Try MM/DD/YYYY format
    const slashParts = cleaned.split('/');
    if (slashParts.length === 3) {
      const [month, day, year] = slashParts;
      const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(parsed.getTime())) {
        return Math.floor(parsed.getTime() / 1000);
      }
    }

    // Try "Month Day, Year" format
    const monthMatch = cleaned.match(/(\w+)\s+(\d+),?\s*(\d{4})?/);
    if (monthMatch) {
      const [, monthName, day, year] = monthMatch;
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIndex = months.findIndex(m => monthName.toLowerCase().startsWith(m));
      if (monthIndex !== -1) {
        const parsed = new Date(parseInt(year || new Date().getFullYear().toString()), monthIndex, parseInt(day));
        if (!isNaN(parsed.getTime())) {
          return Math.floor(parsed.getTime() / 1000);
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return undefined;
}

/**
 * Determine assignment status based on due date and completion
 */
function determineStatus(statusText: string, dueDate: number | undefined): 'pending' | 'completed' | 'overdue' {
  const lower = statusText.toLowerCase();

  if (lower.includes('complet') || lower.includes('done') || lower.includes('submitted') || lower.includes('turned in')) {
    return 'completed';
  }

  if (dueDate && dueDate < Math.floor(Date.now() / 1000)) {
    return 'overdue';
  }

  if (lower.includes('overdue') || lower.includes('late') || lower.includes('missing')) {
    return 'overdue';
  }

  return 'pending';
}

/**
 * Close browser instance (re-exported from playwright-browser)
 */
export const closeBrowser = closePlaywrightBrowser;

/**
 * Safe attribute extraction from page element
 */
async function safeGetAttributeFromPage(page: Page, selector: string, attr: string, defaultValue = ''): Promise<string> {
  try {
    const element = await page.$(selector);
    if (!element) return defaultValue;
    const value = await element.getAttribute(attr);
    return value || defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Login to Boost via Google OAuth (Keycloak)
 * Flow: Boost -> Keycloak auth page -> Click "Google" -> Google login page -> fill credentials
 */
async function loginToBoostViaGoogleOAuth(
  page: Page,
  googleEmail: string,
  googlePassword: string
): Promise<{ success: boolean; error?: string }> {
  const config = PLATFORM_CONFIGS.canyon_grove;

  try {
    console.log('[EducationScraper] Starting Boost Google OAuth login...');

    // Navigate to Boost (will redirect to Keycloak auth)
    await page.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('[EducationScraper] Redirected to:', page.url());

    // Take screenshot for debugging
    await takeScreenshot(page, 'boost-1-keycloak');

    // Click the Google sign-in button on Keycloak page
    const googleButton = config.selectors.googleButton;
    if (googleButton) {
      const googleClicked = await safeClick(page, googleButton, 10000);
      if (!googleClicked) {
        return { success: false, error: 'Could not find Google sign-in button on Keycloak page' };
      }
      console.log('[EducationScraper] Clicked Google sign-in button');
      await page.waitForTimeout(3000);
    }

    console.log('[EducationScraper] Current URL after Google click:', page.url());
    await takeScreenshot(page, 'boost-2-after-google-click');

    // Now we should be on Google login page
    if (page.url().includes('accounts.google.com') || page.url().includes('auth.lifted-management')) {
      // Fill Google email
      const emailTyped = await safeType(page, 'input[type="email"], input[name="identifier"]', googleEmail, 10000);
      if (!emailTyped) {
        return { success: false, error: 'Could not find Google email input' };
      }
      console.log('[EducationScraper] Filled Google email');

      // Click Next on email page
      const emailNextClicked = await safeClick(page, '#identifierNext, button:has-text("Next"), input[type="submit"]', 5000);
      if (emailNextClicked) {
        await page.waitForTimeout(2000);
      }

      // Fill Google password
      const passwordTyped = await safeType(page, 'input[type="password"]', googlePassword, 10000);
      if (!passwordTyped) {
        return { success: false, error: 'Could not find Google password input' };
      }
      console.log('[EducationScraper] Filled Google password');

      await takeScreenshot(page, 'boost-3-password-filled');

      // Click Sign In / Next on password page
      const signInClicked = await safeClick(page, '#passwordNext, button:has-text("Sign in"), button:has-text("Next"), input[type="submit"]', 5000);
      if (!signInClicked) {
        return { success: false, error: 'Could not find Google sign-in button' };
      }

      // Wait for redirect back to Boost
      await waitForNavigation(page, 20000);
      console.log('[EducationScraper] Final URL:', page.url());
      await takeScreenshot(page, 'boost-4-final');
    }

    // Check for login success - we should be on Boost dashboard
    try {
      await page.waitForSelector(config.selectors.loginSuccess, { state: 'visible', timeout: 15000 });
      console.log('[EducationScraper] Boost login successful!');
      return { success: true };
    } catch {
      // Check if we're at least on the Boost domain
      if (page.url().includes('boost.lifted-management.com')) {
        console.log('[EducationScraper] On Boost domain, assuming success');
        return { success: true };
      }
      return { success: false, error: `Login may have failed. Final URL: ${page.url()}` };
    }
  } catch (error) {
    return {
      success: false,
      error: `Boost OAuth error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Login to Zearn (direct form login - form is on the main page)
 */
async function loginToZearn(
  page: Page,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const config = PLATFORM_CONFIGS.zearn;

  try {
    console.log('[EducationScraper] Starting Zearn login...');

    // Navigate to Zearn main page - login form is directly on the page
    await page.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('[EducationScraper] On Zearn page:', page.url());
    await takeScreenshot(page, 'zearn-1-initial');

    // Fill the login form directly (no need to click "Sign In" first)
    const usernameTyped = await safeType(page, config.selectors.usernameInput, username, 10000);
    if (!usernameTyped) {
      return { success: false, error: 'Could not find Zearn username input' };
    }
    console.log('[EducationScraper] Filled Zearn username');

    const passwordTyped = await safeType(page, config.selectors.passwordInput, password, 5000);
    if (!passwordTyped) {
      return { success: false, error: 'Could not find Zearn password input' };
    }
    console.log('[EducationScraper] Filled Zearn password');

    await takeScreenshot(page, 'zearn-2-credentials-filled');

    // Click login button
    const loginClicked = await safeClick(page, config.selectors.loginButton, 5000);
    if (!loginClicked) {
      return { success: false, error: 'Could not find Zearn login button' };
    }

    // Wait for page to update (Zearn stays on same URL but content changes)
    await page.waitForTimeout(5000);
    console.log('[EducationScraper] Zearn URL after login:', page.url());
    await takeScreenshot(page, 'zearn-3-final');

    // Check for login success - look for "Sign Out" button or student content
    const signOutExists = await elementExists(page, 'a:has-text("Sign Out"), button:has-text("Sign Out"), .sign-out');
    if (signOutExists) {
      console.log('[EducationScraper] Zearn login successful! (found Sign Out)');
      return { success: true };
    }

    // Alternative: check page content for student indicators
    const pageContent = await page.content();
    if (pageContent.includes('Sign Out') || pageContent.includes('Next Up') || pageContent.includes('Math Library')) {
      console.log('[EducationScraper] Zearn login successful! (found student content)');
      return { success: true };
    }

    // Check for error message
    const errorExists = await elementExists(page, '.error-message, .alert-danger, [role="alert"], .flash-error, .invalid-feedback, .error');
    if (errorExists) {
      const errorText = await safeGetText(page, '.error-message, .alert-danger, [role="alert"], .flash-error, .invalid-feedback, .error');
      return { success: false, error: errorText || 'Zearn login failed - invalid credentials' };
    }

    // Check if login form is still present (login failed)
    const loginFormStillPresent = await elementExists(page, config.selectors.usernameInput);
    if (loginFormStillPresent) {
      return { success: false, error: 'Zearn login failed - form still present' };
    }

    // Assume success if we got this far
    console.log('[EducationScraper] Zearn login appears successful');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Zearn login error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Login to Lexia (direct form login)
 */
async function loginToLexia(
  page: Page,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const config = PLATFORM_CONFIGS.lexia;

  try {
    console.log('[EducationScraper] Starting Lexia login...');

    // Navigate to Lexia
    await page.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('[EducationScraper] On Lexia page:', page.url());
    await takeScreenshot(page, 'lexia-1-initial');

    // Check if redirected to unsupported browser page
    if (page.url().includes('unsupportedBrowser')) {
      return { success: false, error: 'Lexia requires a supported browser. May need to access via Boost Resources tab.' };
    }

    // Fill username
    const usernameTyped = await safeType(page, config.selectors.usernameInput, username, 10000);
    if (!usernameTyped) {
      return { success: false, error: 'Could not find Lexia username input' };
    }

    // Fill password
    const passwordTyped = await safeType(page, config.selectors.passwordInput, password, 5000);
    if (!passwordTyped) {
      return { success: false, error: 'Could not find Lexia password input' };
    }

    // Click login
    const loginClicked = await safeClick(page, config.selectors.loginButton, 5000);
    if (!loginClicked) {
      return { success: false, error: 'Could not find Lexia login button' };
    }

    // Wait for navigation
    await waitForNavigation(page, 15000);

    // Check success
    try {
      await page.waitForSelector(config.selectors.loginSuccess, { state: 'visible', timeout: 15000 });
      console.log('[EducationScraper] Lexia login successful!');
      return { success: true };
    } catch {
      return { success: false, error: 'Lexia login failed' };
    }
  } catch (error) {
    return {
      success: false,
      error: `Lexia login error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Login to education platform using Playwright
 * Routes to appropriate login handler based on platform type
 */
async function loginToPlatform(
  page: Page,
  platform: PlatformType,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const config = PLATFORM_CONFIGS[platform];

  try {
    console.log(`[EducationScraper] Login attempt for ${platform} (type: ${config.loginType || 'direct'})`);

    // Route to platform-specific login handler
    switch (platform) {
      case 'canyon_grove':
        // Boost uses Google OAuth
        return await loginToBoostViaGoogleOAuth(page, username, password);

      case 'zearn':
        // Zearn requires clicking Sign In first
        return await loginToZearn(page, username, password);

      case 'lexia':
        // Lexia uses direct form login
        return await loginToLexia(page, username, password);

      default:
        // Default direct form login for other platforms
        console.log(`[EducationScraper] Using default login for ${platform}`);
        await page.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });

        const usernameTyped = await safeType(page, config.selectors.usernameInput, username, 10000);
        if (!usernameTyped) {
          return { success: false, error: 'Could not find username input field' };
        }

        const passwordTyped = await safeType(page, config.selectors.passwordInput, password, 5000);
        if (!passwordTyped) {
          return { success: false, error: 'Could not find password input field' };
        }

        const loginClicked = await safeClick(page, config.selectors.loginButton, 5000);
        if (!loginClicked) {
          return { success: false, error: 'Could not find login button' };
        }

        await waitForNavigation(page, 15000);

        try {
          await page.waitForSelector(config.selectors.loginSuccess, { state: 'visible', timeout: 15000 });
          console.log(`[EducationScraper] Login successful for ${platform}`);
          return { success: true };
        } catch {
          const errorExists = await elementExists(page, '.error-message, .alert-danger, [role="alert"]');
          if (errorExists) {
            const errorText = await safeGetText(page, '.error-message, .alert-danger, [role="alert"]');
            return { success: false, error: errorText || 'Login failed' };
          }
          return { success: false, error: 'Login failed - could not verify success' };
        }
    }
  } catch (error) {
    return {
      success: false,
      error: `Login error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Scrape assignments from page using Playwright
 */
async function scrapeAssignmentsFromPage(
  page: Page,
  platform: PlatformType
): Promise<ScrapedAssignment[]> {
  const config = PLATFORM_CONFIGS[platform];
  const assignments: ScrapedAssignment[] = [];

  try {
    // Navigate to assignments page
    await page.goto(config.assignmentsUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for assignments to load
    try {
      await page.waitForSelector(config.selectors.assignmentCard, { state: 'visible', timeout: 10000 });
    } catch {
      console.log(`[EducationScraper] No assignment cards found for ${platform}`);
      return [];
    }

    // Get all assignment cards
    const cards = await page.$$(config.selectors.assignmentCard);
    console.log(`[EducationScraper] Found ${cards.length} assignment cards for ${platform}`);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];

      try {
        // Helper to get text from card element
        const getCardText = async (selector: string, defaultValue = ''): Promise<string> => {
          try {
            const el = await card.$(selector);
            if (!el) return defaultValue;
            const text = await el.textContent();
            return text?.trim() || defaultValue;
          } catch {
            return defaultValue;
          }
        };

        // Helper to get attribute from card element
        const getCardAttr = async (selector: string | null, attr: string): Promise<string> => {
          try {
            if (!selector) {
              // Get attribute from card itself
              const val = await card.getAttribute(attr);
              return val || '';
            }
            const el = await card.$(selector);
            if (!el) return '';
            const val = await el.getAttribute(attr);
            return val || '';
          } catch {
            return '';
          }
        };

        // Extract assignment data
        const title = await getCardText(config.selectors.assignmentTitle, `Assignment ${i + 1}`);
        const subject = await getCardText(config.selectors.assignmentSubject, 'Other');
        const dueDateText = await getCardText(config.selectors.assignmentDueDate);
        const statusText = await getCardText(config.selectors.assignmentStatus, 'pending');
        const scoreText = config.selectors.assignmentScore ? await getCardText(config.selectors.assignmentScore) : '';
        const description = config.selectors.assignmentDescription ? await getCardText(config.selectors.assignmentDescription) : '';
        const url = config.selectors.assignmentLink ? await getCardAttr(config.selectors.assignmentLink, 'href') : '';

        // Generate unique ID
        const id = await getCardAttr(null, 'data-assignment-id') ||
                   await getCardAttr(null, 'data-id') ||
                   await getCardAttr(null, 'id') ||
                   `${platform}-${title.replace(/\s+/g, '-').toLowerCase()}-${i}`;

        // Parse score if available
        let score: number | undefined;
        let maxScore: number | undefined;
        if (scoreText) {
          const scoreMatch = scoreText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
          if (scoreMatch) {
            score = parseFloat(scoreMatch[1]);
            maxScore = parseFloat(scoreMatch[2]);
          }
        }

        const dueDateTs = parseDate(dueDateText);
        const status = determineStatus(statusText, dueDateTs);

        assignments.push({
          id,
          title,
          subject,
          dueDate: dueDateText || null,
          assignedDate: null,
          status,
          score,
          maxScore,
          url: url ? (url.startsWith('http') ? url : `${config.baseUrl}${url}`) : undefined,
          description: description || undefined,
        });
      } catch (cardError) {
        console.warn(`[EducationScraper] Failed to parse card ${i}:`, cardError);
      }
    }
  } catch (error) {
    console.error(`[EducationScraper] Failed to scrape assignments:`, error);
  }

  return assignments;
}

/**
 * Main scrape function for a platform using Playwright
 */
export async function scrapePlatform(
  platform: PlatformType,
  studentId: string,
  options: { debug?: boolean; screenshot?: boolean } = {}
): Promise<ScrapeResult> {
  const now = Math.floor(Date.now() / 1000);
  const config = PLATFORM_CONFIGS[platform];

  // Get credentials using platform-specific env var names
  const { usernameVar, passwordVar } = getPlatformEnvVars(platform);
  const envUsername = safeConfig(usernameVar, '');
  const envPassword = safeConfig(passwordVar, '');

  if (!envUsername || !envPassword) {
    const error = `${config.name} credentials not configured. Set ${usernameVar} and ${passwordVar}.`;

    recordSyncLog({
      platform,
      student_id: studentId,
      success: false,
      assignments_found: 0,
      assignments_new: 0,
      assignments_updated: 0,
      error,
      synced_at: now,
    });

    return { success: false, assignments: [], error, syncedAt: now };
  }

  let page: Page | null = null;
  let context: BrowserContext | null = null;

  try {
    // Create new page with context using Playwright
    const result = await createPage();
    page = result.page;
    context = result.context;

    console.log(`[EducationScraper] Starting scrape for ${platform}`);

    // Login
    const loginResult = await loginToPlatform(page, platform, envUsername, envPassword);

    if (!loginResult.success) {
      upsertPlatformCredentials({
        platform,
        username: envUsername,
        status: 'error',
        error_message: loginResult.error,
      });

      recordSyncLog({
        platform,
        student_id: studentId,
        success: false,
        assignments_found: 0,
        assignments_new: 0,
        assignments_updated: 0,
        error: loginResult.error,
        synced_at: now,
      });

      return { success: false, assignments: [], error: loginResult.error, syncedAt: now };
    }

    // Save successful login
    upsertPlatformCredentials({
      platform,
      username: envUsername,
      last_login_at: now,
      status: 'active',
    });

    // Scrape assignments
    const assignments = await scrapeAssignmentsFromPage(page, platform);

    // Optional screenshot for debugging
    let screenshotPath: string | undefined;
    if (options.screenshot || options.debug) {
      screenshotPath = await takeScreenshot(page, `${platform}-scrape`);
    }

    // Record sync
    recordSyncLog({
      platform,
      student_id: studentId,
      success: true,
      assignments_found: assignments.length,
      assignments_new: 0, // Will be updated below
      assignments_updated: 0, // Will be updated below
      synced_at: now,
    });

    console.log(`[EducationScraper] Successfully scraped ${assignments.length} assignments from ${platform}`);

    return {
      success: true,
      assignments,
      syncedAt: now,
      screenshotPath,
    };
  } catch (error) {
    const errorMsg = `Scrape error: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[EducationScraper] Error scraping ${platform}:`, error);

    recordSyncLog({
      platform,
      student_id: studentId,
      success: false,
      assignments_found: 0,
      assignments_new: 0,
      assignments_updated: 0,
      error: errorMsg,
      synced_at: now,
    });

    return { success: false, assignments: [], error: errorMsg, syncedAt: now };
  } finally {
    // Close context (which closes the page as well)
    if (context) {
      await context.close();
    }
  }
}

/**
 * Sync assignments from a platform to the database
 */
export async function syncPlatformAssignments(
  platform: PlatformType,
  studentId: string
): Promise<{
  success: boolean;
  newCount: number;
  updatedCount: number;
  totalFound: number;
  error?: string;
}> {
  const scrapeResult = await scrapePlatform(platform, studentId);

  if (!scrapeResult.success) {
    return {
      success: false,
      newCount: 0,
      updatedCount: 0,
      totalFound: 0,
      error: scrapeResult.error,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  let newCount = 0;
  let updatedCount = 0;

  for (const assignment of scrapeResult.assignments) {
    const existing = getAssignmentByPlatformId(platform, assignment.id);
    const subject = mapSubject(assignment.subject);

    if (existing) {
      // Update existing
      const updated = updateAssignment(existing.id, {
        title: assignment.title,
        subject,
        due_date: parseDate(assignment.dueDate),
        status: assignment.status,
        score: assignment.score,
        max_score: assignment.maxScore,
        url: assignment.url,
        description: assignment.description,
        synced_at: now,
      });

      if (updated) {
        updatedCount++;
      }
    } else {
      // Create new
      createAssignment({
        platform,
        platform_id: assignment.id,
        student_id: studentId,
        subject,
        title: assignment.title,
        description: assignment.description,
        due_date: parseDate(assignment.dueDate),
        assigned_date: parseDate(assignment.assignedDate),
        status: assignment.status,
        score: assignment.score,
        max_score: assignment.maxScore,
        url: assignment.url,
        synced_at: now,
      });

      // Record to memory
      await recordAssignment({
        platform: PLATFORM_CONFIGS[platform].name,
        subject,
        title: assignment.title,
        dueDate: assignment.dueDate || undefined,
        status: assignment.status,
        notes: assignment.description,
      });

      newCount++;
    }
  }

  return {
    success: true,
    newCount,
    updatedCount,
    totalFound: scrapeResult.assignments.length,
  };
}

/**
 * Get credential env var names for each platform
 */
function getPlatformEnvVars(platform: PlatformType): { usernameVar: string; passwordVar: string } {
  switch (platform) {
    case 'canyon_grove':
      return { usernameVar: 'CANYON_GROVE_USERNAME', passwordVar: 'CANYON_GROVE_PASSWORD' };
    case 'lexia':
      return { usernameVar: 'LEXIA_USERNAME', passwordVar: 'LEXIA_PASSWORD' };
    case 'zearn':
      return { usernameVar: 'ZEARN_USERNAME', passwordVar: 'ZEARN_PASSWORD' };
    default:
      return { usernameVar: `${platform.toUpperCase()}_USERNAME`, passwordVar: `${platform.toUpperCase()}_PASSWORD` };
  }
}

/**
 * Check if a platform is configured
 */
export function isPlatformConfigured(platform: PlatformType): boolean {
  const { usernameVar, passwordVar } = getPlatformEnvVars(platform);
  const username = safeConfig(usernameVar, '');
  const password = safeConfig(passwordVar, '');
  return !!(username && password);
}

/**
 * Get all configured platforms
 */
export function getConfiguredPlatforms(): PlatformType[] {
  const platforms: PlatformType[] = ['canyon_grove', 'google_classroom', 'canvas', 'lexia', 'zearn'];
  return platforms.filter(p => isPlatformConfigured(p));
}

/**
 * Get platform status
 */
export function getPlatformStatus(platform: PlatformType): {
  configured: boolean;
  name: string;
  lastSync?: number;
  status: 'active' | 'expired' | 'error' | 'not_configured';
  error?: string;
} {
  const config = PLATFORM_CONFIGS[platform];

  if (!isPlatformConfigured(platform)) {
    return { configured: false, name: config.name, status: 'not_configured' };
  }

  const credentials = getPlatformCredentials(platform);
  return {
    configured: true,
    name: config.name,
    lastSync: credentials?.last_login_at,
    status: credentials?.status || 'active',
    error: credentials?.error_message,
  };
}
