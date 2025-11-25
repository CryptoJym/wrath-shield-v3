import { NextRequest, NextResponse } from 'next/server';
import {
  updatePendingAction,
  createNotification,
  listPendingActions,
} from '@/lib/legal/store';

// POST - Execute an approved action
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Action ID required' }, { status: 400 });
    }

    // Get the action
    const actions = listPendingActions('all');
    const action = actions.find(a => a.id === id);

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    if (action.status !== 'approved') {
      return NextResponse.json({ error: 'Action must be approved before execution' }, { status: 400 });
    }

    // Execute based on action type
    let result: { success: boolean; message: string; error?: string } = { success: false, message: '' };

    switch (action.action_type) {
      case 'email_draft':
        // For now, just mark as executed - in future, could integrate with email system
        result = {
          success: true,
          message: `Email draft "${action.title}" has been prepared. You can copy the content and send manually.`,
        };
        break;

      case 'file_motion':
        result = {
          success: true,
          message: `Motion "${action.title}" has been prepared for filing. Review and submit through the court system.`,
        };
        break;

      case 'schedule_hearing':
        result = {
          success: true,
          message: `Hearing request "${action.title}" has been logged. Contact the court clerk to finalize scheduling.`,
        };
        break;

      case 'send_document':
        result = {
          success: true,
          message: `Document "${action.title}" has been prepared for sending. Review attachments and recipient list.`,
        };
        break;

      default:
        result = {
          success: true,
          message: `Action "${action.title}" has been marked as executed.`,
        };
    }

    if (result.success) {
      // Update action status to executed
      updatePendingAction(id, { status: 'executed' });

      // Create success notification
      createNotification({
        notification_type: 'info',
        title: 'Action Executed',
        message: result.message,
        severity: 'info',
        related_id: id,
      });
    } else {
      // Update action with error
      updatePendingAction(id, { error_message: result.error });

      // Create error notification
      createNotification({
        notification_type: 'action_required',
        title: 'Action Failed',
        message: result.error || 'Unknown error during execution',
        severity: 'urgent',
        related_id: id,
      });
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      error: result.error,
    });
  } catch (error) {
    console.error('Failed to execute action:', error);
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}
