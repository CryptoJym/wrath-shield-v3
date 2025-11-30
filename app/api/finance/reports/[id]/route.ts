import { NextRequest, NextResponse } from 'next/server';
import {
  getReport,
  updateReport,
  getReportTransactions,
  formatCycleLabel,
} from '@/lib/finance/store';
import { currentUserOrThrow } from '@/lib/auth/user';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = currentUserOrThrow();
    const { id } = await params;
    const report = getReport(id, userId);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Get the transactions for this report
    const transactions = getReportTransactions(report.cycle_start, report.cycle_end, userId);

    return NextResponse.json({
      report: {
        ...report,
        label: formatCycleLabel(report.cycle_start, report.cycle_end),
      },
      transactions,
    });
  } catch (error: any) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = currentUserOrThrow();
    const { id } = await params;
    const body = await req.json();

    const updated = updateReport(id, body, userId);
    if (!updated) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      report: {
        ...updated,
        label: formatCycleLabel(updated.cycle_start, updated.cycle_end),
      },
    });
  } catch (error: any) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update report' },
      { status: 500 }
    );
  }
}
