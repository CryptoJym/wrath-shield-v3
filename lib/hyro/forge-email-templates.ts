/**
 * HYRO FORGE: EMAIL NOTIFICATION TEMPLATES
 *
 * Email templates for parent notifications (future use).
 * Currently provides template structure only.
 * Integrate with email sender when ready.
 */

import type { Alert, AlertType } from './forge-alerts';

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

/**
 * Generate email template for an alert
 */
export function generateAlertEmail(alert: Alert): EmailTemplate {
  switch (alert.type) {
    case 'streak_at_risk':
      return generateStreakRiskEmail(alert);
    case 'streak_milestone':
      return generateStreakMilestoneEmail(alert);
    case 'weekly_report':
      return generateWeeklyReportEmail(alert);
    case 'level_up':
      return generateLevelUpEmail(alert);
    case 'achievement_earned':
      return generateAchievementEmail(alert);
    case 'growth_opportunity':
      return generateGrowthOpportunityEmail(alert);
    case 'quest_reminder':
      return generateQuestReminderEmail(alert);
    case 'session_complete':
      return generateSessionCompleteEmail(alert);
    default:
      return generateGenericEmail(alert);
  }
}

/**
 * Streak at risk email
 */
function generateStreakRiskEmail(alert: Alert): EmailTemplate {
  const hoursAgo = alert.metadata?.hoursAgo || 24;

  return {
    subject: `🔥 Keep the Streak Alive! ${hoursAgo}h Since Last Session`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">🔥 Streak at Risk!</h2>
        <p>Hi there,</p>
        <p>It's been <strong>${hoursAgo} hours</strong> since the last learning session on HYRO Forge.</p>
        <p>Keep the momentum going! Just a quick 10-minute session will keep the streak alive.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge"
           style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Start a Session
        </a>
        <p style="color: #666; font-size: 14px;">
          Daily practice builds lasting skills. You've got this!
        </p>
      </div>
    `,
    textBody: `
🔥 Streak at Risk!

Hi there,

It's been ${hoursAgo} hours since the last learning session on HYRO Forge.

Keep the momentum going! Just a quick 10-minute session will keep the streak alive.

Start a session: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge

Daily practice builds lasting skills. You've got this!
    `.trim(),
  };
}

/**
 * Streak milestone email
 */
function generateStreakMilestoneEmail(alert: Alert): EmailTemplate {
  const milestone = alert.metadata?.milestone || 7;

  return {
    subject: `🎉 ${milestone}-Day Streak Achieved!`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">🎉 ${milestone}-Day Streak!</h2>
        <p>Incredible news!</p>
        <p>Your child has maintained a <strong>${milestone}-day learning streak</strong> on HYRO Forge!</p>
        <p>This kind of consistency is how real mastery is built. Keep celebrating their dedication!</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge/analytics"
           style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          View Progress
        </a>
      </div>
    `,
    textBody: `
🎉 ${milestone}-Day Streak!

Incredible news!

Your child has maintained a ${milestone}-day learning streak on HYRO Forge!

This kind of consistency is how real mastery is built. Keep celebrating their dedication!

View progress: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge/analytics
    `.trim(),
  };
}

/**
 * Weekly report email
 */
function generateWeeklyReportEmail(alert: Alert): EmailTemplate {
  const sessionCount = alert.metadata?.sessionCount || 0;
  const totalXp = alert.metadata?.totalXp || 0;

  return {
    subject: '📊 Weekly Progress Report: HYRO Forge',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">📊 Weekly Progress Report</h2>
        <p>Here's what happened this week on HYRO Forge:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 8px 0;"><strong>Sessions Completed:</strong> ${sessionCount}</p>
          <p style="margin: 8px 0;"><strong>Total XP Earned:</strong> ${totalXp}</p>
        </div>
        <p>Consistent practice is paying off. Keep up the great work!</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge/analytics"
           style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          View Full Analytics
        </a>
      </div>
    `,
    textBody: `
📊 Weekly Progress Report

Here's what happened this week on HYRO Forge:

Sessions Completed: ${sessionCount}
Total XP Earned: ${totalXp}

Consistent practice is paying off. Keep up the great work!

View full analytics: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge/analytics
    `.trim(),
  };
}

/**
 * Level up email
 */
function generateLevelUpEmail(alert: Alert): EmailTemplate {
  const newLevel = alert.metadata?.newLevel || 2;
  const totalXp = alert.metadata?.totalXp || 0;

  return {
    subject: `⬆️ Level Up! Now Level ${newLevel}`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8b5cf6;">⬆️ Level Up!</h2>
        <p>Amazing progress!</p>
        <p>Your child just reached <strong>Level ${newLevel}</strong> with ${totalXp} total XP!</p>
        <p>Each level represents real growth in knowledge and skills. This is something to celebrate!</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge"
           style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          View Character Sheet
        </a>
      </div>
    `,
    textBody: `
⬆️ Level Up!

Amazing progress!

Your child just reached Level ${newLevel} with ${totalXp} total XP!

Each level represents real growth in knowledge and skills. This is something to celebrate!

View character sheet: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge
    `.trim(),
  };
}

