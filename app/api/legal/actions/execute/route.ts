import { NextRequest, NextResponse } from 'next/server';
import {
  updatePendingAction,
  createNotification,
  listPendingActions,
} from '@/lib/legal/store';
import { sendEmail } from '@/lib/emailSender';

// POST - Execute an approved action
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, dryRun = false } = body;

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
    let result: { success: boolean; message: string; error?: string; emailId?: string } = { success: false, message: '' };

    switch (action.action_type) {
      case 'email_draft':
        // Actually send the email
        const payload = action.payload || {};
        const to = payload.to || payload.recipient;
        const subject = payload.subject || action.title;
        const text = payload.body || payload.content || action.description || '';

        if (!to) {
          result = {
            success: false,
            message: 'Email execution failed',
            error: 'No recipient specified in email draft payload',
          };
          break;
        }

        if (dryRun) {
          result = {
            success: true,
            message: `[DRY RUN] Would send email to ${to}: "${subject}"`,
          };
          break;
        }

        try {
          const emailResult = await sendEmail({
            to,
            subject,
            text,
            preferredProfile: payload.profile || 'universal',
          });

          if (emailResult.ok) {
            result = {
              success: true,
              message: `Email sent successfully to ${to} via ${emailResult.profile}`,
              emailId: emailResult.id,
            };
          } else {
            result = {
              success: false,
              message: 'Email send failed',
              error: 'Email transport returned failure',
            };
          }
        } catch (emailError: any) {
          result = {
            success: false,
            message: 'Email execution failed',
            error: emailError.message || 'Unknown email error',
          };
        }
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

    if (result.success && !dryRun) {
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
    } else if (!result.success) {
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
      emailId: result.emailId,
      dryRun,
    });
  } catch (error) {
    console.error('Failed to execute action:', error);
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}
