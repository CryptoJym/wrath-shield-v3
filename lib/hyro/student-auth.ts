/**
 * HYRO FORGE: Student Authentication Helper
 *
 * Extracts the current student from Clerk auth and manages student profiles.
 * This is the bridge between Clerk auth and HYRO FORGE's multi-tenant data.
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { getDatabase } from '@/lib/db/Database';

export interface Student {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  grade_level: number;
  birth_year: number | null;
  timezone: string;
  onboarding_completed: boolean;
  onboarding_step: string;
  parent_user_id: string | null;
  parent_email: string | null;
  platform_credentials: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
}

export interface StudentContext {
  studentId: string;
  student: Student | null;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
}

/**
 * Get the current student from Clerk auth
 * Creates a new student profile if this is their first login
 */
export async function getCurrentStudent(): Promise<StudentContext> {
  const { userId } = await auth();

  if (!userId) {
    return {
      studentId: 'hyro', // Fallback for unauthenticated access (dev mode)
      student: null,
      isAuthenticated: false,
      needsOnboarding: false,
    };
  }

  const db = getDatabase();

  // Check if student exists
  let student = db.prepare(`
    SELECT * FROM students WHERE id = ? AND is_active = 1
  `).get(userId) as Student | undefined;

  // If no student record, create one from Clerk user data
  if (!student) {
    const clerkUser = await currentUser();

    if (clerkUser) {
      const displayName = clerkUser.firstName || clerkUser.username || 'Student';
      const email = clerkUser.primaryEmailAddress?.emailAddress || null;
      const avatarUrl = clerkUser.imageUrl || null;

      db.prepare(`
        INSERT INTO students (id, display_name, email, avatar_url, onboarding_completed, onboarding_step)
        VALUES (?, ?, ?, ?, 0, 'welcome')
      `).run(userId, displayName, email, avatarUrl);

      student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(userId) as Student;
    }
  }

  // Update last login
  if (student) {
    db.prepare(`UPDATE students SET last_login_at = unixepoch() WHERE id = ?`).run(userId);
  }

  return {
    studentId: userId,
    student: student ? parseStudent(student) : null,
    isAuthenticated: true,
    needsOnboarding: student ? !student.onboarding_completed : true,
  };
}

/**
 * Get a student by ID (for admin/parent access)
 */
export function getStudentById(studentId: string): Student | null {
  const db = getDatabase();
  const raw = db.prepare(`SELECT * FROM students WHERE id = ? AND is_active = 1`).get(studentId);
  return raw ? parseStudent(raw as Student) : null;
}

/**
 * Update student profile
 */
export function updateStudent(studentId: string, updates: Partial<Student>): Student | null {
  const db = getDatabase();

  const allowedFields = [
    'display_name', 'grade_level', 'birth_year', 'timezone',
    'onboarding_completed', 'onboarding_step', 'parent_email', 'preferences'
  ];

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = ?`);
      if (key === 'preferences' && typeof value === 'object') {
        values.push(JSON.stringify(value));
      } else if (typeof value === 'boolean') {
        // SQLite doesn't support booleans - convert to 1/0
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    }
  }

  if (setClauses.length === 0) return null;

  setClauses.push('updated_at = unixepoch()');
  values.push(studentId);

  db.prepare(`UPDATE students SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

  return getStudentById(studentId);
}

/**
 * Complete onboarding for a student
 */
export function completeOnboarding(studentId: string): Student | null {
  return updateStudent(studentId, {
    onboarding_completed: true,
    onboarding_step: 'complete',
  } as Partial<Student>);
}

/**
 * Get all students for a parent
 */
export function getStudentsByParent(parentUserId: string): Student[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM students WHERE parent_user_id = ? AND is_active = 1
  `).all(parentUserId) as Student[];
  return rows.map(parseStudent);
}

/**
 * Link a student to a parent
 */
export function linkStudentToParent(studentId: string, parentUserId: string, parentEmail?: string): Student | null {
  const db = getDatabase();
  db.prepare(`
    UPDATE students SET parent_user_id = ?, parent_email = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(parentUserId, parentEmail || null, studentId);
  return getStudentById(studentId);
}

/**
 * Validate that the current user can access a student's data
 */
export async function validateStudentAccess(targetStudentId: string): Promise<boolean> {
  const { studentId } = await getCurrentStudent();

  // User can always access their own data
  if (studentId === targetStudentId) return true;

  // Check if user is a parent of the target student
  const targetStudent = getStudentById(targetStudentId);
  if (targetStudent?.parent_user_id === studentId) return true;

  // TODO: Add admin role check via Clerk metadata

  return false;
}

/**
 * Parse raw database row into Student object
 */
function parseStudent(raw: Student): Student {
  return {
    ...raw,
    onboarding_completed: Boolean(raw.onboarding_completed),
    is_active: Boolean(raw.is_active),
    platform_credentials: raw.platform_credentials
      ? JSON.parse(raw.platform_credentials as unknown as string)
      : null,
    preferences: raw.preferences
      ? JSON.parse(raw.preferences as unknown as string)
      : null,
  };
}

/**
 * Helper to extract studentId from request (for API routes)
 * Falls back to 'hyro' for backward compatibility
 */
export async function getStudentIdFromRequest(): Promise<string> {
  const { studentId } = await getCurrentStudent();
  return studentId;
}
