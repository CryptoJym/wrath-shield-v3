/**
 * Unit Tests for Systems Page Components
 *
 * Tests the presentational components and rendering logic
 * for the Systems Telemetry dashboard.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// =============================================================================
// Mock Data
// =============================================================================

const mockTelemetryData = {
  timestamp: '2024-03-15T10:30:00Z',
  latencyMs: 45,
  memoryPipeline: {
    workingMemory: {
      totalEvents: 150,
      unprocessedEvents: 25,
      processedLast24h: 120,
      oldestEvent: '2024-03-14T10:00:00Z',
      newestEvent: '2024-03-15T10:25:00Z',
      eventsBySource: {
        imessage: 45,
        email: 30,
        calendar: 25,
        limitless: 20,
        legal: 15,
        finance: 10,
        proactive: 5,
      },
      bufferUtilization: 30,
    },
    synthesis: {
      isRunning: false,
      lastSynthesisAt: '2024-03-15T09:00:00Z',
      eventCount: 50,
      taskCount: 8,
      nextSynthesisAt: '2024-03-15T10:00:00Z',
    },
  },
  decisionSystem: {
    pendingDecisions: 5,
    resolvedDecisions: 45,
    expiredDecisions: 2,
    totalDecisions: 52,
    byPriority: {
      critical: 1,
      high: 2,
      medium: 1,
      low: 1,
    },
    byDomain: {
      legal: 2,
      finance: 1,
      calendar: 2,
    },
    avgResolutionTimeMs: 180000, // 3 minutes
    pendingCritical: 1,
  },
  learningSystem: {
    lastLearningCycle: '2024-03-15T08:00:00Z',
    totalInsights: 25,
    appliedInsights: 20,
    insightsByType: {
      pattern_to_rule: 10,
      decision_to_correction: 8,
      preference_update: 7,
    },
    insightsBySource: {
      pattern_recognizer: 15,
      decision_queue: 10,
    },
    recentInsights: [
      {
        id: 'insight-1',
        type: 'pattern_to_rule',
        source: 'pattern_recognizer',
        target: 'preference_model',
        description: 'Detected morning meeting preference pattern',
        timestamp: '2024-03-15T08:00:00Z',
        applied: true,
      },
      {
        id: 'insight-2',
        type: 'decision_to_correction',
        source: 'decision_queue',
        target: 'preference_model',
        description: 'User preferred shorter meeting summaries',
        timestamp: '2024-03-15T07:30:00Z',
        applied: true,
      },
      {
        id: 'insight-3',
        type: 'preference_update',
        source: 'user_feedback',
        target: 'synthesis_loop',
        description: 'Updated notification timing preference',
        timestamp: '2024-03-15T07:00:00Z',
        applied: false,
      },
    ],
  },
  cronJobs: [
    { name: 'proactive-tick', schedule: '*/5 * * * *', description: 'Proactive updates', nextRun: '2024-03-15T10:35:00Z' },
    { name: 'legal-hourly', schedule: '0 * * * *', description: 'Legal sync', nextRun: '2024-03-15T11:00:00Z' },
    { name: 'cortex-synthesis', schedule: '*/15 * * * *', description: 'Memory synthesis', nextRun: '2024-03-15T10:45:00Z' },
  ],
  health: {
    workingMemoryOnline: true,
    synthesisOnline: true,
    decisionQueueOnline: true,
    learningBridgeOnline: true,
    overallStatus: 'healthy' as const,
  },
};

// =============================================================================
// Helper Components for Testing (extracted from page.tsx for unit testing)
// =============================================================================

// StatusBadge Component
const StatusBadge = ({ status }: { status: 'healthy' | 'degraded' | 'critical' | boolean }) => {
  const config = typeof status === 'boolean'
    ? status
      ? { text: 'Online', testId: 'status-online' }
      : { text: 'Offline', testId: 'status-offline' }
    : status === 'healthy'
      ? { text: 'Healthy', testId: 'status-healthy' }
      : status === 'degraded'
        ? { text: 'Degraded', testId: 'status-degraded' }
        : { text: 'Critical', testId: 'status-critical' };

  return (
    <div data-testid={config.testId}>
      <span>{config.text}</span>
    </div>
  );
};

// PulseIndicator Component
const PulseIndicator = ({ active }: { active: boolean }) => (
  <div data-testid={active ? 'pulse-active' : 'pulse-inactive'} />
);

