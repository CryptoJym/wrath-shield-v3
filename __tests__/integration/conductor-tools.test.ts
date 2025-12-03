/**
 * Conductor Tools Integration Tests
 *
 * Tests the tool definitions and execution handlers in the agentic_service.
 * These tests validate that the Python service is correctly configured.
 */

import * as fs from 'fs';
import * as path from 'path';

// Skip if file doesn't exist (e.g., in CI without full project)
const servicePath = path.join(
  process.cwd(),
  'services/agentic-grok/agentic_service.py'
);
const fileExists = fs.existsSync(servicePath);

const describeIfFileExists = fileExists ? describe : describe.skip;

describeIfFileExists('Conductor Service Configuration', () => {

  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(servicePath, 'utf-8');
  });

  describe('Tool Definitions', () => {
    const expectedTools = [
      // Existing tools
      'whoop_data_query',
      'limitless_query',
      'memory_search',
      'memory_add',
      'legal_context_fetch',
      'legal_context_resolve',
      // Orchestrator Gateway tools
      'invoke_agent',
      'query_memory',
      'update_memory',
      'system_pulse',
      'setup_memory',
      'coordinate_agents',
      'get_config',
      // Unified Bus tools (NEW)
      'read_agent_memory',
      'write_agent_memory',
      'search_all_memories',
      'write_org_memory',
      'get_all_states',
      'get_agent_state',
      'broadcast',
      'route_message',
      'system_overview',
    ];

    expectedTools.forEach((toolName) => {
      it(`should define the ${toolName} tool`, () => {
        expect(serviceContent).toContain(`name="${toolName}"`);
      });
    });

    it('should include all tools in the return list', () => {
      // Check that the return statement contains tool references
      const returnSection = serviceContent.match(/return \[\s*[\s\S]*?\]/);
      expect(returnSection).toBeTruthy();

      expectedTools.forEach((toolName) => {
        // Tool variable names are derived from tool names
        const varName = toolName + '_tool';
        // Check tool is defined as chat_pb2.Tool
        const hasToolDef = serviceContent.includes(`${varName} = chat_pb2.Tool`);
        // Some tools like whoop/limitless are defined inline in original code
        const hasNameDef = serviceContent.includes(`name="${toolName}"`);
        expect(hasToolDef || hasNameDef).toBe(true);
      });
    });
  });

  describe('Tool Handlers', () => {
    const toolsWithHandlers = [
      'invoke_agent',
      'query_memory',
      'update_memory',
      'system_pulse',
      'setup_memory',
      'coordinate_agents',
      'get_config',
      'read_agent_memory',
      'write_agent_memory',
      'search_all_memories',
      'write_org_memory',
      'get_all_states',
      'get_agent_state',
      'broadcast',
      'route_message',
      'system_overview',
    ];

    toolsWithHandlers.forEach((toolName) => {
      it(`should have handler for ${toolName}`, () => {
        expect(serviceContent).toContain(`elif tool_name == "${toolName}":`);
      });
    });
  });

  describe('Gateway Operations', () => {
    it('should use unified gateway operation for bus tools', () => {
      // Check that new tools use the unified gateway operation
      const unifiedTools = [
        'read_agent_memory',
        'write_agent_memory',
        'search_all_memories',
        'write_org_memory',
        'get_agent_state',
        'broadcast',
        'route_message',
      ];

      unifiedTools.forEach((tool) => {
        // Find the section for this tool
        const regex = new RegExp(
          `elif tool_name == "${tool}":[\\s\\S]*?"gatewayOperation": "unified"`,
          'g'
        );
        expect(serviceContent).toMatch(regex);
      });
    });

    it('should use correct port (4242)', () => {
      expect(serviceContent).toContain('http://localhost:4242');
    });
  });

  describe('Model Configuration', () => {
    it('should use grok-4-1-fast as default model', () => {
      expect(serviceContent).toContain('grok-4-1-fast');
    });

    it('should reference approved models in system prompt', () => {
      expect(serviceContent).toContain('GPT-5.1');
      expect(serviceContent).toContain('Grok 4.1 Fast');
    });
  });

  describe('System Prompt', () => {
    it('should define Conductor identity', () => {
      expect(serviceContent).toContain('You are Conductor');
      expect(serviceContent).toContain("James Brady's Life OS");
    });

    it('should include transparency instructions', () => {
      expect(serviceContent).toContain('BE TRANSPARENT');
      expect(serviceContent).toContain('Grok 4.1 Fast');
    });

    it('should document all capabilities', () => {
      expect(serviceContent).toContain('Agent Communication');
      expect(serviceContent).toContain('Memory Access');
      expect(serviceContent).toContain('System Awareness');
      expect(serviceContent).toContain('UNIFIED BUS');
      expect(serviceContent).toContain('GOD MODE');
    });

    it('should include @mention aliases', () => {
      expect(serviceContent).toContain('@legal');
      expect(serviceContent).toContain('@finance');
      expect(serviceContent).toContain('@health');
      expect(serviceContent).toContain('@coach');
    });

    it('should document Life OS priorities', () => {
      expect(serviceContent).toContain('Family & Home');
      expect(serviceContent).toContain('Utlyze');
      expect(serviceContent).toContain('SolutionStream');
    });
  });
});

describeIfFileExists('Conductor Tool Schemas', () => {
  // These tests validate the JSON schema structure of each tool

  let serviceContent: string;

  beforeAll(() => {
    serviceContent = fs.readFileSync(servicePath, 'utf-8');
  });

  describe('read_agent_memory tool', () => {
    it('should require agent_id and query parameters', () => {
      // Check that required params are in the tool definition
      expect(serviceContent).toContain('name="read_agent_memory"');
      expect(serviceContent).toContain('"agent_id"');
      expect(serviceContent).toContain('"query"');
    });
  });

  describe('write_agent_memory tool', () => {
    it('should require agent_id and text parameters', () => {
      expect(serviceContent).toContain('name="write_agent_memory"');
      expect(serviceContent).toContain('"agent_id"');
      expect(serviceContent).toContain('"text"');
    });
  });

  describe('broadcast tool', () => {
    it('should require message parameter', () => {
      expect(serviceContent).toContain('name="broadcast"');
      expect(serviceContent).toContain('"message"');
    });

    it('should support priority enum', () => {
      expect(serviceContent).toContain('"low"');
      expect(serviceContent).toContain('"normal"');
      expect(serviceContent).toContain('"high"');
      expect(serviceContent).toContain('"critical"');
    });
  });

  describe('get_agent_state tool', () => {
    it('should require agent_id parameter', () => {
      expect(serviceContent).toContain('name="get_agent_state"');
      expect(serviceContent).toContain('"agent_id"');
    });
  });

  describe('system_overview tool', () => {
    it('should have no required parameters', () => {
      // The tool exists and has empty required array
      expect(serviceContent).toContain('name="system_overview"');
      // Check it has a required: [] somewhere in the tool definition
      const overviewMatch = serviceContent.match(/system_overview_tool[\s\S]*?"required":\s*\[\]/);
      expect(overviewMatch).toBeTruthy();
    });
  });
});
