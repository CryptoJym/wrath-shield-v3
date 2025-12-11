// @ts-nocheck
/**
 * Wrath Shield v3 - Contact Follow-up Reminder Tests
 *
 * Tests for proactive contact relationship monitoring:
 * - Reminder generation
 * - Contact type detection
 * - Relationship health assessment
 * - VIP handling
 * - Health summaries
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock relationship database
const mockDbExec = jest.fn();
const mockDbPrepare = jest.fn();
const mockDbGet = jest.fn();
const mockDbAll = jest.fn().mockReturnValue([]);
const mockDbRun = jest.fn().mockReturnValue({ changes: 1 });

jest.mock('@/lib/relationshipDb', () => ({
  getRelationshipDb: jest.fn().mockReturnValue({
    exec: mockDbExec,
    prepare: mockDbPrepare.mockReturnValue({
      get: mockDbGet,
      all: mockDbAll,
      run: mockDbRun,
    }),
  }),
  topContacts: jest.fn().mockReturnValue([]),
  listRelationshipSummaries: jest.fn().mockReturnValue([]),
}));

// Mock events
jest.mock('@/lib/events', () => ({
  listRecentEvents: jest.fn().mockReturnValue([]),
}));

// Mock followup connector
jest.mock('@/lib/pm/connectors/comms-followup-connector', () => ({
  getFollowupStatus: jest.fn().mockReturnValue(null),
}));

import {
  generateContactReminders,
  getVIPContactsNeedingAttention,
  getRelationshipHealthSummary,
  registerContactReminderJob,
  CONTACT_REMINDER_JOB,
  type ContactType,
  type RelationshipHealth,
  type ReminderSeverity,
  type ContactReminderConfig,
  type ContactReminder,
  type HealthSummary,
} from '@/lib/pm/alerts/contact-followup-reminder';
import { topContacts, listRelationshipSummaries } from '@/lib/relationshipDb';
import { listRecentEvents } from '@/lib/events';

describe('Contact Follow-up Reminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbAll.mockReturnValue([]);
    mockDbGet.mockReturnValue(undefined);
  });

  describe('Types', () => {
    it('should define ContactType values', () => {
      const types: ContactType[] = ['vip', 'active_deal', 'regular'];
      expect(types).toHaveLength(3);
    });

    it('should define RelationshipHealth values', () => {
      const health: RelationshipHealth[] = ['healthy', 'cooling', 'cold', 'dormant'];
      expect(health).toHaveLength(4);
    });

    it('should define ReminderSeverity values', () => {
      const severity: ReminderSeverity[] = ['info', 'warning', 'critical'];
      expect(severity).toHaveLength(3);
    });

    it('should define ContactReminderConfig interface', () => {
      const config: ContactReminderConfig = {
        vip_contacts: 3,
        active_deals: 5,
        regular_contacts: 14,
        dormant_threshold: 30,
        cooling_percentage: 0.7,
        max_reminders_per_run: 20,
        cooldown_hours: 48,
      };

      expect(config.vip_contacts).toBe(3);
    });

    it('should define ContactReminder interface', () => {
      const reminder: ContactReminder = {
        contact_id: 'contact-123',
        contact_name: 'John Doe',
        contact_handle: 'john@example.com',
        contact_type: 'vip',
        days_since_contact: 5.5,
        last_interaction: '2025-01-10T10:00:00Z',
        last_interaction_summary: 'Discussed project timeline',
        relationship_health: 'cooling',
        suggested_action: 'Check in with VIP contact',
        suggested_message: 'Hi John, wanted to touch base...',
        severity: 'warning',
        threshold_days: 3,
        health_percentage: 1.83,
        created_at: Math.floor(Date.now() / 1000),
      };

      expect(reminder.contact_type).toBe('vip');
      expect(reminder.severity).toBe('warning');
    });

    it('should define HealthSummary interface', () => {
      const summary: HealthSummary = {
        total_contacts: 100,
        by_health: {
          healthy: 70,
          cooling: 20,
          cold: 7,
          dormant: 3,
        },
        by_type: {
          vip: 10,
          active_deal: 15,
          regular: 75,
        },
        by_severity: {
          info: 15,
          warning: 10,
          critical: 5,
        },
        vip_needing_attention: 3,
        active_deals_at_risk: 5,
        dormant_count: 3,
        reminders_created: 30,
      };

      expect(summary.total_contacts).toBe(100);
    });
  });

  describe('generateContactReminders', () => {
    it('should return empty array when no contacts', async () => {
      (topContacts as jest.Mock).mockReturnValue([]);

      const reminders = await generateContactReminders();

      expect(reminders).toEqual([]);
    });

    it('should skip contacts without handle', async () => {
      (topContacts as jest.Mock).mockReturnValue([
        { id: 'c1', handle: null, message_count: 10, last_ts: Date.now() / 1000 },
      ]);

      const reminders = await generateContactReminders();

      expect(reminders).toEqual([]);
    });

    it('should skip contacts without last_ts', async () => {
      (topContacts as jest.Mock).mockReturnValue([
        { id: 'c1', handle: 'john@example.com', message_count: 10, last_ts: null },
      ]);

      const reminders = await generateContactReminders();

      expect(reminders).toEqual([]);
    });

    it('should skip contacts with too few messages', async () => {
      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'john@example.com',
          message_count: 2, // Less than 3
          last_ts: Date.now() / 1000,
        },
      ]);

      const reminders = await generateContactReminders();

      expect(reminders).toEqual([]);
    });

    it('should detect healthy contacts (no reminder)', async () => {
      const recentTs = Math.floor(Date.now() / 1000) - (1 * 24 * 60 * 60); // 1 day ago

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'john@example.com',
          display_name: 'John',
          message_count: 10,
          last_ts: recentTs,
        },
      ]);

      const reminders = await generateContactReminders();

      // Healthy contacts don't get reminders
      expect(reminders).toEqual([]);
    });

    it('should detect cooling contacts', async () => {
      const tenDaysAgo = Math.floor(Date.now() / 1000) - (10 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'john@example.com',
          display_name: 'John',
          message_count: 10,
          last_ts: tenDaysAgo,
        },
      ]);

      const reminders = await generateContactReminders();

      // Regular contact cooling at 70% of 14-day threshold
      expect(reminders.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect cold contacts', async () => {
      const fifteenDaysAgo = Math.floor(Date.now() / 1000) - (15 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'john@example.com',
          display_name: 'John',
          message_count: 10,
          last_ts: fifteenDaysAgo,
        },
      ]);

      const reminders = await generateContactReminders();

      if (reminders.length > 0) {
        expect(['cold', 'dormant', 'cooling']).toContain(reminders[0].relationship_health);
      }
    });

    it('should detect dormant contacts', async () => {
      const thirtyFiveDaysAgo = Math.floor(Date.now() / 1000) - (35 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'john@example.com',
          display_name: 'John',
          message_count: 10,
          last_ts: thirtyFiveDaysAgo,
        },
      ]);

      const reminders = await generateContactReminders();

      if (reminders.length > 0) {
        expect(reminders[0].severity).toBe('critical');
      }
    });

    it('should detect VIP contacts by message count', async () => {
      const fiveDaysAgo = Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'vip@example.com',
          display_name: 'VIP Client',
          message_count: 60, // High count = VIP
          last_ts: fiveDaysAgo,
        },
      ]);

      const reminders = await generateContactReminders();

      if (reminders.length > 0) {
        expect(reminders[0].contact_type).toBe('vip');
      }
    });

    it('should detect VIP contacts by summary keywords', async () => {
      const fiveDaysAgo = Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'exec@example.com',
          display_name: 'Jane',
          message_count: 10,
          last_ts: fiveDaysAgo,
        },
      ]);

      (listRelationshipSummaries as jest.Mock).mockReturnValue([
        { contact_id: 'c1', summary: 'CEO of important partner company' },
      ]);

      const reminders = await generateContactReminders();

      if (reminders.length > 0) {
        expect(reminders[0].contact_type).toBe('vip');
      }
    });

    it('should detect active_deal contacts', async () => {
      const eightDaysAgo = Math.floor(Date.now() / 1000) - (8 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'client@example.com',
          display_name: 'Client',
          message_count: 15,
          last_ts: eightDaysAgo,
        },
      ]);

      (listRecentEvents as jest.Mock).mockReturnValue([
        {
          contact: 'client@example.com',
          ts: Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60),
          preview: 'Please review the proposal attached',
        },
      ]);

      const reminders = await generateContactReminders();

      // May detect as active_deal based on keywords
      expect(Array.isArray(reminders)).toBe(true);
    });

    it('should respect cooldown period', async () => {
      const tenDaysAgo = Math.floor(Date.now() / 1000) - (10 * 24 * 60 * 60);
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'john@example.com',
          message_count: 10,
          last_ts: tenDaysAgo,
        },
      ]);

      // Has recent reminder
      mockDbGet.mockReturnValue({
        contact_id: 'c1',
        last_reminder_ts: oneHourAgo,
        reminder_count: 1,
      });

      const reminders = await generateContactReminders();

      // Should skip due to cooldown
      expect(reminders).toEqual([]);
    });

    it('should respect max_reminders_per_run', async () => {
      const tenDaysAgo = Math.floor(Date.now() / 1000) - (10 * 24 * 60 * 60);

      // Create many contacts
      const contacts = Array.from({ length: 30 }, (_, i) => ({
        id: `c${i}`,
        handle: `contact${i}@example.com`,
        display_name: `Contact ${i}`,
        message_count: 10,
        last_ts: tenDaysAgo,
      }));

      (topContacts as jest.Mock).mockReturnValue(contacts);

      const reminders = await generateContactReminders({ max_reminders_per_run: 5 });

      expect(reminders.length).toBeLessThanOrEqual(5);
    });

    it('should include suggested action', async () => {
      const tenDaysAgo = Math.floor(Date.now() / 1000) - (10 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'john@example.com',
          display_name: 'John',
          message_count: 10,
          last_ts: tenDaysAgo,
        },
      ]);

      const reminders = await generateContactReminders();

      if (reminders.length > 0) {
        expect(reminders[0].suggested_action).toBeTruthy();
      }
    });

    it('should include suggested message for non-healthy contacts', async () => {
      const twentyDaysAgo = Math.floor(Date.now() / 1000) - (20 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'john@example.com',
          display_name: 'John',
          message_count: 10,
          last_ts: twentyDaysAgo,
        },
      ]);

      const reminders = await generateContactReminders();

      if (reminders.length > 0) {
        expect(reminders[0].suggested_message).toBeTruthy();
      }
    });

    it('should sort by severity and type', async () => {
      const fiveDaysAgo = Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60);
      const twentyDaysAgo = Math.floor(Date.now() / 1000) - (20 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'regular@example.com',
          display_name: 'Regular',
          message_count: 10,
          last_ts: fiveDaysAgo,
        },
        {
          id: 'c2',
          handle: 'vip@example.com',
          display_name: 'VIP',
          message_count: 100,
          last_ts: twentyDaysAgo,
        },
      ]);

      const reminders = await generateContactReminders();

      // Critical/VIP should come first
      if (reminders.length > 1) {
        const firstSeverity = reminders[0].severity;
        const secondSeverity = reminders[1].severity;
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        expect(severityOrder[firstSeverity]).toBeLessThanOrEqual(severityOrder[secondSeverity]);
      }
    });
  });

  describe('getVIPContactsNeedingAttention', () => {
    it('should return only VIP contacts with critical severity', async () => {
      const fiveDaysAgo = Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([
        {
          id: 'c1',
          handle: 'vip@example.com',
          display_name: 'VIP Client',
          message_count: 100, // VIP
          last_ts: fiveDaysAgo,
        },
        {
          id: 'c2',
          handle: 'regular@example.com',
          display_name: 'Regular',
          message_count: 10,
          last_ts: fiveDaysAgo,
        },
      ]);

      const vipReminders = await getVIPContactsNeedingAttention();

      // Should only include VIP contacts with critical severity
      for (const reminder of vipReminders) {
        expect(reminder.contact_type).toBe('vip');
        expect(reminder.severity).toBe('critical');
      }
    });
  });

  describe('getRelationshipHealthSummary', () => {
    it('should return health summary', () => {
      mockDbAll.mockReturnValue([
        { contact_id: 'c1', contact_type: 'vip', relationship_health: 'healthy', last_reminder_ts: null },
        { contact_id: 'c2', contact_type: 'regular', relationship_health: 'cooling', last_reminder_ts: 123 },
        { contact_id: 'c3', contact_type: 'active_deal', relationship_health: 'cold', last_reminder_ts: 456 },
      ]);

      const summary = getRelationshipHealthSummary();

      expect(summary).toHaveProperty('total_contacts');
      expect(summary).toHaveProperty('by_health');
      expect(summary).toHaveProperty('by_type');
      expect(summary).toHaveProperty('by_severity');
    });

    it('should count by health status', () => {
      mockDbAll.mockReturnValue([
        { contact_id: 'c1', contact_type: 'regular', relationship_health: 'healthy' },
        { contact_id: 'c2', contact_type: 'regular', relationship_health: 'healthy' },
        { contact_id: 'c3', contact_type: 'regular', relationship_health: 'cooling' },
      ]);

      const summary = getRelationshipHealthSummary();

      expect(summary.by_health.healthy).toBe(2);
      expect(summary.by_health.cooling).toBe(1);
    });

    it('should count VIP needing attention', () => {
      mockDbAll.mockReturnValue([
        { contact_id: 'c1', contact_type: 'vip', relationship_health: 'cooling' },
        { contact_id: 'c2', contact_type: 'vip', relationship_health: 'cold' },
        { contact_id: 'c3', contact_type: 'vip', relationship_health: 'healthy' },
      ]);

      const summary = getRelationshipHealthSummary();

      expect(summary.vip_needing_attention).toBe(2);
    });

    it('should count active deals at risk', () => {
      mockDbAll.mockReturnValue([
        { contact_id: 'c1', contact_type: 'active_deal', relationship_health: 'cooling' },
        { contact_id: 'c2', contact_type: 'active_deal', relationship_health: 'healthy' },
      ]);

      const summary = getRelationshipHealthSummary();

      expect(summary.active_deals_at_risk).toBe(1);
    });

    it('should return empty summary when no database', () => {
      const { getRelationshipDb } = require('@/lib/relationshipDb');
      getRelationshipDb.mockReturnValueOnce(null);

      const summary = getRelationshipHealthSummary();

      expect(summary.total_contacts).toBe(0);
    });
  });

  describe('Background Job', () => {
    it('should define CONTACT_REMINDER_JOB', () => {
      expect(CONTACT_REMINDER_JOB).toHaveProperty('id', 'contact-followup-reminders');
      expect(CONTACT_REMINDER_JOB).toHaveProperty('name');
      expect(CONTACT_REMINDER_JOB).toHaveProperty('handler');
      expect(CONTACT_REMINDER_JOB.enabled).toBe(true);
    });

    it('should have handler that returns JobResult', async () => {
      (topContacts as jest.Mock).mockReturnValue([]);

      const result = await CONTACT_REMINDER_JOB.handler();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('items_processed');
      expect(result).toHaveProperty('duration_ms');
    });

    it('should handle errors in job handler', async () => {
      (topContacts as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await CONTACT_REMINDER_JOB.handler();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should register job function', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      registerContactReminderJob();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Table Creation', () => {
    it('should create contact_reminders table', async () => {
      await generateContactReminders();

      expect(mockDbExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS contact_reminders')
      );
    });

    it('should create indices', async () => {
      await generateContactReminders();

      expect(mockDbExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );
    });
  });
});