/**
 * Achievement earned email
 */
function generateAchievementEmail(alert: Alert): EmailTemplate {
  const achievementName = alert.metadata?.achievementName || 'Achievement';

  return {
    subject: `🏆 Achievement Unlocked: ${achievementName}`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">🏆 Achievement Unlocked!</h2>
        <p><strong>${achievementName}</strong></p>
        <p>${alert.message}</p>
        <p>Achievements represent significant milestones in the learning journey. Way to go!</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge"
           style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          View All Achievements
        </a>
      </div>
    `,
    textBody: `
🏆 Achievement Unlocked!

${achievementName}

${alert.message}

Achievements represent significant milestones in the learning journey. Way to go!

View all achievements: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge
    `.trim(),
  };
}

/**
 * Growth opportunity email
 */
function generateGrowthOpportunityEmail(alert: Alert): EmailTemplate {
  const statName = alert.metadata?.statName || 'a skill';
  const decline = Math.round(alert.metadata?.decline || 5);

  return {
    subject: `📈 Growth Opportunity: ${statName}`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">📈 Growth Opportunity</h2>
        <p>${alert.message}</p>
        <p>This is a great time to focus some extra practice in this area. Small, focused sessions can make a big difference!</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge/analytics"
           style="display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          View Analytics
        </a>
      </div>
    `,
    textBody: `
📈 Growth Opportunity

${alert.message}

This is a great time to focus some extra practice in this area. Small, focused sessions can make a big difference!

View analytics: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge/analytics
    `.trim(),
  };
}

/**
 * Quest reminder email
 */
function generateQuestReminderEmail(alert: Alert): EmailTemplate {
  const questTitle = alert.metadata?.questTitle || 'Quest';
  const hoursUntilDue = alert.metadata?.hoursUntilDue || 24;

  return {
    subject: `⏰ Quest Due Soon: ${questTitle}`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #06b6d4;">⏰ Quest Reminder</h2>
        <p>The quest "<strong>${questTitle}</strong>" is due in ${hoursUntilDue} hours!</p>
        <p>Completing quests on time builds time management skills and earns bonus XP.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge"
           style="display: inline-block; background: #06b6d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          View Quest
        </a>
      </div>
    `,
    textBody: `
⏰ Quest Reminder

The quest "${questTitle}" is due in ${hoursUntilDue} hours!

Completing quests on time builds time management skills and earns bonus XP.

View quest: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge
    `.trim(),
  };
}

/**
 * Session complete email
 */
function generateSessionCompleteEmail(alert: Alert): EmailTemplate {
  const xpEarned = alert.metadata?.xpEarned || 0;
  const duration = Math.round(alert.metadata?.duration || 0);

  return {
    subject: '✅ Learning Session Complete',
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">✅ Session Complete!</h2>
        <p>Great work today!</p>
        <p>Session completed: <strong>${duration} minutes</strong>, earned <strong>${xpEarned} XP</strong>.</p>
        <p>Every session builds towards mastery. Keep it up!</p>
      </div>
    `,
    textBody: `
✅ Session Complete!

Great work today!

Session completed: ${duration} minutes, earned ${xpEarned} XP.

Every session builds towards mastery. Keep it up!
    `.trim(),
  };
}

/**
 * Generic fallback email
 */
function generateGenericEmail(alert: Alert): EmailTemplate {
  return {
    subject: `HYRO Forge: ${alert.title}`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${alert.title}</h2>
        <p>${alert.message}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge"
           style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          View HYRO Forge
        </a>
      </div>
    `,
    textBody: `
${alert.title}

${alert.message}

View HYRO Forge: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge
    `.trim(),
  };
}

/**
 * Batch multiple alerts into a digest email
 */
export function generateDigestEmail(alerts: Alert[]): EmailTemplate {
  const alertsByPriority = {
    high: alerts.filter(a => a.priority === 'high'),
    medium: alerts.filter(a => a.priority === 'medium'),
    low: alerts.filter(a => a.priority === 'low'),
  };

  const htmlAlerts = alerts.map(alert => `
    <div style="border-left: 4px solid ${alert.priority === 'high' ? '#ef4444' : alert.priority === 'medium' ? '#f59e0b' : '#10b981'}; padding-left: 12px; margin: 12px 0;">
      <strong>${alert.title}</strong><br />
      ${alert.message}
    </div>
  `).join('');

  const textAlerts = alerts.map(alert => `
${alert.priority === 'high' ? '🔴' : alert.priority === 'medium' ? '🟡' : '🟢'} ${alert.title}
${alert.message}
  `).join('\n\n');

  return {
    subject: `📬 HYRO Forge Digest: ${alerts.length} Update${alerts.length === 1 ? '' : 's'}`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">📬 HYRO Forge Updates</h2>
        <p>Here's what's been happening:</p>
        ${htmlAlerts}
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge"
           style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          View Dashboard
        </a>
      </div>
    `,
    textBody: `
📬 HYRO Forge Updates

Here's what's been happening:

${textAlerts}

View dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4242'}/hyro/forge
    `.trim(),
  };
}
