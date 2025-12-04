/**
 * Canyon Grove Boost Scraper
 *
 * Scrapes assignment data from Canyon Grove Boost education platform.
 * Uses session-based authentication to maintain login state.
 *
 * NOTE: This scraper requires valid credentials to function.
 * Configure via:
 * - CANYON_GROVE_USERNAME env var
 * - CANYON_GROVE_PASSWORD env var (or secure storage)
 */

import { ensureServerOnly } from '../server-only-guard';
import {
  createAssignment,
  updateAssignment,
  getAssignmentByPlatformId,
  getPlatformCredentials,
  upsertPlatformCredentials,
  recordSyncLog,
  type Assignment,
  type SubjectArea,
} from './education-store';
import { recordAssignment } from './education-memory';
import { safeConfig } from '../safe-config';

ensureServerOnly('lib/hyro/canyon-grove-scraper');

const CANYON_GROVE_BASE_URL = 'https://boost.canyongrove.org';

interface CanyonGroveAssignment {
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

interface ScraperResult {
  success: boolean;
  assignments: CanyonGroveAssignment[];
  error?: string;
  syncedAt: number;
}

/**
 * Map Canyon Grove subject names to our standard subject areas
 */
function mapSubject(canyonGroveSubject: string): SubjectArea {
  const normalized = canyonGroveSubject.toLowerCase().trim();

  if (normalized.includes('math') || normalized.includes('algebra') || normalized.includes('geometry')) {
    return 'math';
  }
  if (normalized.includes('read') || normalized.includes('language arts') || normalized.includes('ela')) {
    return 'reading';
  }
  if (normalized.includes('writ') || normalized.includes('english')) {
    return 'writing';
  }
  if (normalized.includes('science') || normalized.includes('biology') || normalized.includes('chemistry') || normalized.includes('physics')) {
    return 'science';
  }
  if (normalized.includes('history') || normalized.includes('social') || normalized.includes('geography') || normalized.includes('civics')) {
    return 'social_studies';
  }
  if (normalized.includes('art') || normalized.includes('draw') || normalized.includes('paint')) {
    return 'art';
  }
  if (normalized.includes('music') || normalized.includes('band') || normalized.includes('choir')) {
    return 'music';
  }
  if (normalized.includes('pe') || normalized.includes('physical') || normalized.includes('gym') || normalized.includes('health')) {
    return 'pe';
  }

  return 'other';
}

/**
 * Parse date string from Canyon Grove format
 */
function parseDate(dateStr: string | null | undefined): number | undefined {
  if (!dateStr) return undefined;

  try {
    // Try various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000);
    }

    // Try MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(parsed.getTime())) {
        return Math.floor(parsed.getTime() / 1000);
      }
    }
  } catch {
    // Ignore parse errors
  }

  return undefined;
}

/**
 * Create a session with Canyon Grove Boost
 * Returns session cookies on success
 */
