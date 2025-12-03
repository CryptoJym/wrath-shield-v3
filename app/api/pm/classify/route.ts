/**
 * PM Batch Classification API
 *
 * POST /api/pm/classify - Auto-classify unclassified repos using taxonomy patterns
 * GET /api/pm/classify - Get classification status and stats
 *
 * Uses the project-taxonomy.json patterns to automatically classify repos
 * into the correct business units and domains.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import githubClient from '@/lib/integrations/GitHubClient';
import {
  executePMAction,
  executePMActionBatch,
  type PMAction,
} from '@/lib/pm/pm-actions';

export const dynamic = 'force-dynamic';

interface Taxonomy {
  classification_patterns: Record<string, string[]>;
  organization: {
    umbrella: { id: string };
    business_units: Array<{ id: string; key_products?: string[] }>;
    rd_division: { id: string; special_routing: string[] };
    legacy_personal: { id: string };
    partner_companies: Array<{ id: string }>;
  };
  domains: Array<{ id: string; criteria: string[] }>;
}

// Load taxonomy
function loadTaxonomy(): Taxonomy {
  const taxonomyPath = path.join(process.cwd(), 'config', 'project-taxonomy.json');
  const content = fs.readFileSync(taxonomyPath, 'utf-8');
  return JSON.parse(content);
}

interface ClassificationResult {
  repo_full_name: string;
  matched_unit: string | null;
  matched_domain: string | null;
  confidence: number;
  match_reason: string;
  actions_executed: boolean;
}

/**
 * Classify a single repo using taxonomy patterns
 */
