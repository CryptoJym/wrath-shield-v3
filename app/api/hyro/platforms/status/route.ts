/**
 * Hyro Forge: Platform Connectors Status API
 * Returns status of all configured platform connectors
 */

import { NextResponse } from 'next/server';
import { connectorManager } from '@/lib/hyro/connectors';
import { getStudentIdFromRequest } from '@/lib/hyro/student-auth';

export async function GET() {
  try {
    const studentId = await getStudentIdFromRequest();
    const statuses = connectorManager.getConnectorStatus();

    return NextResponse.json({
      success: true,
      data: {
        platforms: statuses,
        summary: {
          total: statuses.length,
          healthy: statuses.filter(s => s.isHealthy).length,
          enabled: statuses.filter(s => s.isEnabled).length,
        },
      },
    });
  } catch (error) {
    console.error('[API] Platform status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get platform status' },
      { status: 500 }
    );
  }
}
