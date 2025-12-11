// @ts-nocheck
/**
 * Tests for forge-email-templates.ts
 * Email notification templates for parent notifications
 */

import {
  generateAlertEmail,
  generateDigestEmail,
  EmailTemplate,
} from '@/lib/hyro/forge-email-templates';
import type { Alert, AlertType } from '@/lib/hyro/forge-alerts';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockAlert(type: AlertType, overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-123',
    type,
    title: `Test ${type} Alert`,
    message: 'This is a test alert message',
    priority: 'medium',
    created_at: Date.now(),
    read: false,
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-email-templates types', () => {
  describe('EmailTemplate interface', () => {
    it('should have required properties', () => {
      const template: EmailTemplate = {
        subject: 'Test Subject',
        htmlBody: '<div>Test HTML</div>',
        textBody: 'Test text',
      };

      expect(template.subject).toBeDefined();
      expect(template.htmlBody).toBeDefined();
      expect(template.textBody).toBeDefined();
    });
  });
});

// ============================================================================
// generateAlertEmail Tests
// ============================================================================

describe('generateAlertEmail', () => {
  describe('streak_at_risk alerts', () => {
    it('should generate streak at risk email with default hours', () => {
      const alert = createMockAlert('streak_at_risk');
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('Keep the Streak Alive');
      expect(email.subject).toContain('24h');
      expect(email.htmlBody).toContain('Streak at Risk');
      expect(email.textBody).toContain('Streak at Risk');
    });

    it('should generate streak at risk email with custom hours', () => {
      const alert = createMockAlert('streak_at_risk', {
        metadata: { hoursAgo: 48 },
      });
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('48h');
      expect(email.htmlBody).toContain('48 hours');
      expect(email.textBody).toContain('48 hours');
    });

    it('should include call to action link', () => {
      const alert = createMockAlert('streak_at_risk');
      const email = generateAlertEmail(alert);

      expect(email.htmlBody).toContain('/hyro/forge');
      expect(email.textBody).toContain('/hyro/forge');
    });
  });

  describe('streak_milestone alerts', () => {
    it('should generate milestone email with default days', () => {
      const alert = createMockAlert('streak_milestone');
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('7-Day Streak');
      expect(email.htmlBody).toContain('7-day learning streak');
    });

    it('should generate milestone email with custom milestone', () => {
      const alert = createMockAlert('streak_milestone', {
        metadata: { milestone: 30 },
      });
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('30-Day Streak');
      expect(email.htmlBody).toContain('30-day learning streak');
    });

    it('should include analytics link', () => {
      const alert = createMockAlert('streak_milestone');
      const email = generateAlertEmail(alert);

      expect(email.htmlBody).toContain('/hyro/forge/analytics');
    });
  });

  describe('weekly_report alerts', () => {
    it('should generate weekly report email with stats', () => {
      const alert = createMockAlert('weekly_report', {
        metadata: { sessionCount: 5, totalXp: 250 },
      });
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('Weekly Progress Report');
      expect(email.htmlBody).toContain('5');
      expect(email.htmlBody).toContain('250');
      expect(email.textBody).toContain('Sessions Completed: 5');
      expect(email.textBody).toContain('Total XP Earned: 250');
    });

    it('should handle missing stats gracefully', () => {
      const alert = createMockAlert('weekly_report');
      const email = generateAlertEmail(alert);

      expect(email.htmlBody).toContain('0');
      expect(email.textBody).toContain('Sessions Completed: 0');
    });
  });

  describe('level_up alerts', () => {
    it('should generate level up email', () => {
      const alert = createMockAlert('level_up', {
        metadata: { newLevel: 5, totalXp: 500 },
      });
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('Level 5');
      expect(email.htmlBody).toContain('Level 5');
      expect(email.htmlBody).toContain('500 total XP');
    });

    it('should use default level when not specified', () => {
      const alert = createMockAlert('level_up');
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('Level 2');
    });
  });

  describe('achievement_earned alerts', () => {
    it('should generate achievement email', () => {
      const alert = createMockAlert('achievement_earned', {
        message: 'Completed first quest!',
        metadata: { achievementName: 'First Steps' },
      });
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('Achievement Unlocked: First Steps');
      expect(email.htmlBody).toContain('First Steps');
      expect(email.htmlBody).toContain('Completed first quest!');
    });

    it('should use default achievement name when not specified', () => {
      const alert = createMockAlert('achievement_earned');
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('Achievement');
    });
  });

  describe('growth_opportunity alerts', () => {
    it('should generate growth opportunity email', () => {
      const alert = createMockAlert('growth_opportunity', {
        message: 'Math skills could use some practice',
        metadata: { statName: 'Math', decline: 10 },
      });
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('Growth Opportunity: Math');
      expect(email.htmlBody).toContain('Math skills could use some practice');
    });
  });

  describe('quest_reminder alerts', () => {
    it('should generate quest reminder email', () => {
      const alert = createMockAlert('quest_reminder', {
        metadata: { questTitle: 'Algebra Adventure', hoursUntilDue: 12 },
      });
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('Quest Due Soon: Algebra Adventure');
      expect(email.htmlBody).toContain('Algebra Adventure');
      expect(email.htmlBody).toContain('12 hours');
    });
  });

  describe('session_complete alerts', () => {
    it('should generate session complete email', () => {
      const alert = createMockAlert('session_complete', {
        metadata: { xpEarned: 100, duration: 30 },
      });
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('Learning Session Complete');
      expect(email.htmlBody).toContain('30 minutes');
      expect(email.htmlBody).toContain('100 XP');
    });

    it('should round duration', () => {
      const alert = createMockAlert('session_complete', {
        metadata: { xpEarned: 50, duration: 25.7 },
      });
      const email = generateAlertEmail(alert);

      expect(email.htmlBody).toContain('26 minutes');
    });
  });

  describe('generic/fallback emails', () => {
    it('should generate generic email for unknown types', () => {
      const alert = createMockAlert('unknown_type' as AlertType, {
        title: 'Custom Alert',
        message: 'Custom message',
      });
      const email = generateAlertEmail(alert);

      expect(email.subject).toContain('Custom Alert');
      expect(email.htmlBody).toContain('Custom message');
      expect(email.textBody).toContain('Custom message');
    });
  });
});

