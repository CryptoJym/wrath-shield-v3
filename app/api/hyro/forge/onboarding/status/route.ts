/**
 * HYRO FORGE: Onboarding Status API
 * GET /api/hyro/forge/onboarding/status - Check student's onboarding status
 */

import { NextResponse } from 'next/server';
import { getCurrentStudent } from '@/lib/hyro/student-auth';

export async function GET() {
  try {
    const { student, isAuthenticated, needsOnboarding } = await getCurrentStudent();

    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        needsOnboarding,
        currentStep: student?.onboarding_step || 'welcome',
        studentId: student?.id,
        displayName: student?.display_name,
        gradeLevel: student?.grade_level,
        onboardingCompleted: student?.onboarding_completed,
      },
    });
  } catch (error) {
    console.error('[Forge Onboarding Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