async function createSession(username: string, password: string): Promise<{ success: boolean; cookies?: string; error?: string }> {
  try {
    // Step 1: Get login page to capture any CSRF tokens
    const loginPageResponse = await fetch(`${CANYON_GROVE_BASE_URL}/login`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!loginPageResponse.ok) {
      return { success: false, error: `Failed to load login page: ${loginPageResponse.status}` };
    }

    // Extract cookies from login page
    const initialCookies = loginPageResponse.headers.get('set-cookie') || '';

    // Step 2: Submit login form
    const loginResponse = await fetch(`${CANYON_GROVE_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': initialCookies,
      },
      body: new URLSearchParams({
        username,
        password,
        remember: '1',
      }).toString(),
      redirect: 'manual', // Don't follow redirects automatically
    });

    // Check for successful login (usually redirects to dashboard)
    if (loginResponse.status === 302 || loginResponse.status === 200) {
      const sessionCookies = loginResponse.headers.get('set-cookie') || initialCookies;

      // Verify session by checking dashboard access
      const dashboardResponse = await fetch(`${CANYON_GROVE_BASE_URL}/dashboard`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Cookie': sessionCookies,
        },
      });

      if (dashboardResponse.ok) {
        return { success: true, cookies: sessionCookies };
      }
    }

    return { success: false, error: 'Login failed - invalid credentials or session' };
  } catch (error) {
    return { success: false, error: `Login error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Scrape assignments from Canyon Grove Boost
 * Uses stored session or creates new one if needed
 */
async function scrapeAssignments(cookies: string): Promise<ScraperResult> {
  try {
    // Fetch assignments page
    const response = await fetch(`${CANYON_GROVE_BASE_URL}/assignments`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': cookies,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        assignments: [],
        error: `Failed to fetch assignments: ${response.status}`,
        syncedAt: Math.floor(Date.now() / 1000),
      };
    }

    const html = await response.text();
    const assignments = parseAssignmentsFromHTML(html);

    return {
      success: true,
      assignments,
      syncedAt: Math.floor(Date.now() / 1000),
    };
  } catch (error) {
    return {
      success: false,
      assignments: [],
      error: `Scrape error: ${error instanceof Error ? error.message : String(error)}`,
      syncedAt: Math.floor(Date.now() / 1000),
    };
  }
}

/**
 * Parse assignments from HTML response
 * NOTE: This is a simplified parser - actual implementation would need to match
 * the specific HTML structure of Canyon Grove Boost
 */
function parseAssignmentsFromHTML(html: string): CanyonGroveAssignment[] {
  const assignments: CanyonGroveAssignment[] = [];

  // This is a placeholder implementation
  // Real implementation would use cheerio or similar to parse the HTML

  // Look for assignment cards/rows in the HTML
  // Example pattern (adjust based on actual HTML structure):
  // <div class="assignment-card" data-id="123">
  //   <h3 class="title">Assignment Title</h3>
  //   <span class="subject">Math</span>
  //   <span class="due-date">12/15/2025</span>
  //   <span class="status">pending</span>
  // </div>

  // Using regex as a fallback (less reliable but works without cheerio)
  const assignmentPattern = /<div[^>]*class="[^"]*assignment[^"]*"[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/div>/gi;
  let match;

  while ((match = assignmentPattern.exec(html)) !== null) {
    const [, id, content] = match;

    // Extract title
    const titleMatch = content.match(/<[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</i);
    const title = titleMatch?.[1]?.trim() || 'Untitled';

    // Extract subject
    const subjectMatch = content.match(/<[^>]*class="[^"]*subject[^"]*"[^>]*>([^<]+)</i);
    const subject = subjectMatch?.[1]?.trim() || 'Other';

    // Extract due date
    const dueDateMatch = content.match(/<[^>]*class="[^"]*due[^"]*date[^"]*"[^>]*>([^<]+)</i);
    const dueDate = dueDateMatch?.[1]?.trim() || null;

    // Extract status
    const statusMatch = content.match(/<[^>]*class="[^"]*status[^"]*"[^>]*>([^<]+)</i);
    const statusText = statusMatch?.[1]?.trim().toLowerCase() || 'pending';
    const status = statusText.includes('complete') ? 'completed' :
                   statusText.includes('overdue') ? 'overdue' : 'pending';

    // Extract score if available
    const scoreMatch = content.match(/(\d+)\s*\/\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : undefined;
    const maxScore = scoreMatch ? parseInt(scoreMatch[2]) : undefined;

    assignments.push({
      id,
      title,
      subject,
      dueDate,
      assignedDate: null,
      status,
      score,
      maxScore,
      url: `${CANYON_GROVE_BASE_URL}/assignments/${id}`,
    });
  }

  // If no assignments found with pattern, try JSON API if available
  if (assignments.length === 0) {
    // Some platforms embed assignment data as JSON
    const jsonMatch = html.match(/window\.__ASSIGNMENTS__\s*=\s*(\[[\s\S]*?\]);/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        for (const item of jsonData) {
          assignments.push({
            id: String(item.id),
            title: item.title || item.name || 'Untitled',
            subject: item.subject || item.class || 'Other',
            dueDate: item.dueDate || item.due_date || null,
            assignedDate: item.assignedDate || item.assigned_date || null,
            status: item.status || 'pending',
            score: item.score,
            maxScore: item.maxScore || item.max_score,
            url: item.url || `${CANYON_GROVE_BASE_URL}/assignments/${item.id}`,
            description: item.description,
          });
        }
      } catch {
        // JSON parse failed
      }
    }
  }

  return assignments;
}

/**
 * Sync assignments from Canyon Grove Boost
 * Main entry point for the scraper
 */
export async function syncCanyonGroveAssignments(studentId: string): Promise<{
  success: boolean;
  newCount: number;
  updatedCount: number;
  totalFound: number;
  error?: string;
}> {
  const platform = 'canyon_grove';
  const now = Math.floor(Date.now() / 1000);

  // Get credentials
  let credentials = getPlatformCredentials(platform);
  let cookies = credentials?.cookies;

  // Check if we need to login
  if (!cookies || credentials?.status !== 'active') {
    const username = safeConfig('CANYON_GROVE_USERNAME', '');
    const password = safeConfig('CANYON_GROVE_PASSWORD', '');

    if (!username || !password) {
      const error = 'Canyon Grove credentials not configured. Set CANYON_GROVE_USERNAME and CANYON_GROVE_PASSWORD.';
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
      return { success: false, newCount: 0, updatedCount: 0, totalFound: 0, error };
    }

    // Create new session
    const sessionResult = await createSession(username, password);
    if (!sessionResult.success || !sessionResult.cookies) {
      upsertPlatformCredentials({
        platform,
        username,
        status: 'error',
        error_message: sessionResult.error,
      });

      recordSyncLog({
        platform,
        student_id: studentId,
        success: false,
        assignments_found: 0,
        assignments_new: 0,
        assignments_updated: 0,
        error: sessionResult.error,
        synced_at: now,
      });

      return { success: false, newCount: 0, updatedCount: 0, totalFound: 0, error: sessionResult.error };
    }

    // Save successful session
    cookies = sessionResult.cookies;
    upsertPlatformCredentials({
      platform,
      username,
      cookies,
      last_login_at: now,
      status: 'active',
    });
  }

  // Scrape assignments
  const scrapeResult = await scrapeAssignments(cookies!);

  if (!scrapeResult.success) {
    // Session might be expired - mark for re-login
    upsertPlatformCredentials({
      platform,
      status: 'expired',
      error_message: scrapeResult.error,
    });

    recordSyncLog({
      platform,
      student_id: studentId,
      success: false,
      assignments_found: 0,
      assignments_new: 0,
      assignments_updated: 0,
      error: scrapeResult.error,
      synced_at: now,
    });

    return { success: false, newCount: 0, updatedCount: 0, totalFound: scrapeResult.assignments.length, error: scrapeResult.error };
  }

  // Process assignments
  let newCount = 0;
  let updatedCount = 0;

  for (const cgAssignment of scrapeResult.assignments) {
    const existing = getAssignmentByPlatformId(platform, cgAssignment.id);
    const subject = mapSubject(cgAssignment.subject);

    if (existing) {
      // Update existing assignment
      const updated = updateAssignment(existing.id, {
        title: cgAssignment.title,
        subject,
        due_date: parseDate(cgAssignment.dueDate),
        status: cgAssignment.status,
        score: cgAssignment.score,
        max_score: cgAssignment.maxScore,
        url: cgAssignment.url,
        description: cgAssignment.description,
        synced_at: now,
      });

      if (updated) {
        updatedCount++;
      }
    } else {
      // Create new assignment
      const newAssignment = createAssignment({
        platform,
        platform_id: cgAssignment.id,
        student_id: studentId,
        subject,
        title: cgAssignment.title,
        description: cgAssignment.description,
        due_date: parseDate(cgAssignment.dueDate),
        assigned_date: parseDate(cgAssignment.assignedDate),
        status: cgAssignment.status,
        score: cgAssignment.score,
        max_score: cgAssignment.maxScore,
        url: cgAssignment.url,
        synced_at: now,
      });

      // Record to Zep memory
      await recordAssignment({
        platform: 'Canyon Grove Boost',
        subject,
        title: cgAssignment.title,
        dueDate: cgAssignment.dueDate || undefined,
        status: cgAssignment.status,
        notes: cgAssignment.description,
      });

      newCount++;
    }
  }

  // Record sync log
  recordSyncLog({
    platform,
    student_id: studentId,
    success: true,
    assignments_found: scrapeResult.assignments.length,
    assignments_new: newCount,
    assignments_updated: updatedCount,
    synced_at: now,
  });

  return {
    success: true,
    newCount,
    updatedCount,
    totalFound: scrapeResult.assignments.length,
  };
}

/**
 * Check if Canyon Grove is configured
 */
export function isCanyonGroveConfigured(): boolean {
  const username = safeConfig('CANYON_GROVE_USERNAME', '');
  const password = safeConfig('CANYON_GROVE_PASSWORD', '');
  return !!(username && password);
}

/**
 * Get Canyon Grove sync status
 */
export function getCanyonGroveSyncStatus(): {
  configured: boolean;
  lastSync?: number;
  status: 'active' | 'expired' | 'error' | 'not_configured';
  error?: string;
} {
  if (!isCanyonGroveConfigured()) {
    return { configured: false, status: 'not_configured' };
  }

  const credentials = getPlatformCredentials('canyon_grove');
  return {
    configured: true,
    lastSync: credentials?.last_login_at,
    status: credentials?.status || 'active',
    error: credentials?.error_message,
  };
}
