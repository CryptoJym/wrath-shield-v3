import { NextRequest, NextResponse } from 'next/server';
import {
  searchPMMemory,
  getPMContext,
  addPMMemory,
  recordRepoAssignment,
  recordProjectContext,
  recordOrganizationRule,
  getOrganizationStructure,
  getOrganizationalPolicies,
  getRepoOrganizationContext,
  proposeOrganizationPolicy,
  getHistoricalContext,
} from '@/lib/pm/pm-memory';

// Phase 4 imports
import {
  getEntityHistory,
  getCurrentState,
  getHistoricalState,
  getTemporalStats,
  type EntityType
} from '@/lib/pm/temporal-memory';
import {
  runPatternExtraction,
  getPattern,
  getPatternsByType,
  type PatternType
} from '@/lib/pm/pattern-extraction';
import {
  generateDailySuggestions,
  suggestTaskPriority,
  predictCompletionTime
} from '@/lib/pm/predictive-suggestions';
import {
  recordCorrection,
  getAccuracyMetrics,
  learnFromCorrections
} from '@/lib/pm/correction-feedback';

/**
 * PM Memory API
 *
 * GET /api/pm/memory?action=...
 *   - search: Search PM memories (Zep)
 *   - context: Get combined PM + org context
 *   - structure: Get organization structure from memory
 *   - policies: Get organizational policies
 *   - repo-context: Get context for a specific repo
 *
 *   PHASE 4 (Temporal Memory):
 *   - history: Get entity history (temporal facts)
 *   - state: Get current or historical entity state
 *   - patterns: Get extracted patterns
 *   - suggestions: Get predictive suggestions
 *   - accuracy: Get accuracy metrics
 *   - stats: Get temporal memory statistics
 *
 * POST /api/pm/memory
 *   - add: Add PM memory
 *   - record-assignment: Record repo assignment
 *   - record-project: Record project context
 *   - record-rule: Record organization rule
 *   - propose-policy: Propose organizational policy
 *
 *   PHASE 4 (Learning):
 *   - correction: Record a correction for learning
 *   - learn: Trigger learning from corrections
 *   - extract-patterns: Run pattern extraction
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'search';

    switch (action) {
      case 'search': {
        const query = searchParams.get('query');
        if (!query) {
          return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
        }

        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
        const results = await searchPMMemory(query, limit);

        return NextResponse.json({
          action: 'search',
          query,
          count: results.length,
          results: results.map(r => ({
            text: r.memory.text.substring(0, 500),
            score: r.score,
            metadata: r.memory.metadata,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'context': {
        const query = searchParams.get('query');
        if (!query) {
          return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
        }

        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 5;
        const context = await getPMContext(query, limit);

        return NextResponse.json({
          action: 'context',
          query,
          private: context.private.map(r => ({
            text: r.memory.text.substring(0, 500),
            score: r.score,
            metadata: r.memory.metadata,
          })),
          org: context.org.map(r => ({
            text: r.memory.text.substring(0, 500),
            score: r.score,
            metadata: r.memory.metadata,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'structure': {
        const structure = await getOrganizationStructure();

        return NextResponse.json({
          action: 'structure',
          projects: Object.fromEntries(structure.projects),
          rulesCount: structure.rules.length,
          rules: structure.rules.map(r => ({
            text: r.memory.text.split('\n')[0],
            metadata: r.memory.metadata,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'policies': {
        const query = searchParams.get('query') || 'organization policy';
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
        const policies = await getOrganizationalPolicies(query, limit);

        return NextResponse.json({
          action: 'policies',
          count: policies.length,
          policies: policies.map(p => ({
            text: p.memory.text.substring(0, 500),
            score: p.score,
            metadata: p.memory.metadata,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'repo-context': {
        const repoName = searchParams.get('repoName');
        if (!repoName) {
          return NextResponse.json({ error: 'Missing repoName parameter' }, { status: 400 });
        }

        const context = await getRepoOrganizationContext(repoName);

        return NextResponse.json({
          action: 'repo-context',
          repoName,
          context,
          timestamp: new Date().toISOString(),
        });
      }

      // ========================================================================
      // Phase 4: Temporal Memory Actions
      // ========================================================================

      case 'history': {
        const entity_type = searchParams.get('entity_type') as EntityType;
        const entity_id = searchParams.get('entity_id');

        if (!entity_type || !entity_id) {
          return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 });
        }

        const history = getEntityHistory(entity_type, entity_id);

        return NextResponse.json({
          action: 'history',
          entity_type,
          entity_id,
          history,
          fact_count: history.length,
          timestamp: new Date().toISOString(),
        });
      }

      case 'state': {
        const entity_type = searchParams.get('entity_type') as EntityType;
        const entity_id = searchParams.get('entity_id');
        const point_in_time = searchParams.get('point_in_time');

        if (!entity_type || !entity_id) {
          return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 });
        }

        const state = point_in_time
          ? getHistoricalState(entity_type, entity_id, new Date(point_in_time))
          : getCurrentState(entity_type, entity_id);

        return NextResponse.json({
          action: 'state',
          entity_type,
          entity_id,
          point_in_time: point_in_time || 'current',
          state,
          timestamp: new Date().toISOString(),
        });
      }

      case 'patterns': {
        const pattern_type = searchParams.get('pattern_type') as PatternType | null;
        const pattern_id = searchParams.get('pattern_id');
        const extract = searchParams.get('extract') === 'true';

        if (pattern_id) {
          const pattern = await getPattern(pattern_id);
          if (!pattern) {
            return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
          }
          return NextResponse.json({
            action: 'patterns',
            pattern,
            timestamp: new Date().toISOString(),
          });
        }

        if (extract) {
          const patterns = await runPatternExtraction();
          return NextResponse.json({
            action: 'patterns',
            message: 'Pattern extraction complete',
            patterns,
            count: patterns.length,
            timestamp: new Date().toISOString(),
          });
        }

        if (pattern_type) {
          const patterns = await getPatternsByType(pattern_type);
          return NextResponse.json({
            action: 'patterns',
            pattern_type,
            patterns,
            count: patterns.length,
            timestamp: new Date().toISOString(),
          });
        }

        return NextResponse.json({
          error: 'Specify pattern_id, pattern_type, or extract=true'
        }, { status: 400 });
      }

      case 'suggestions': {
        const task_id = searchParams.get('task_id');
        const suggestion_type = searchParams.get('type');

        if (task_id && suggestion_type === 'priority') {
          const suggestion = await suggestTaskPriority(task_id);
          return NextResponse.json({
            action: 'suggestions',
            type: 'priority',
            task_id,
            suggestion,
            timestamp: new Date().toISOString(),
          });
        }

        if (task_id && suggestion_type === 'completion') {
          const suggestion = await predictCompletionTime(task_id);
          return NextResponse.json({
            action: 'suggestions',
            type: 'completion',
            task_id,
            suggestion,
            timestamp: new Date().toISOString(),
          });
        }

        // Daily suggestions
        const suggestions = await generateDailySuggestions();
        return NextResponse.json({
          action: 'suggestions',
          suggestions,
          count: suggestions.length,
          timestamp: new Date().toISOString(),
        });
      }

      case 'accuracy': {
        const metrics = await getAccuracyMetrics();
        return NextResponse.json({
          action: 'accuracy',
          metrics,
          timestamp: new Date().toISOString(),
        });
      }

      case 'stats': {
        const stats = getTemporalStats();
        return NextResponse.json({
          action: 'stats',
          stats,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[PMMemoryAPI] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get PM memory data', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'add': {
        const { text, category, metadata } = body;
        if (!text || !category) {
          return NextResponse.json(
            { error: 'Missing required fields: text, category' },
            { status: 400 }
          );
        }

        await addPMMemory(text, category, metadata);

        return NextResponse.json({
          action: 'add',
          added: true,
          category,
          timestamp: new Date().toISOString(),
        });
      }

      case 'record-assignment': {
        const { repoName, repoFullName, projectId, projectName, rationale, confidence, source, assignedBy } = body;
        if (!repoName || !repoFullName || !projectName || !rationale) {
          return NextResponse.json(
            { error: 'Missing required fields: repoName, repoFullName, projectName, rationale' },
            { status: 400 }
          );
        }

        await recordRepoAssignment({
          repoName,
          repoFullName,
          projectId: projectId || '',
          projectName,
          rationale,
          confidence: confidence || 1.0,
          source: source || 'manual',
          assignedAt: new Date().toISOString(),
          assignedBy,
        });

        return NextResponse.json({
          action: 'record-assignment',
          recorded: true,
          timestamp: new Date().toISOString(),
        });
      }

      case 'record-project': {
        const { projectId, projectName, description, domain, repos, primaryLanguages, teamMembers } = body;
        if (!projectId || !projectName || !repos) {
          return NextResponse.json(
            { error: 'Missing required fields: projectId, projectName, repos' },
            { status: 400 }
          );
        }

        await recordProjectContext({
          projectId,
          projectName,
          description,
          domain,
          repos,
          primaryLanguages,
          teamMembers,
        });

        return NextResponse.json({
          action: 'record-project',
          recorded: true,
          timestamp: new Date().toISOString(),
        });
      }

      case 'record-rule': {
        const { pattern, targetProject, confidence, examples } = body;
        if (!pattern || !targetProject) {
          return NextResponse.json(
            { error: 'Missing required fields: pattern, targetProject' },
            { status: 400 }
          );
        }

        await recordOrganizationRule({
          id: `rule-${Date.now()}`,
          pattern,
          targetProject,
          confidence: confidence || 0.7,
          examples: examples || [],
          createdAt: new Date().toISOString(),
        });

        return NextResponse.json({
          action: 'record-rule',
          recorded: true,
          timestamp: new Date().toISOString(),
        });
      }

      case 'propose-policy': {
        const { policy, rationale, affectedProjects } = body;
        if (!policy || !rationale || !affectedProjects) {
          return NextResponse.json(
            { error: 'Missing required fields: policy, rationale, affectedProjects' },
            { status: 400 }
          );
        }

        const proposal = await proposeOrganizationPolicy(policy, rationale, affectedProjects);

        return NextResponse.json({
          action: 'propose-policy',
          proposalId: proposal.id,
          status: proposal.status,
          timestamp: new Date().toISOString(),
        });
      }

      // ========================================================================
      // Phase 4: Learning Actions
      // ========================================================================

      case 'correction': {
        const { correction_type, original_entity_type, original_entity_id, original_value, corrected_value, context, reason } = body;

        if (!correction_type || !original_entity_type || !original_entity_id || original_value === undefined || corrected_value === undefined) {
          return NextResponse.json(
            { error: 'Missing required fields: correction_type, original_entity_type, original_entity_id, original_value, corrected_value' },
            { status: 400 }
          );
        }

        const correction = await recordCorrection({
          correction_type,
          original_entity_type,
          original_entity_id,
          original_value,
          corrected_value,
          context,
          reason
        });

        // Trigger learning immediately
        const learning_result = await learnFromCorrections();

        return NextResponse.json({
          action: 'correction',
          correction,
          learning_triggered: true,
          learning_result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'learn': {
        const result = await learnFromCorrections();

        return NextResponse.json({
          action: 'learn',
          message: 'Learning complete',
          result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'extract-patterns': {
        const patterns = await runPatternExtraction();

        return NextResponse.json({
          action: 'extract-patterns',
          message: 'Pattern extraction complete',
          patterns,
          count: patterns.length,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[PMMemoryAPI] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to execute PM memory action', details: String(error) },
      { status: 500 }
    );
  }
}
