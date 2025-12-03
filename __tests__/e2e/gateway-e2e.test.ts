/**
 * Gateway E2E Tests
 *
 * End-to-end tests that hit the actual running gateway API.
 * These require the Next.js server to be running on port 4242.
 *
 * Run with: npm run dev (in another terminal)
 * Then: npm test -- --testPathPattern=e2e
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4242/api/orchestrator/gateway';
const SKIP_E2E = process.env.SKIP_E2E === 'true';

// Helper to check if server is running
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${GATEWAY_URL}?operation=pulse`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Skip all tests if server is not running
const conditionalDescribe = SKIP_E2E ? describe.skip : describe;

conditionalDescribe('Gateway E2E Tests', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await isServerRunning();
    if (!serverAvailable) {
      console.warn(
        '\n⚠️  Gateway server not running. Skipping E2E tests.\n' +
          '   Start server with: npm run dev\n' +
          '   Or set SKIP_E2E=true to skip these tests.\n'
      );
    }
  });

  describe('System Status Endpoints', () => {
    it('should return system pulse', async () => {
      if (!serverAvailable) return;

      const response = await fetch(`${GATEWAY_URL}?operation=pulse`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.timestamp).toBeDefined();
      expect(data.systemHealth).toMatch(/healthy|degraded|critical/);
      expect(data.agents).toBeDefined();
    });

    it('should return all agent states', async () => {
      if (!serverAvailable) return;

      const response = await fetch(`${GATEWAY_URL}?operation=states`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.states).toBeDefined();
    });

    it('should return system overview', async () => {
      if (!serverAvailable) return;

      const response = await fetch(`${GATEWAY_URL}?operation=overview`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.overview).toBeDefined();
      expect(data.overview.systemHealth).toBeDefined();
    });
  });

  describe('Configuration Endpoints', () => {
    it('should return life charter', async () => {
      if (!serverAvailable) return;

      const response = await fetch(`${GATEWAY_URL}?operation=config&scope=life_charter`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.lifeCharter).toBeDefined();
    });

    it('should return domains', async () => {
      if (!serverAvailable) return;

      const response = await fetch(`${GATEWAY_URL}?operation=config&scope=domains`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.domains).toBeDefined();
    });

    it('should return agents', async () => {
      if (!serverAvailable) return;

      const response = await fetch(`${GATEWAY_URL}?operation=config&scope=agents`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.agents).toBeDefined();
    });
  });

  describe('Unified Bus Operations', () => {
    it('should get agent state via unified bus', async () => {
      if (!serverAvailable) return;

      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayOperation: 'unified',
          operation: 'get_agent_state',
          agentId: 'agent.legal',
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBeDefined();
    });

    it('should get all states via unified bus', async () => {
      if (!serverAvailable) return;

      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayOperation: 'unified',
          operation: 'get_all_states',
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.states).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for unknown gateway operation', async () => {
      if (!serverAvailable) return;

      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayOperation: 'invalid_operation',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing required parameters', async () => {
      if (!serverAvailable) return;

      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayOperation: 'invoke',
          // Missing agentId and message
        }),
      });

      expect(response.status).toBe(400);
    });
  });
});

conditionalDescribe('Memory E2E Tests', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await isServerRunning();
  });

  describe('Memory Search Operations', () => {
    it('should search org memory', async () => {
      if (!serverAvailable) return;

      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayOperation: 'unified',
          operation: 'read_org_memory',
          query: 'test query',
          limit: 5,
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should search agent memory', async () => {
      if (!serverAvailable) return;

      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayOperation: 'unified',
          operation: 'read_agent_memory',
          agentId: 'agent.legal',
          query: 'test query',
          limit: 5,
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBeDefined();
    });

    it('should search all memories', async () => {
      if (!serverAvailable) return;

      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayOperation: 'unified',
          operation: 'search_all_memories',
          query: 'test query',
          limit: 3,
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

/**
 * Performance benchmark tests
 */
conditionalDescribe('Gateway Performance Tests', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await isServerRunning();
  });

  it('pulse endpoint should respond within 500ms', async () => {
    if (!serverAvailable) return;

    const start = Date.now();
    await fetch(`${GATEWAY_URL}?operation=pulse`);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
  });

  it('states endpoint should respond within 500ms', async () => {
    if (!serverAvailable) return;

    const start = Date.now();
    await fetch(`${GATEWAY_URL}?operation=states`);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
  });

  it('config endpoint should respond within 200ms', async () => {
    if (!serverAvailable) return;

    const start = Date.now();
    await fetch(`${GATEWAY_URL}?operation=config&scope=life_charter`);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(200);
  });
});
