/**
 * Pattern Recognizer Tests
 */

import { getPatternRecognizer } from '../pattern-recognizer';
import { getEventBus } from '@/lib/agents/life-os-event-bus';

describe('PatternRecognizer', () => {
  beforeEach(() => {
    // Reset singleton between tests
    jest.resetModules();
  });

  it('should initialize without errors', () => {
    const recognizer = getPatternRecognizer();
    expect(recognizer).toBeDefined();
  });

  it('should detect patterns from recurring events', async () => {
    const recognizer = getPatternRecognizer();
    const eventBus = getEventBus();

    // Emit several similar events
    for (let i = 0; i < 5; i++) {
      await eventBus.publish({
        id: `test-event-${i}`,
        type: 'task',
        source: 'pm-agent',
        domain: 'development',
        payload: { action: 'create-task', taskId: `task-${i}` },
        timestamp: new Date(Date.now() + i * 1000),
        priority: 5
      });
    }

    // Manually trigger analysis
    await recognizer.analyzePatterns();

    // Check for detected patterns
    const patterns = recognizer.getAllPatterns();
    expect(patterns.length).toBeGreaterThan(0);

    const pmPattern = patterns.find(p => p.agentId === 'pm-agent');
    expect(pmPattern).toBeDefined();
    expect(pmPattern?.type).toBe('task');
    expect(pmPattern?.domain).toBe('development');
  });

  it('should filter patterns by agent', async () => {
    const recognizer = getPatternRecognizer();
    const eventBus = getEventBus();

    // Create events from different agents
    for (let i = 0; i < 3; i++) {
      await eventBus.publish({
        id: `agent-a-${i}`,
        type: 'task',
        source: 'agent-a',
        domain: 'test',
        payload: { action: 'test' },
        timestamp: new Date(),
        priority: 5
      });

      await eventBus.publish({
        id: `agent-b-${i}`,
        type: 'task',
        source: 'agent-b',
        domain: 'test',
        payload: { action: 'test' },
        timestamp: new Date(),
        priority: 5
      });
    }

    await recognizer.analyzePatterns();

    const agentAPatterns = recognizer.getAgentPatterns('agent-a');
    const agentBPatterns = recognizer.getAgentPatterns('agent-b');

    expect(agentAPatterns.length).toBeGreaterThan(0);
    expect(agentBPatterns.length).toBeGreaterThan(0);
    expect(agentAPatterns.every(p => p.agentId === 'agent-a')).toBe(true);
    expect(agentBPatterns.every(p => p.agentId === 'agent-b')).toBe(true);
  });

  it('should find matching patterns for similar events', async () => {
    const recognizer = getPatternRecognizer();
    const eventBus = getEventBus();

    // Create a pattern
    for (let i = 0; i < 5; i++) {
      await eventBus.publish({
        id: `routing-${i}`,
        type: 'routing',
        source: 'inbox-agent',
        domain: 'email',
        payload: { action: 'classify' },
        timestamp: new Date(),
        priority: 5
      });
    }

    await recognizer.analyzePatterns();

    // Test matching with a similar event
    const matches = recognizer.findMatchingPatterns({
      id: 'test-match',
      type: 'routing',
      source: 'inbox-agent',
      domain: 'email',
      payload: { action: 'classify' },
      timestamp: new Date(),
      priority: 5
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].matchScore).toBeGreaterThan(0.5);
    expect(matches[0].suggestedAction).toBeDefined();
  });

  it('should calculate confidence based on occurrence count', async () => {
    const recognizer = getPatternRecognizer();
    const eventBus = getEventBus();

    // Create pattern with many occurrences
    for (let i = 0; i < 15; i++) {
      await eventBus.publish({
        id: `confidence-test-${i}`,
        type: 'task',
        source: 'test-agent',
        domain: 'test',
        payload: { action: 'test' },
        timestamp: new Date(),
        priority: 5
      });
    }

    await recognizer.analyzePatterns();

    const patterns = recognizer.getAgentPatterns('test-agent');
    expect(patterns.length).toBeGreaterThan(0);

    // Confidence should be capped at 1.0 (15/10 = 1.5, but capped)
    const pattern = patterns[0];
    expect(pattern.confidence).toBeLessThanOrEqual(1.0);
    expect(pattern.confidence).toBeGreaterThan(0.8);
  });

  it('should filter patterns by domain', async () => {
    const recognizer = getPatternRecognizer();
    const eventBus = getEventBus();

    // Create events in different domains
    for (let i = 0; i < 3; i++) {
      await eventBus.publish({
        id: `finance-${i}`,
        type: 'task',
        source: 'agent-x',
        domain: 'finance',
        payload: { action: 'test' },
        timestamp: new Date(),
        priority: 5
      });

      await eventBus.publish({
        id: `legal-${i}`,
        type: 'task',
        source: 'agent-x',
        domain: 'legal',
        payload: { action: 'test' },
        timestamp: new Date(),
        priority: 5
      });
    }

    await recognizer.analyzePatterns();

    const financePatterns = recognizer.getDomainPatterns('finance');
    const legalPatterns = recognizer.getDomainPatterns('legal');

    expect(financePatterns.length).toBeGreaterThan(0);
    expect(legalPatterns.length).toBeGreaterThan(0);
    expect(financePatterns.every(p => p.domain === 'finance')).toBe(true);
    expect(legalPatterns.every(p => p.domain === 'legal')).toBe(true);
  });
});