// ============================================================================
// generateDigestEmail Tests
// ============================================================================

describe('generateDigestEmail', () => {
  it('should generate digest email for multiple alerts', () => {
    const alerts: Alert[] = [
      createMockAlert('streak_milestone', { priority: 'high' }),
      createMockAlert('level_up', { priority: 'medium' }),
      createMockAlert('session_complete', { priority: 'low' }),
    ];

    const email = generateDigestEmail(alerts);

    expect(email.subject).toContain('3 Updates');
    expect(email.htmlBody).toContain('HYRO Forge Updates');
  });

  it('should handle single alert without pluralization', () => {
    const alerts: Alert[] = [createMockAlert('level_up')];

    const email = generateDigestEmail(alerts);

    expect(email.subject).toContain('1 Update');
    expect(email.subject).not.toContain('Updates');
  });

  it('should include priority indicators in text body', () => {
    const alerts: Alert[] = [
      createMockAlert('streak_at_risk', { priority: 'high', title: 'High Priority' }),
      createMockAlert('level_up', { priority: 'medium', title: 'Medium Priority' }),
      createMockAlert('session_complete', { priority: 'low', title: 'Low Priority' }),
    ];

    const email = generateDigestEmail(alerts);

    expect(email.textBody).toContain('🔴');
    expect(email.textBody).toContain('🟡');
    expect(email.textBody).toContain('🟢');
  });

  it('should color-code alerts by priority in HTML', () => {
    const alerts: Alert[] = [
      createMockAlert('streak_at_risk', { priority: 'high' }),
      createMockAlert('level_up', { priority: 'medium' }),
      createMockAlert('session_complete', { priority: 'low' }),
    ];

    const email = generateDigestEmail(alerts);

    // High priority = red (#ef4444)
    expect(email.htmlBody).toContain('#ef4444');
    // Medium priority = orange (#f59e0b)
    expect(email.htmlBody).toContain('#f59e0b');
    // Low priority = green (#10b981)
    expect(email.htmlBody).toContain('#10b981');
  });

  it('should include dashboard link', () => {
    const alerts: Alert[] = [createMockAlert('level_up')];

    const email = generateDigestEmail(alerts);

    expect(email.htmlBody).toContain('/hyro/forge');
    expect(email.textBody).toContain('/hyro/forge');
  });

  it('should handle empty alerts array', () => {
    const alerts: Alert[] = [];

    const email = generateDigestEmail(alerts);

    expect(email.subject).toContain('0 Updates');
  });
});

// ============================================================================
// Email Content Quality Tests
// ============================================================================

describe('email content quality', () => {
  it('should have both HTML and text versions', () => {
    const alert = createMockAlert('level_up');
    const email = generateAlertEmail(alert);

    expect(email.htmlBody.length).toBeGreaterThan(0);
    expect(email.textBody.length).toBeGreaterThan(0);
    expect(email.htmlBody).not.toBe(email.textBody);
  });

  it('should include proper HTML structure', () => {
    const alert = createMockAlert('level_up');
    const email = generateAlertEmail(alert);

    expect(email.htmlBody).toContain('<div');
    expect(email.htmlBody).toContain('style=');
  });

  it('should have trimmed text body', () => {
    const alert = createMockAlert('level_up');
    const email = generateAlertEmail(alert);

    expect(email.textBody).toBe(email.textBody.trim());
  });

  it('should not have HTML tags in text body', () => {
    const alert = createMockAlert('level_up');
    const email = generateAlertEmail(alert);

    expect(email.textBody).not.toContain('<div');
    expect(email.textBody).not.toContain('<a');
    expect(email.textBody).not.toContain('<p');
  });
});
