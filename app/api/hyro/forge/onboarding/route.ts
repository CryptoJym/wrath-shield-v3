/**
 * HYRO FORGE: Onboarding API
 * POST /api/hyro/forge/onboarding - Handle onboarding step completion
 *
 * Body: {
 *   step: 'welcome' | 'profile' | 'grade' | 'goals' | 'complete',
 *   data: {
 *     displayName?: string,
 *     gradeLevel?: number,
 *     goals?: string[],
 *     ...
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStudent, updateStudent, completeOnboarding } from '@/lib/hyro/student-auth';
import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';

interface OnboardingStepData {
  step: 'welcome' | 'profile' | 'grade' | 'goals' | 'complete';
  data: {
    displayName?: string;
    gradeLevel?: number;
    goals?: string[];
    [key: string]: unknown;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { studentId, isAuthenticated, student } = await getCurrentStudent();

    if (!isAuthenticated || !student) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body: OnboardingStepData = await request.json();
    const { step, data } = body;

    if (!step) {
      return NextResponse.json(
        { success: false, error: 'Missing step parameter' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Handle each onboarding step
    switch (step) {
      case 'welcome':
        // Just acknowledge the welcome step
        updateStudent(studentId, { onboarding_step: 'profile' });
        break;

      case 'profile':
        // Update display name and avatar if provided
        if (data.displayName) {
          updateStudent(studentId, {
            display_name: data.displayName,
            onboarding_step: 'grade',
          });
        } else {
          updateStudent(studentId, { onboarding_step: 'grade' });
        }
        break;

      case 'grade':
        // Update grade level
        if (data.gradeLevel !== undefined) {
          updateStudent(studentId, {
            grade_level: data.gradeLevel,
            onboarding_step: 'goals',
          });
        } else {
          return NextResponse.json(
            { success: false, error: 'Grade level is required' },
            { status: 400 }
          );
        }
        break;

      case 'goals':
        // Save goals to preferences and move to completion
        const preferences = student.preferences || {};
        updateStudent(studentId, {
          preferences: {
            ...preferences,
            goals: data.goals || [],
          },
          onboarding_step: 'complete',
        });
        break;

      case 'complete':
        // Initialize character and stats for new student
        try {
          initializeStudentCharacter(db, studentId, student.display_name, data);
          completeOnboarding(studentId);
        } catch (error) {
          console.error('[Onboarding] Character initialization failed:', error);
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to initialize character: ' + (error instanceof Error ? error.message : 'Unknown error'),
            },
            { status: 500 }
          );
        }
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid step' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        step,
        nextStep: getNextStep(step),
        completed: step === 'complete',
      },
    });
  } catch (error) {
    console.error('[Forge Onboarding] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Initialize character and stats for a new student
 */
function initializeStudentCharacter(
  db: ReturnType<typeof getDatabase>,
  studentId: string,
  displayName: string,
  data: OnboardingStepData['data']
): void {
  // Check if character already exists
  const existingCharacter = db
    .prepare('SELECT id FROM hyro_character WHERE student_id = ?')
    .get(studentId);

  if (!existingCharacter) {
    // Create character entry
    db.prepare(`
      INSERT INTO hyro_character (id, student_id, display_name, title, level, total_xp)
      VALUES (?, ?, ?, 'Apprentice Forger', 1, 0)
    `).run(randomUUID(), studentId, displayName || 'Student');
    console.log(`[Onboarding] Created character for student ${studentId}`);
  } else {
    console.log(`[Onboarding] Character already exists for student ${studentId}`);
  }

  // Check if stats already exist for this student
  const existingStats = db
    .prepare('SELECT COUNT(*) as count FROM hyro_stats WHERE student_id = ?')
    .get(studentId) as { count: number };

  if (existingStats.count > 0) {
    console.log(`[Onboarding] Stats already exist for student ${studentId} (${existingStats.count} stats)`);
    return;
  }

  // Create initial stats for this student
  const stats = [
    { name: 'math', display: 'Mathematics', value: 20 },
    { name: 'reading', display: 'Reading & Language Arts', value: 20 },
    { name: 'science', display: 'Science', value: 20 },
    { name: 'coding', display: 'Coding & Logic', value: 20 },
    { name: 'study_skills', display: 'Study Skills', value: 20 },
    { name: 'critical_thinking', display: 'Critical Thinking', value: 20 },
    { name: 'technology', display: 'Technology', value: 20 },
    { name: 'problem_solving', display: 'Problem Solving', value: 20 },
  ];

  for (const stat of stats) {
    db.prepare(`
      INSERT INTO hyro_stats (id, student_id, stat_name, display_name, base_value, current_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), studentId, stat.name, stat.display, stat.value, stat.value);
  }

  console.log(`[Onboarding] Initialized ${stats.length} stats for student ${studentId}`);
}

/**
 * Get the next step in the onboarding flow
 */
function getNextStep(currentStep: string): string | null {
  const steps = ['welcome', 'profile', 'grade', 'goals', 'complete'];
  const currentIndex = steps.indexOf(currentStep);
  return currentIndex >= 0 && currentIndex < steps.length - 1
    ? steps[currentIndex + 1]
    : null;
}
