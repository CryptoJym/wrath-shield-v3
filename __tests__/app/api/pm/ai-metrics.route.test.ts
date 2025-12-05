/**
 * AI Metrics API Route Tests
 *
 * Tests for the /api/pm/ai-metrics endpoint including:
 * - GET requests for metrics views
 * - POST requests for feedback and bootstrap
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/pm/ai-metrics/route';

// Mock observability module
const mockGetDisagreementSummary = jest.fn(() => ({
  total_decisions: 100,
  ai_only: 20,
  rules_only: 10,
  both_available: 70,
  agreements: 50,
  disagreements: 20,
  agreement_rate: 0.71,
  disagreement_by_type: { action: 10, escalation: 5, priority: 3, multiple: 2 },
  human_overrides: 5,
  ai_correct_after_override: 3,
  rules_correct_after_override: 1,
}));

const mockGetConfidenceDistribution = jest.fn(() => [
  { bucket: '0-20%', count: 5, ai_accepted: 1, fallback_to_rules: 3, human_override: 1 },
  { bucket: '20-40%', count: 10, ai_accepted: 3, fallback_to_rules: 5, human_override: 2 },
  { bucket: '40-60%', count: 20, ai_accepted: 10, fallback_to_rules: 8, human_override: 2 },
  { bucket: '60-80%', count: 40, ai_accepted: 35, fallback_to_rules: 3, human_override: 2 },
  { bucket: '80-100%', count: 25, ai_accepted: 24, fallback_to_rules: 0, human_override: 1 },
]);

const mockGetPerformanceMetrics = jest.fn(() => ({
  period_start: 1700000000,
  period_end: 1700086400,
  total_signals: 100,
  ai_processed: 85,
  ai_success_rate: 0.85,
  avg_ai_confidence: 0.72,
  avg_processing_time_ms: 150,
  zep_context_usage_rate: 0.65,
  human_override_rate: 0.05,
}));

const mockGetRecentDisagreements = jest.fn(() => [
  {
    id: 'td_1',
    signal_id: 'sig_1',
    signal_source: 'github',
    signal_type: 'task',
    ai_action: 'local_task',
    rule_action: 'github_issue',
  },
]);

const mockGetPendingReviewDecisions = jest.fn(() => [
  {
    id: 'td_2',
    signal_id: 'sig_2',
    signal_source: 'comms',
    signal_type: 'follow_up',
    ai_action: 'local_task',
    rule_action: 'defer',
  },
]);

const mockAnalyzeOptimalThreshold = jest.fn(() => ({
  current_threshold: 0.6,
  recommended_threshold: 0.65,
  analysis: [
    { threshold: 0.5, ai_acceptance_rate: 0.8, human_agreement_rate: 0.7, disagreement_rate: 0.3 },
    { threshold: 0.6, ai_acceptance_rate: 0.6, human_agreement_rate: 0.85, disagreement_rate: 0.15 },
  ],
}));

const mockRecordHumanFeedback = jest.fn().mockResolvedValue(true);

jest.mock('@/lib/pm/ai-observability', () => ({
  getDisagreementSummary: () => mockGetDisagreementSummary(),
  getConfidenceDistribution: () => mockGetConfidenceDistribution(),
  getPerformanceMetrics: () => mockGetPerformanceMetrics(),
  getRecentDisagreements: (limit: number) => mockGetRecentDisagreements(limit),
  getPendingReviewDecisions: (limit: number) => mockGetPendingReviewDecisions(limit),
  analyzeOptimalThreshold: () => mockAnalyzeOptimalThreshold(),
  recordHumanFeedback: (...args: unknown[]) => mockRecordHumanFeedback(...args),
}));

// Mock bootstrap-memory module
const mockBootstrapPMMemory = jest.fn().mockResolvedValue({
  seeded: 25,
  skipped: 0,
  errors: [],
});

const mockListBootstrapPatterns = jest.fn(() => [
  { id: 'legal-deadline-critical', category: 'pattern', preview: 'Legal deadlines...' },
  { id: 'github-issue-opened', category: 'pattern', preview: 'GitHub issues...' },
]);

const mockAddCustomTriagePattern = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/pm/bootstrap-memory', () => ({
  bootstrapPMMemory: (...args: unknown[]) => mockBootstrapPMMemory(...args),
  listBootstrapPatterns: () => mockListBootstrapPatterns(),
  addCustomTriagePattern: (...args: unknown[]) => mockAddCustomTriagePattern(...args),
}));

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options);
}

describe('AI Metrics API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/pm/ai-metrics', () => {
    test('should return all views by default', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.disagreement_summary).toBeDefined();
      expect(data.confidence_distribution).toBeDefined();
      expect(data.performance_metrics).toBeDefined();
      expect(data.recent_disagreements).toBeDefined();
      expect(data.pending_review).toBeDefined();
      expect(data.threshold_analysis).toBeDefined();
      expect(data.metadata).toBeDefined();
    });

    test('should return only summary view when specified', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics?view=summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.disagreement_summary).toBeDefined();
      expect(data.confidence_distribution).toBeUndefined();
      expect(data.performance_metrics).toBeUndefined();
    });

    test('should return only confidence view when specified', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics?view=confidence');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.confidence_distribution).toBeDefined();
      expect(data.disagreement_summary).toBeUndefined();
    });

    test('should return only performance view when specified', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics?view=performance');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.performance_metrics).toBeDefined();
      expect(data.disagreement_summary).toBeUndefined();
    });

    test('should return only disagreements view when specified', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics?view=disagreements');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recent_disagreements).toBeDefined();
      expect(data.disagreement_summary).toBeUndefined();
    });

    test('should return only pending view when specified', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics?view=pending');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pending_review).toBeDefined();
      expect(data.disagreement_summary).toBeUndefined();
    });

    test('should return only threshold view when specified', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics?view=threshold');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.threshold_analysis).toBeDefined();
      expect(data.disagreement_summary).toBeUndefined();
    });

    test('should include metadata with timestamp and view', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics?view=summary');
      const response = await GET(request);
      const data = await response.json();

      expect(data.metadata).toBeDefined();
      expect(data.metadata.timestamp).toBeDefined();
      expect(data.metadata.view).toBe('summary');
    });

    test('should pass limit parameter to list views', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics?view=disagreements&limit=50');
      await GET(request);

      expect(mockGetRecentDisagreements).toHaveBeenCalledWith(50);
    });

    test('should handle errors gracefully', async () => {
      mockGetDisagreementSummary.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const request = createRequest('http://localhost/api/pm/ai-metrics?view=summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.details).toContain('Database error');
    });
  });

  describe('POST /api/pm/ai-metrics - feedback action', () => {
    test('should record human feedback', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'feedback',
          decision_id: 'td_123',
          human_action: 'local_task',
          human_escalation: 'auto',
          human_priority: 'medium',
          feedback: 'AI was correct',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockRecordHumanFeedback).toHaveBeenCalledWith({
        decisionId: 'td_123',
        humanAction: 'local_task',
        humanEscalation: 'auto',
        humanPriority: 'medium',
        feedback: 'AI was correct',
      });
    });

    test('should require decision_id for feedback', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'feedback',
          human_action: 'local_task',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('decision_id is required');
    });

    test('should handle feedback not found', async () => {
      mockRecordHumanFeedback.mockResolvedValueOnce(false);

      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'feedback',
          decision_id: 'td_nonexistent',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.message).toContain('not found');
    });
  });

  describe('POST /api/pm/ai-metrics - bootstrap action', () => {
    test('should bootstrap all categories by default', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bootstrap',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.seeded).toBe(25);
      expect(mockBootstrapPMMemory).toHaveBeenCalledWith({
        categories: ['triage', 'domain', 'escalation', 'corrections'],
      });
    });

    test('should bootstrap specific categories when provided', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bootstrap',
          categories: ['triage', 'domain'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockBootstrapPMMemory).toHaveBeenCalledWith({
        categories: ['triage', 'domain'],
      });
    });

    test('should report bootstrap errors', async () => {
      mockBootstrapPMMemory.mockResolvedValueOnce({
        seeded: 20,
        skipped: 0,
        errors: ['Failed to seed pattern-1', 'Failed to seed pattern-2'],
      });

      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bootstrap',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.errors).toHaveLength(2);
    });
  });

  describe('POST /api/pm/ai-metrics - add_pattern action', () => {
    test('should add custom triage pattern', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add_pattern',
          id: 'custom-urgent-client',
          description: 'Urgent client requests need immediate attention',
          source: 'comms',
          signal_type: 'follow_up',
          keywords: ['urgent', 'client', 'asap'],
          recommended_action: 'local_task',
          recommended_escalation: 'propose',
          recommended_priority: 'high',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockAddCustomTriagePattern).toHaveBeenCalledWith({
        id: 'custom-urgent-client',
        description: 'Urgent client requests need immediate attention',
        source: 'comms',
        signalType: 'follow_up',
        keywords: ['urgent', 'client', 'asap'],
        recommendedAction: 'local_task',
        recommendedEscalation: 'propose',
        recommendedPriority: 'high',
      });
    });

    test('should require mandatory fields for add_pattern', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add_pattern',
          id: 'custom-pattern',
          // missing description, recommended_action, recommended_escalation
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });
  });

  describe('POST /api/pm/ai-metrics - list_patterns action', () => {
    test('should list all bootstrap patterns', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'list_patterns',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.patterns).toBeDefined();
      expect(data.count).toBe(2);
      expect(mockListBootstrapPatterns).toHaveBeenCalled();
    });
  });

  describe('POST /api/pm/ai-metrics - unknown action', () => {
    test('should return error for unknown action', async () => {
      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'unknown_action',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unknown action');
      expect(data.error).toContain('unknown_action');
    });
  });

  describe('Error handling', () => {
    test('should handle POST errors gracefully', async () => {
      mockBootstrapPMMemory.mockRejectedValueOnce(new Error('Unexpected error'));

      const request = createRequest('http://localhost/api/pm/ai-metrics', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bootstrap',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to process request');
      expect(data.details).toContain('Unexpected error');
    });
  });
});
