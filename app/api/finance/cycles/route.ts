import { NextResponse } from 'next/server';
import { generateAllCycles, formatCycleLabel } from '@/lib/finance/store';
import { currentUserOrThrow } from '@/lib/auth/user';

export async function GET() {
  try {
    const { userId } = currentUserOrThrow();
    const cycles = generateAllCycles(userId);

    // Add formatted labels for UI
    const cyclesWithLabels = cycles.map(cycle => ({
      ...cycle,
      label: formatCycleLabel(cycle.start, cycle.end),
    }));

    return NextResponse.json({ cycles: cyclesWithLabels });
  } catch (error: any) {
    console.error('Error fetching cycles:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cycles' },
      { status: 500 }
    );
  }
}
