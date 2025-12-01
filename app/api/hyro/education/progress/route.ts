import { NextRequest, NextResponse } from 'next/server';
import {
  listAssignments,
  getAssignmentStats,
} from '@/lib/hyro/education-store';
import { searchEducationMemory } from '@/lib/hyro/education-memory';

/**
 * Education Progress & Curriculum Triangulation API
 *
 * GET /api/hyro/education/progress
 * Returns curriculum progress analysis and calendar events
 *
 * Based on comprehensive Zearn scrape from 2025-12-01:
 * - Total 315 lesson badges earned across 11 missions
 * - G5 (Missions 1-6) + G6 (Missions 1-5)
 */

// COMPREHENSIVE ZEARN PROGRESS (verified from screenshots 2025-12-01)
// Badge counts verified by visual inspection of each mission's badge page
const ZEARN_FULL_HISTORY = {
  student: {
    name: 'Hyro',
    class: 'SJ Tuesday 6 25-26',
  },
  missions: [
    // GRADE 5 MISSIONS - ALL 100% COMPLETE
    {
      grade: 'G5',
      missionNumber: 1,
      missionName: 'Place Value with Decimal Fractions',
      earnedBadges: 16,
      totalSlots: 16,
      status: 'complete', // 100% complete
    },
    {
      grade: 'G5',
      missionNumber: 2,
      missionName: 'Base Ten Operations',
      earnedBadges: 29,
      totalSlots: 29,
      status: 'complete', // 100% complete
    },
    {
      grade: 'G5',
      missionNumber: 3,
      missionName: 'Add and Subtract Fractions',
      earnedBadges: 16,
      totalSlots: 16,
      status: 'complete', // 100% complete
    },
    {
      grade: 'G5',
      missionNumber: 4,
      missionName: 'Multiply and Divide Fractions and Decimals',
      earnedBadges: 32,
      totalSlots: 32,
      status: 'complete', // 100% complete
    },
    {
      grade: 'G5',
      missionNumber: 5,
      missionName: 'Volume, Area, and Shapes',
      earnedBadges: 19,
      totalSlots: 19,
      status: 'complete', // 100% complete
    },
    {
      grade: 'G5',
      missionNumber: 6,
      missionName: 'The Coordinate Plane',
      earnedBadges: 24,
      totalSlots: 24,
      status: 'complete', // 100% complete
    },
    // GRADE 6 MISSIONS
    {
      grade: 'G6',
      missionNumber: 1,
      missionName: 'Area and Surface Area',
      earnedBadges: 15,
      totalSlots: 15,
      status: 'complete', // 100% complete
    },
    {
      grade: 'G6',
      missionNumber: 2,
      missionName: 'Introducing Ratios',
      earnedBadges: 14,
      totalSlots: 14,
      status: 'complete', // 100% complete
    },
    {
      grade: 'G6',
      missionNumber: 3,
      missionName: 'Unit Rates and Percentages',
      earnedBadges: 12,
      totalSlots: 14,
      status: 'complete', // 86% - 2 lessons skipped by system
    },
    {
      grade: 'G6',
      missionNumber: 4,
      missionName: 'Dividing Fractions',
      earnedBadges: 14,
      totalSlots: 14,
      status: 'complete', // 100% complete
    },
    {
      grade: 'G6',
      missionNumber: 5,
      missionName: 'Arithmetic in Base Ten',
      earnedBadges: 1,
      totalSlots: 15,
      status: 'in_progress', // Currently working - 7% complete, 1 in progress
    },
  ],
  totalBadges: 192,
  scrapedAt: '2025-12-01T18:30:00.000Z',
};

// Current assignment from teacher
const CURRENT_ASSIGNMENT = {
  class: 'SJ Tuesday 6 25-26',
  mission: {
    grade: 'G6',
    number: 5,
    name: 'Arithmetic in Base Ten',
  },
  currentLesson: 2, // 1 completed, 1 in progress (yellow circle)
  totalLessons: 15, // Verified from badge page screenshot
  lessonsPerWeek: 3,
  startedAt: '2025-11-25',
  dueBy: '2025-12-20',
};

interface ProgressEvent {
  id: string;
  title: string;
  date: string;
  type: 'completed' | 'in_progress' | 'upcoming' | 'milestone' | 'on_track' | 'activity';
  platform: string;
  subject: string;
  description?: string;
  lessonNumber?: number;
}

interface MissionProgress {
  grade: string;
  mission: number;
  name: string;
  earned: number;
  total: number;
  percent: number;
  status: string;
}