function classifyRepo(
  repoFullName: string,
  repoName: string,
  description: string | null,
  taxonomy: Taxonomy
): { unit: string | null; domain: string | null; confidence: number; reason: string } {
  const owner = repoFullName.split('/')[0].toLowerCase();
  // Don't include owner in search text to avoid matching org name patterns
  const searchText = `${repoName} ${description || ''}`.toLowerCase();

  // Helper to determine domain based on unit
  const getDomain = (unitId: string): string => {
    if (unitId === 'rd') return 'research-experiments';
    if (unitId === 'cryptojym') return 'personal';
    if (['vuplicity', 'newreward', 'hdws'].includes(unitId)) return 'product-core';
    if (['kahoa', 'solutionstream'].includes(unitId)) return 'client-delivery';
    if (unitId === 'utlyze') return 'internal-tools';
    return 'product-core';
  };

  // First check business unit patterns (higher priority than cryptojym fallback)
  const businessUnitPatterns = ['vuplicity', 'newreward', 'hdws', 'utlyze', 'kahoa', 'solutionstream', 'rd'];
  for (const unitId of businessUnitPatterns) {
    const patterns = taxonomy.classification_patterns[unitId] || [];
    for (const pattern of patterns) {
      if (searchText.includes(pattern.toLowerCase())) {
        return {
          unit: unitId,
          domain: getDomain(unitId),
          confidence: 0.85,
          reason: `Matched pattern "${pattern}" for ${unitId}`,
        };
      }
    }
  }

  // Check R&D special routing patterns
  const rdPatterns = taxonomy.organization.rd_division.special_routing;
  for (const pattern of rdPatterns) {
    if (searchText.includes(pattern.toLowerCase())) {
      return {
        unit: 'rd',
        domain: 'research-experiments',
        confidence: 0.75,
        reason: `Matched R&D routing pattern "${pattern}"`,
      };
    }
  }

  // Check h3ro-dev org - these are likely Utlyze tools or need manual review
  if (owner === 'h3ro-dev') {
    // h3ro-dev is a Utlyze GitHub org
    // Check for specific patterns first
    const utlyzePatterns = taxonomy.classification_patterns['utlyze'] || [];
    for (const pattern of utlyzePatterns) {
      if (searchText.includes(pattern.toLowerCase())) {
        return {
          unit: 'utlyze',
          domain: 'internal-tools',
          confidence: 0.85,
          reason: `h3ro-dev repo matched Utlyze pattern "${pattern}"`,
        };
      }
    }

    // MCP servers are internal tools
    if (repoName.toLowerCase().includes('mcp')) {
      return {
        unit: 'utlyze',
        domain: 'internal-tools',
        confidence: 0.75,
        reason: 'h3ro-dev MCP server (Utlyze internal tools)',
      };
    }

    // Default h3ro-dev to orphan for manual classification
    return {
      unit: null,
      domain: null,
      confidence: 0,
      reason: 'h3ro-dev repo needs manual classification',
    };
  }

  // CryptoJym org handling
  if (owner === 'cryptojym') {
    // Already checked business patterns above, so this is truly legacy/personal
    return {
      unit: 'cryptojym',
      domain: 'personal',
      confidence: 0.6,
      reason: 'CryptoJym org default (legacy/personal)',
    };
  }

  // No match - mark as orphan (R&D)
  return {
    unit: null,
    domain: null,
    confidence: 0,
    reason: 'No pattern match - needs manual classification',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      dry_run = false,
      limit = 50,
      min_confidence = 0.6,
      force_reclassify = false,
    } = body;

    const taxonomy = loadTaxonomy();

    // Get repos
    const repos = await githubClient.getRepos();
    const mappings = githubClient.getRepoMappings();
    const mappingMap = new Map(mappings.map(m => [m.repo_full_name, m]));

    // Filter to unclassified or force all
    const reposToClassify = repos.filter(repo => {
      if (force_reclassify) return true;
      const mapping = mappingMap.get(repo.full_name);
      // Consider unclassified if no mapping or no project_name
      return !mapping || !mapping.project_name;
    }).slice(0, limit);

    const results: ClassificationResult[] = [];
    const actionsToExecute: PMAction[] = [];

    for (const repo of reposToClassify) {
      const classification = classifyRepo(
        repo.full_name,
        repo.name,
        repo.description,
        taxonomy
      );

      const result: ClassificationResult = {
        repo_full_name: repo.full_name,
        matched_unit: classification.unit,
        matched_domain: classification.domain,
        confidence: classification.confidence,
        match_reason: classification.reason,
        actions_executed: false,
      };

      if (classification.unit && classification.confidence >= min_confidence) {
        // Queue actions
        actionsToExecute.push({
          action: 'assign_business_unit',
          repo_full_name: repo.full_name,
          params: { business_unit: classification.unit },
          rationale: classification.reason,
          confidence: classification.confidence,
          escalation_level: 'auto',
        });

        if (classification.domain) {
          actionsToExecute.push({
            action: 'set_domain',
            repo_full_name: repo.full_name,
            params: { domain: classification.domain },
            rationale: `Auto-assigned based on ${classification.unit} classification`,
            confidence: classification.confidence,
            escalation_level: 'auto',
          });
        }
      } else if (!classification.unit) {
        // Mark as orphan
        actionsToExecute.push({
          action: 'mark_as_orphan',
          repo_full_name: repo.full_name,
          rationale: classification.reason,
          escalation_level: 'auto',
        });
      }

      results.push(result);
    }

    // Execute actions if not dry run
    let actionResults: Array<{ success: boolean; action: string; repo_full_name: string; message: string }> = [];
    if (!dry_run && actionsToExecute.length > 0) {
      actionResults = await executePMActionBatch(actionsToExecute);

      // Update results with execution status
      for (const result of results) {
        const executed = actionResults.find(ar => ar.repo_full_name === result.repo_full_name && ar.success);
        result.actions_executed = !!executed;
      }
    }

    // Summary stats
    const summary = {
      total_repos: repos.length,
      repos_processed: reposToClassify.length,
      classified: results.filter(r => r.matched_unit).length,
      orphaned: results.filter(r => !r.matched_unit).length,
      high_confidence: results.filter(r => r.confidence >= 0.8).length,
      medium_confidence: results.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length,
      low_confidence: results.filter(r => r.confidence > 0 && r.confidence < 0.6).length,
      actions_executed: dry_run ? 0 : actionResults.filter(a => a.success).length,
      by_unit: {} as Record<string, number>,
      by_domain: {} as Record<string, number>,
    };

    // Count by unit and domain
    for (const result of results) {
      if (result.matched_unit) {
        summary.by_unit[result.matched_unit] = (summary.by_unit[result.matched_unit] || 0) + 1;
      }
      if (result.matched_domain) {
        summary.by_domain[result.matched_domain] = (summary.by_domain[result.matched_domain] || 0) + 1;
      }
    }

    return NextResponse.json({
      ok: true,
      dry_run,
      summary,
      results,
      action_results: dry_run ? null : actionResults,
    });
  } catch (error) {
    console.error('[PM Classify API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const taxonomy = loadTaxonomy();
    const repos = await githubClient.getRepos();
    const mappings = githubClient.getRepoMappings();
    const mappingMap = new Map(mappings.map(m => [m.repo_full_name, m]));

    // Count classified vs unclassified
    let classified = 0;
    let unclassified = 0;
    const byUnit: Record<string, number> = {};
    const byDomain: Record<string, number> = {};

    for (const repo of repos) {
      const mapping = mappingMap.get(repo.full_name);
      if (mapping?.project_name) {
        classified++;
        byUnit[mapping.project_name] = (byUnit[mapping.project_name] || 0) + 1;
        if (mapping.domain) {
          byDomain[mapping.domain] = (byDomain[mapping.domain] || 0) + 1;
        }
      } else {
        unclassified++;
      }
    }

    return NextResponse.json({
      ok: true,
      status: {
        total_repos: repos.length,
        classified,
        unclassified,
        by_unit: byUnit,
        by_domain: byDomain,
      },
      taxonomy_version: taxonomy.version || 1,
      available_units: [
        taxonomy.organization.umbrella.id,
        ...taxonomy.organization.business_units.map(u => u.id),
        taxonomy.organization.rd_division.id,
        taxonomy.organization.legacy_personal.id,
        ...taxonomy.organization.partner_companies.map(p => p.id),
      ],
      available_domains: taxonomy.domains.map(d => d.id),
    });
  } catch (error) {
    console.error('[PM Classify API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
