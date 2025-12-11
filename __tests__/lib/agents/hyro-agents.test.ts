// @ts-nocheck
/**
 * Wrath Shield v3 - Hyro Agents Tests
 *
 * Tests for the Hyro Forge specialized tutoring agents:
 * - Assessment Agent (proficiency analysis)
 * - Content Agent (material selection)
 * - Tutor Agent (Socratic instruction)
 * - Progress Agent (learning tracking)
 * - Workflow configurations
 */

import {
  HYRO_ASSESSMENT_AGENT,
  HYRO_CONTENT_AGENT,
  HYRO_TUTOR_AGENT,
  HYRO_PROGRESS_AGENT,
  HYRO_AGENTS,
  getHyroAgent,
  isHyroAgent,
  TUTORING_SESSION_WORKFLOW,
  QUICK_CHECKIN_WORKFLOW,
  DEEP_DIAGNOSTIC_WORKFLOW,
  type HyroAgentContext,
  type AssessmentResult,
  type ContentSelection,
  type TutorSynthesis,
  type ProgressInsight,
} from '@/lib/agents/hyro-agents';

describe('Hyro Agents', () => {
  describe('Agent Definitions', () => {
    describe('HYRO_ASSESSMENT_AGENT', () => {
      it('should have correct ID', () => {
        expect(HYRO_ASSESSMENT_AGENT.id).toBe('agent.hyro.assessment');
      });

      it('should have required fields', () => {
        expect(HYRO_ASSESSMENT_AGENT.name).toBe('Hyro Assessment Agent');
        expect(HYRO_ASSESSMENT_AGENT.type).toBe('support');
        expect(HYRO_ASSESSMENT_AGENT.domains).toContain('education');
        expect(HYRO_ASSESSMENT_AGENT.domains).toContain('hyro');
      });

      it('should have tools configured', () => {
        expect(HYRO_ASSESSMENT_AGENT.tools).toContain('database');
        expect(HYRO_ASSESSMENT_AGENT.tools).toContain('memory');
      });

      it('should have system prompt with assessment instructions', () => {
        expect(HYRO_ASSESSMENT_AGENT.system_prompt).toContain('Assessment Agent');
        expect(HYRO_ASSESSMENT_AGENT.system_prompt).toContain('ZPD');
        expect(HYRO_ASSESSMENT_AGENT.system_prompt).toContain('proficiency');
      });
    });

    describe('HYRO_CONTENT_AGENT', () => {
      it('should have correct ID', () => {
        expect(HYRO_CONTENT_AGENT.id).toBe('agent.hyro.content');
      });

      it('should have required fields', () => {
        expect(HYRO_CONTENT_AGENT.name).toBe('Hyro Content Agent');
        expect(HYRO_CONTENT_AGENT.type).toBe('support');
        expect(HYRO_CONTENT_AGENT.role).toContain('learning materials');
      });

      it('should have system prompt with content selection rules', () => {
        expect(HYRO_CONTENT_AGENT.system_prompt).toContain('Content Agent');
        expect(HYRO_CONTENT_AGENT.system_prompt).toContain('diagnostic');
        expect(HYRO_CONTENT_AGENT.system_prompt).toContain('practice');
        expect(HYRO_CONTENT_AGENT.system_prompt).toContain('quest');
      });
    });

    describe('HYRO_TUTOR_AGENT', () => {
      it('should have correct ID and name', () => {
        expect(HYRO_TUTOR_AGENT.id).toBe('agent.hyro.tutor');
        expect(HYRO_TUTOR_AGENT.name).toBe('Sage (Hyro Tutor)');
      });

      it('should be domain type (user-facing)', () => {
        expect(HYRO_TUTOR_AGENT.type).toBe('domain');
      });

      it('should have llm tool for synthesis', () => {
        expect(HYRO_TUTOR_AGENT.tools).toContain('llm');
      });

      it('should have system prompt with Socratic method', () => {
        expect(HYRO_TUTOR_AGENT.system_prompt).toContain('Sage');
        expect(HYRO_TUTOR_AGENT.system_prompt).toContain('SOCRATIC METHOD');
        expect(HYRO_TUTOR_AGENT.system_prompt).toContain('6th grade');
        expect(HYRO_TUTOR_AGENT.system_prompt).toContain('Hyro');
      });

      it('should have link to tutor page', () => {
        expect(HYRO_TUTOR_AGENT.link).toBe('/hyro/tutor');
      });

      it('should have higher max_context_tasks', () => {
        expect(HYRO_TUTOR_AGENT.max_context_tasks).toBe(10);
      });
    });

    describe('HYRO_PROGRESS_AGENT', () => {
      it('should have correct ID', () => {
        expect(HYRO_PROGRESS_AGENT.id).toBe('agent.hyro.progress');
      });

      it('should be support type (background)', () => {
        expect(HYRO_PROGRESS_AGENT.type).toBe('support');
      });

      it('should have higher max_context for historical analysis', () => {
        expect(HYRO_PROGRESS_AGENT.max_context_tasks).toBe(20);
      });

      it('should have system prompt for progress tracking', () => {
        expect(HYRO_PROGRESS_AGENT.system_prompt).toContain('Progress Agent');
        expect(HYRO_PROGRESS_AGENT.system_prompt).toContain('background');
        expect(HYRO_PROGRESS_AGENT.system_prompt).toContain('milestones');
      });
    });
  });

  describe('HYRO_AGENTS Registry', () => {
    it('should contain all 4 agents', () => {
      expect(HYRO_AGENTS).toHaveLength(4);
    });

    it('should contain all agent types', () => {
      const ids = HYRO_AGENTS.map(a => a.id);
      expect(ids).toContain('agent.hyro.assessment');
      expect(ids).toContain('agent.hyro.content');
      expect(ids).toContain('agent.hyro.tutor');
      expect(ids).toContain('agent.hyro.progress');
    });

    it('should have unique IDs', () => {
      const ids = HYRO_AGENTS.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should all have education domain', () => {
      for (const agent of HYRO_AGENTS) {
        expect(agent.domains).toContain('education');
      }
    });

    it('should all have hyro domain', () => {
      for (const agent of HYRO_AGENTS) {
        expect(agent.domains).toContain('hyro');
      }
    });
  });

  describe('getHyroAgent', () => {
    it('should return agent by ID', () => {
      const agent = getHyroAgent('agent.hyro.tutor');
      expect(agent).toBe(HYRO_TUTOR_AGENT);
    });

    it('should return null for non-existent agent', () => {
      const agent = getHyroAgent('agent.hyro.nonexistent');
      expect(agent).toBeNull();
    });

    it('should return null for non-hyro agents', () => {
      const agent = getHyroAgent('agent.finance');
      expect(agent).toBeNull();
    });

    it('should find all registered agents', () => {
      for (const agent of HYRO_AGENTS) {
        const found = getHyroAgent(agent.id);
        expect(found).toBe(agent);
      }
    });
  });

  describe('isHyroAgent', () => {
    it('should return true for hyro agent IDs', () => {
      expect(isHyroAgent('agent.hyro.assessment')).toBe(true);
      expect(isHyroAgent('agent.hyro.content')).toBe(true);
      expect(isHyroAgent('agent.hyro.tutor')).toBe(true);
      expect(isHyroAgent('agent.hyro.progress')).toBe(true);
    });

    it('should return false for non-hyro agent IDs', () => {
      expect(isHyroAgent('agent.finance')).toBe(false);
      expect(isHyroAgent('agent.legal')).toBe(false);
      expect(isHyroAgent('agent.orchestrator')).toBe(false);
    });

    it('should return true for any agent starting with agent.hyro.', () => {
      expect(isHyroAgent('agent.hyro.custom')).toBe(true);
      expect(isHyroAgent('agent.hyro.new.nested')).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(isHyroAgent('agent.hyro')).toBe(false); // No trailing dot
      expect(isHyroAgent('hyro.agent')).toBe(false);
      expect(isHyroAgent('')).toBe(false);
    });
  });

  describe('Workflow Configurations', () => {
    describe('TUTORING_SESSION_WORKFLOW', () => {
      it('should have correct ID', () => {
        expect(TUTORING_SESSION_WORKFLOW.id).toBe('hyro.tutoring_session');
      });

      it('should have 3 phases', () => {
        expect(TUTORING_SESSION_WORKFLOW.phases).toHaveLength(3);
      });

      it('should have parallel phase 1 with assessment and content', () => {
        const phase1 = TUTORING_SESSION_WORKFLOW.phases[0];
        expect(phase1.id).toBe('phase_1_parallel');
        expect(phase1.type).toBe('parallel');
        expect(phase1.agents).toContain('agent.hyro.assessment');
        expect(phase1.agents).toContain('agent.hyro.content');
      });

      it('should have sequential phase 2 with tutor depending on phase 1', () => {
        const phase2 = TUTORING_SESSION_WORKFLOW.phases[1];
        expect(phase2.id).toBe('phase_2_synthesis');
        expect(phase2.type).toBe('sequential');
        expect(phase2.agents).toContain('agent.hyro.tutor');
        expect(phase2.depends_on).toContain('phase_1_parallel');
      });

      it('should have fire-and-forget phase 3 for progress', () => {
        const phase3 = TUTORING_SESSION_WORKFLOW.phases[2];
        expect(phase3.id).toBe('phase_3_background');
        expect(phase3.type).toBe('fire_and_forget');
        expect(phase3.agents).toContain('agent.hyro.progress');
      });

      it('should have timeout for parallel phase', () => {
        const phase1 = TUTORING_SESSION_WORKFLOW.phases[0];
        expect(phase1.timeout_ms).toBe(30000);
      });
    });

    describe('QUICK_CHECKIN_WORKFLOW', () => {
      it('should have correct ID', () => {
        expect(QUICK_CHECKIN_WORKFLOW.id).toBe('hyro.quick_checkin');
      });

      it('should have single phase with tutor only', () => {
        expect(QUICK_CHECKIN_WORKFLOW.phases).toHaveLength(1);
        expect(QUICK_CHECKIN_WORKFLOW.phases[0].agents).toContain('agent.hyro.tutor');
      });

      it('should use cached context', () => {
        const phase = QUICK_CHECKIN_WORKFLOW.phases[0];
        expect(phase.use_cached_context).toBe(true);
      });

      it('should have 5 minute cache max age', () => {
        const phase = QUICK_CHECKIN_WORKFLOW.phases[0];
        expect(phase.cache_max_age_ms).toBe(5 * 60 * 1000);
      });
    });

    describe('DEEP_DIAGNOSTIC_WORKFLOW', () => {
      it('should have correct ID', () => {
        expect(DEEP_DIAGNOSTIC_WORKFLOW.id).toBe('hyro.deep_diagnostic');
      });

      it('should have 4 sequential phases', () => {
        expect(DEEP_DIAGNOSTIC_WORKFLOW.phases).toHaveLength(4);
        DEEP_DIAGNOSTIC_WORKFLOW.phases.forEach(phase => {
          expect(phase.type).toBe('sequential');
        });
      });

      it('should have correct phase order', () => {
        const agents = DEEP_DIAGNOSTIC_WORKFLOW.phases.map(p => p.agents[0]);
        expect(agents).toEqual([
          'agent.hyro.assessment',
          'agent.hyro.content',
          'agent.hyro.progress',
          'agent.hyro.tutor',
        ]);
      });

      it('should have correct dependency chain', () => {
        const phase2 = DEEP_DIAGNOSTIC_WORKFLOW.phases[1];
        const phase3 = DEEP_DIAGNOSTIC_WORKFLOW.phases[2];
        const phase4 = DEEP_DIAGNOSTIC_WORKFLOW.phases[3];

        expect(phase2.depends_on).toContain('phase_1_assessment');
        expect(phase3.depends_on).toContain('phase_2_content');
        expect(phase4.depends_on).toContain('phase_3_progress');
      });

      it('should have no dependencies on first phase', () => {
        const phase1 = DEEP_DIAGNOSTIC_WORKFLOW.phases[0];
        expect(phase1.depends_on).toBeUndefined();
      });
    });
  });

  describe('Type Definitions', () => {
    it('should accept valid HyroAgentContext', () => {
      const context: HyroAgentContext = {
        student_id: 'hyro-123',
        proficiency: [],
        zpd_states: [],
        skill_gaps: [],
        learning_velocities: [],
        flow_states: [],
        current_streak: 5,
        due_cards_count: 10,
      };

      expect(context.student_id).toBe('hyro-123');
    });

    it('should accept valid AssessmentResult', () => {
      const result: AssessmentResult = {
        weakest_areas: [{ stat: 'math', level: 3, urgency: 'high' }],
        gaps_identified: [{ stat: 'math', topic: 'fractions', severity: 'major' }],
        recommended_focus: ['math', 'reading'],
        scaffolding_needed: true,
        assessment_summary: 'Focus on math fundamentals',
      };

      expect(result.scaffolding_needed).toBe(true);
    });

    it('should accept valid ContentSelection', () => {
      const selection: ContentSelection = {
        recommended_content: [
          {
            type: 'diagnostic',
            stat: 'math',
            difficulty: 5,
            rationale: 'Check current level',
          },
        ],
        sequence_order: ['diagnostic', 'practice'],
        estimated_duration_minutes: 30,
        content_summary: 'Start with math diagnostic',
      };

      expect(selection.estimated_duration_minutes).toBe(30);
    });

    it('should accept valid TutorSynthesis', () => {
      const synthesis: TutorSynthesis = {
        greeting: 'Hello Hyro!',
        main_message: 'Let\'s work on math today.',
        suggested_actions: [
          { type: 'start_session', label: 'Begin Learning', priority: 1 },
        ],
        motivational_note: 'You\'re doing great!',
      };

      expect(synthesis.greeting).toBe('Hello Hyro!');
    });

    it('should accept valid ProgressInsight', () => {
      const insight: ProgressInsight = {
        daily_summary: 'Completed 3 sessions',
        weekly_trend: 'Improving steadily',
        achievements: ['5-day streak!'],
        areas_needing_attention: ['science'],
        recommended_goals: ['Complete math unit'],
      };

      expect(insight.achievements).toContain('5-day streak!');
    });
  });
});