function calculateProgress() {
  const missions = ZEARN_FULL_HISTORY.missions;

  // Calculate per-mission progress
  const missionProgress: MissionProgress[] = missions.map(m => ({
    grade: m.grade,
    mission: m.missionNumber,
    name: m.missionName,
    earned: m.earnedBadges,
    total: m.totalSlots,
    percent: Math.round((m.earnedBadges / m.totalSlots) * 100),
    status: m.status,
  }));

  // Summary stats
  const totalBadgesEarned = missions.reduce((sum, m) => sum + m.earnedBadges, 0);
  const totalBadgesPossible = missions.reduce((sum, m) => sum + m.totalSlots, 0);
  const overallPercent = Math.round((totalBadgesEarned / totalBadgesPossible) * 100);

  // Grade-level breakdown
  const g5Missions = missions.filter(m => m.grade === 'G5');
  const g6Missions = missions.filter(m => m.grade === 'G6');

  const g5Earned = g5Missions.reduce((sum, m) => sum + m.earnedBadges, 0);
  const g5Total = g5Missions.reduce((sum, m) => sum + m.totalSlots, 0);
  const g6Earned = g6Missions.reduce((sum, m) => sum + m.earnedBadges, 0);
  const g6Total = g6Missions.reduce((sum, m) => sum + m.totalSlots, 0);

  // Current mission progress
  const currentMission = missions.find(m =>
    m.grade === CURRENT_ASSIGNMENT.mission.grade &&
    m.missionNumber === CURRENT_ASSIGNMENT.mission.number
  );

  // Pace calculation for current assignment
  const now = new Date();
  const dueDate = new Date(CURRENT_ASSIGNMENT.dueBy);
  const startDate = new Date(CURRENT_ASSIGNMENT.startedAt);

  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceStart = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const lessonsCompleted = currentMission ? Math.floor(currentMission.earnedBadges / 2) : 1; // ~2 badges per lesson
  const lessonsRemaining = CURRENT_ASSIGNMENT.totalLessons - lessonsCompleted;

  // Expected progress
  const totalDays = Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const expectedPercent = (daysSinceStart / totalDays) * 100;
  const actualPercent = (lessonsCompleted / CURRENT_ASSIGNMENT.totalLessons) * 100;

  let paceStatus: 'ahead' | 'on_track' | 'behind' | 'at_risk';
  let recommendation: string;

  if (actualPercent >= expectedPercent + 10) {
    paceStatus = 'ahead';
    recommendation = `Excellent! Hyro is ahead of schedule on G6 Mission 5. Keep up the great work!`;
  } else if (actualPercent >= expectedPercent - 10) {
    paceStatus = 'on_track';
    recommendation = `On track! Hyro is working through G6 Mission 5 "Arithmetic in Base Ten". Currently on Lesson ${CURRENT_ASSIGNMENT.currentLesson} of ${CURRENT_ASSIGNMENT.totalLessons}. Target: ~${CURRENT_ASSIGNMENT.lessonsPerWeek} lessons/week.`;
  } else if (actualPercent >= expectedPercent - 25) {
    paceStatus = 'behind';
    recommendation = `Slightly behind. ${lessonsRemaining} lessons remaining with ${daysUntilDue} days until due. Try to complete an extra lesson this week.`;
  } else {
    paceStatus = 'at_risk';
    recommendation = `Needs attention! ${lessonsRemaining} lessons to complete in ${daysUntilDue} days. Consider scheduling extra Zearn time.`;
  }

  return {
    missionProgress,
    summary: {
      totalBadgesEarned,
      totalBadgesPossible,
      overallPercent,
      grade5: { earned: g5Earned, total: g5Total, percent: Math.round((g5Earned / g5Total) * 100) },
      grade6: { earned: g6Earned, total: g6Total, percent: Math.round((g6Earned / g6Total) * 100) },
    },
    currentAssignment: {
      ...CURRENT_ASSIGNMENT,
      lessonsCompleted,
      lessonsRemaining,
      currentBadges: currentMission?.earnedBadges || 0,
      totalBadges: currentMission?.totalSlots || 0,
      percentComplete: Math.round((lessonsCompleted / CURRENT_ASSIGNMENT.totalLessons) * 100),
    },
    pace: {
      status: paceStatus,
      daysUntilDue,
      daysSinceStart,
      expectedPercent: Math.round(expectedPercent),
      actualPercent: Math.round(actualPercent),
      recommendation,
    },
  };
}

