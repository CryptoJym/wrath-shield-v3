import { NextRequest, NextResponse } from 'next/server';
import {
  listReports,
  createReport,
  getReportByCycle,
  formatCycleLabel,
} from '@/lib/finance/store';
import { currentUserOrThrow } from '@/lib/auth/user';

export async function GET() {
  try {
    const { userId } = currentUserOrThrow();
    const reports = listReports(userId);

    // Add formatted labels for UI
    const reportsWithLabels = reports.map(report => ({
      ...report,
      label: formatCycleLabel(report.cycle_start, report.cycle_end),
    }));

    return NextResponse.json({ reports: reportsWithLabels });
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json();
    const { cycle_start, cycle_end, employee, purpose } = body;

    if (!cycle_start || !cycle_end) {
      return NextResponse.json(
        { error: 'cycle_start and cycle_end are required' },
        { status: 400 }
      );
    }

    // Check if report already exists for this cycle
    const existing = getReportByCycle(cycle_start, cycle_end, userId);
    if (existing) {
      return NextResponse.json({
        report: {
          ...existing,
          label: formatCycleLabel(existing.cycle_start, existing.cycle_end),
        },
        existed: true,
      });
    }

    const report = createReport({
      cycle_start,
      cycle_end,
      employee,
      purpose,
      user_id: userId,
    });

    return NextResponse.json({
      report: {
        ...report,
        label: formatCycleLabel(report.cycle_start, report.cycle_end),
      },
      created: true,
    });
  } catch (error: any) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create report' },
      { status: 500 }
    );
  }
}