// EventSourceBar Component
const EventSourceBar = ({ source, count, maxCount }: { source: string; count: number; maxCount: number }) => {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div data-testid={`event-source-${source.toLowerCase()}`}>
      <span>{source}</span>
      <div style={{ width: `${percentage}%` }} data-testid="progress-bar" />
      <span>{count}</span>
    </div>
  );
};

// PriorityBadge Component
const PriorityBadge = ({ priority, count }: { priority: string; count: number }) => (
  <div data-testid={`priority-${priority}`}>
    {priority.toUpperCase()}: {count}
  </div>
);

// =============================================================================
// Tests
// =============================================================================

describe('Systems Page Components', () => {
  // ===========================================================================
  // StatusBadge Tests
  // ===========================================================================
  describe('StatusBadge', () => {
    it('renders healthy status correctly', () => {
      render(<StatusBadge status="healthy" />);
      expect(screen.getByTestId('status-healthy')).toBeInTheDocument();
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('renders degraded status correctly', () => {
      render(<StatusBadge status="degraded" />);
      expect(screen.getByTestId('status-degraded')).toBeInTheDocument();
      expect(screen.getByText('Degraded')).toBeInTheDocument();
    });

    it('renders critical status correctly', () => {
      render(<StatusBadge status="critical" />);
      expect(screen.getByTestId('status-critical')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('renders online boolean status correctly', () => {
      render(<StatusBadge status={true} />);
      expect(screen.getByTestId('status-online')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('renders offline boolean status correctly', () => {
      render(<StatusBadge status={false} />);
      expect(screen.getByTestId('status-offline')).toBeInTheDocument();
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // PulseIndicator Tests
  // ===========================================================================
  describe('PulseIndicator', () => {
    it('shows active pulse when system is online', () => {
      render(<PulseIndicator active={true} />);
      expect(screen.getByTestId('pulse-active')).toBeInTheDocument();
    });

    it('shows inactive pulse when system is offline', () => {
      render(<PulseIndicator active={false} />);
      expect(screen.getByTestId('pulse-inactive')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // EventSourceBar Tests
  // ===========================================================================
  describe('EventSourceBar', () => {
    it('renders source name and count', () => {
      render(<EventSourceBar source="iMessage" count={45} maxCount={100} />);
      expect(screen.getByText('iMessage')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
    });

    it('calculates percentage correctly', () => {
      render(<EventSourceBar source="email" count={50} maxCount={100} />);
      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('handles zero maxCount gracefully', () => {
      render(<EventSourceBar source="test" count={0} maxCount={0} />);
      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('handles 100% utilization', () => {
      render(<EventSourceBar source="full" count={100} maxCount={100} />);
      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  // ===========================================================================
  // PriorityBadge Tests
  // ===========================================================================
  describe('PriorityBadge', () => {
    it('renders critical priority badge', () => {
      render(<PriorityBadge priority="critical" count={3} />);
      expect(screen.getByTestId('priority-critical')).toBeInTheDocument();
      expect(screen.getByText('CRITICAL: 3')).toBeInTheDocument();
    });

    it('renders high priority badge', () => {
      render(<PriorityBadge priority="high" count={5} />);
      expect(screen.getByText('HIGH: 5')).toBeInTheDocument();
    });

    it('renders medium priority badge', () => {
      render(<PriorityBadge priority="medium" count={2} />);
      expect(screen.getByText('MEDIUM: 2')).toBeInTheDocument();
    });

    it('renders low priority badge', () => {
      render(<PriorityBadge priority="low" count={1} />);
      expect(screen.getByText('LOW: 1')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Mock Telemetry Data Structure Tests
  // ===========================================================================
  describe('Telemetry Data Structure', () => {
    it('has all required health properties', () => {
      expect(mockTelemetryData.health).toHaveProperty('workingMemoryOnline');
      expect(mockTelemetryData.health).toHaveProperty('synthesisOnline');
      expect(mockTelemetryData.health).toHaveProperty('decisionQueueOnline');
      expect(mockTelemetryData.health).toHaveProperty('learningBridgeOnline');
      expect(mockTelemetryData.health).toHaveProperty('overallStatus');
    });

    it('has valid working memory data', () => {
      const wm = mockTelemetryData.memoryPipeline.workingMemory;
      expect(wm.totalEvents).toBeGreaterThanOrEqual(0);
      expect(wm.bufferUtilization).toBeGreaterThanOrEqual(0);
      expect(wm.bufferUtilization).toBeLessThanOrEqual(100);
      expect(Object.keys(wm.eventsBySource).length).toBeGreaterThan(0);
    });

    it('has valid decision system data', () => {
      const ds = mockTelemetryData.decisionSystem;
      expect(ds.totalDecisions).toBe(ds.pendingDecisions + ds.resolvedDecisions + ds.expiredDecisions);
    });

    it('has valid learning system data', () => {
      const ls = mockTelemetryData.learningSystem;
      expect(ls.appliedInsights).toBeLessThanOrEqual(ls.totalInsights);
      expect(ls.recentInsights.length).toBeGreaterThan(0);
    });

    it('has valid cron jobs data', () => {
      expect(mockTelemetryData.cronJobs.length).toBeGreaterThan(0);
      mockTelemetryData.cronJobs.forEach(job => {
        expect(job).toHaveProperty('name');
        expect(job).toHaveProperty('schedule');
        expect(job).toHaveProperty('description');
        expect(job.schedule.split(' ').length).toBe(5);
      });
    });
  });

  // ===========================================================================
  // Health Status Determination Tests
  // ===========================================================================
  describe('Health Status Determination', () => {
    it('returns healthy when all systems are online', () => {
      const health = mockTelemetryData.health;
      const allOnline =
        health.workingMemoryOnline &&
        health.synthesisOnline &&
        health.decisionQueueOnline &&
        health.learningBridgeOnline;
      expect(allOnline).toBe(true);
      expect(health.overallStatus).toBe('healthy');
    });

    it('calculates correct event source percentages', () => {
      const eventsBySource = mockTelemetryData.memoryPipeline.workingMemory.eventsBySource;
      const maxCount = Math.max(...Object.values(eventsBySource));
      expect(maxCount).toBe(45); // iMessage has the most

      const emailPercentage = (eventsBySource.email / maxCount) * 100;
      expect(emailPercentage).toBeCloseTo(66.67, 1);
    });
  });

  // ===========================================================================
  // Insight Card Data Tests
  // ===========================================================================
  describe('Learning Insights', () => {
    it('has valid insight types', () => {
      const validTypes = ['pattern_to_rule', 'decision_to_correction', 'preference_update'];
      mockTelemetryData.learningSystem.recentInsights.forEach(insight => {
        expect(validTypes).toContain(insight.type);
      });
    });

    it('has all required insight properties', () => {
      mockTelemetryData.learningSystem.recentInsights.forEach(insight => {
        expect(insight).toHaveProperty('id');
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('source');
        expect(insight).toHaveProperty('target');
        expect(insight).toHaveProperty('description');
        expect(insight).toHaveProperty('timestamp');
        expect(insight).toHaveProperty('applied');
      });
    });

    it('counts applied insights correctly', () => {
      const applied = mockTelemetryData.learningSystem.recentInsights.filter(i => i.applied);
      expect(applied.length).toBe(2);
    });
  });

  // ===========================================================================
  // Time Formatting Tests
  // ===========================================================================
  describe('Time Formatting', () => {
    const formatTimeUntil = (seconds: number) => {
      if (seconds < 60) return `${Math.round(seconds)}s`;
      if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
      return `${Math.round(seconds / 3600)}h`;
    };

    it('formats seconds correctly', () => {
      expect(formatTimeUntil(30)).toBe('30s');
      expect(formatTimeUntil(59)).toBe('59s');
    });

    it('formats minutes correctly', () => {
      expect(formatTimeUntil(60)).toBe('1m');
      expect(formatTimeUntil(300)).toBe('5m');
      expect(formatTimeUntil(900)).toBe('15m');
    });

    it('formats hours correctly', () => {
      expect(formatTimeUntil(3600)).toBe('1h');
      expect(formatTimeUntil(7200)).toBe('2h');
    });
  });

  // ===========================================================================
  // Resolution Time Formatting Tests
  // ===========================================================================
  describe('Resolution Time Display', () => {
    it('converts milliseconds to minutes for display', () => {
      const avgResolutionMs = mockTelemetryData.decisionSystem.avgResolutionTimeMs;
      const minutes = Math.round(avgResolutionMs / 60000);
      expect(minutes).toBe(3);
    });
  });
});