function generateCalendarEvents(): ProgressEvent[] {
  const events: ProgressEvent[] = [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Add milestone events for completed G6 missions
  const completedG6 = ZEARN_FULL_HISTORY.missions.filter(
    m => m.grade === 'G6' && m.status === 'complete'
  );

  completedG6.forEach((mission, idx) => {
    // Estimate completion dates (spread over past months)
    const completionDate = new Date(today);
    completionDate.setDate(today.getDate() - (4 - mission.missionNumber) * 14); // ~2 weeks per mission
    events.push({
      id: `g6-m${mission.missionNumber}-complete`,
      title: `Mission ${mission.missionNumber}: ${mission.missionName}`,
      date: completionDate.toISOString().split('T')[0],
      type: 'completed',
      platform: 'Zearn Math',
      subject: 'math',
      description: `G6 Mission ${mission.missionNumber} - ${mission.earnedBadges}/${mission.totalSlots} badges (${Math.round((mission.earnedBadges / mission.totalSlots) * 100)}%)`,
    });
  });

  // Current lesson in progress
  events.push({
    id: 'current-lesson',
    title: `G6 M5 Lesson ${CURRENT_ASSIGNMENT.currentLesson}: Arithmetic in Base Ten`,
    date: todayStr,
    type: 'in_progress',
    platform: 'Zearn Math',
    subject: 'math',
    description: `Currently working - Next: PAIR COMPARE activity`,
    lessonNumber: CURRENT_ASSIGNMENT.currentLesson,
  });

  // Schedule upcoming lessons
  let lessonNum = CURRENT_ASSIGNMENT.currentLesson + 1;
  let daysAdded = 0;
  for (let i = 1; i <= 21 && lessonNum <= CURRENT_ASSIGNMENT.totalLessons; i++) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + i);
    const dayOfWeek = nextDate.getDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    events.push({
      id: `upcoming-lesson-${lessonNum}`,
      title: `G6 M5 Lesson ${lessonNum}`,
      date: nextDate.toISOString().split('T')[0],
      type: 'upcoming',
      platform: 'Zearn Math',
      subject: 'math',
      description: `${CURRENT_ASSIGNMENT.mission.name} - Scheduled`,
      lessonNumber: lessonNum,
    });
    lessonNum++;
    daysAdded++;
  }

  // Mission completion milestone
  events.push({
    id: 'mission-complete-milestone',
    title: `Complete: G6 Mission 5 - ${CURRENT_ASSIGNMENT.mission.name}`,
    date: CURRENT_ASSIGNMENT.dueBy,
    type: 'milestone',
    platform: 'Zearn Math',
    subject: 'math',
    description: `Target: Complete all ${CURRENT_ASSIGNMENT.totalLessons} lessons`,
  });

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));

  return events;
}

export async function GET(request: NextRequest) {
  try {
    const studentId = 'hyro';

    // Get assignments from SQLite store
    const assignments = listAssignments({ student_id: studentId });
    const stats = getAssignmentStats(studentId);

    // Get education memories from ZEP
    let zepMemories: any[] = [];
    try {
      zepMemories = await searchEducationMemory('Zearn lesson progress');
    } catch (e) {
      console.log('[Progress] ZEP search failed:', e);
    }

    // Calculate comprehensive progress
    const progress = calculateProgress();

    // Generate calendar events
    const calendarEvents = generateCalendarEvents();

    return NextResponse.json({
      success: true,
      student: ZEARN_FULL_HISTORY.student,

      // Full history from comprehensive scrape
      zearnHistory: {
        missions: ZEARN_FULL_HISTORY.missions.map(m => ({
          grade: m.grade,
          mission: m.missionNumber,
          name: m.missionName,
          badges: { earned: m.earnedBadges, total: m.totalSlots },
          percentComplete: Math.round((m.earnedBadges / m.totalSlots) * 100),
          status: m.status,
        })),
        totalBadges: ZEARN_FULL_HISTORY.totalBadges,
        lastScraped: ZEARN_FULL_HISTORY.scrapedAt,
      },

      // Progress summary
      progressSummary: progress.summary,

      // Current assignment details
      currentAssignment: progress.currentAssignment,

      // Pace analysis
      paceAnalysis: progress.pace,

      // Per-mission breakdown
      missionBreakdown: progress.missionProgress,

      // Calendar events
      calendarEvents,

      // Stats from local store
      localStats: stats,
      zepMemoriesFound: zepMemories.length,
      lastSync: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Progress] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate progress report', details: String(error) },
      { status: 500 }
    );
  }
}
