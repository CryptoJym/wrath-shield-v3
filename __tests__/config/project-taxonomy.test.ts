/**
 * Project Taxonomy Configuration Tests
 *
 * Validates the organizational hierarchy stays correct and doesn't drift.
 * These tests serve as the canonical source of truth for the structure.
 */

import * as fs from 'fs';
import * as path from 'path';

const TAXONOMY_PATH = path.join(process.cwd(), 'config', 'project-taxonomy.json');

describe('Project Taxonomy - Canonical Structure Validation', () => {
  let taxonomy: any;

  beforeAll(() => {
    const content = fs.readFileSync(TAXONOMY_PATH, 'utf-8');
    taxonomy = JSON.parse(content);
  });

  describe('Organization Structure', () => {
    test('Utlyze should be the umbrella organization', () => {
      expect(taxonomy.organization.umbrella).toBeDefined();
      expect(taxonomy.organization.umbrella.id).toBe('utlyze');
      expect(taxonomy.organization.umbrella.name).toBe('Utlyze');
    });

    test('should have exactly 3 business units under Utlyze', () => {
      const businessUnits = taxonomy.organization.business_units;
      expect(businessUnits).toHaveLength(3);

      const unitIds = businessUnits.map((u: any) => u.id);
      expect(unitIds).toContain('vuplicity');
      expect(unitIds).toContain('newreward');
      expect(unitIds).toContain('hdws');
    });

    test('all business units should have Utlyze as parent', () => {
      const businessUnits = taxonomy.organization.business_units;
      businessUnits.forEach((unit: any) => {
        expect(unit.parent).toBe('utlyze');
      });
    });

    test('R&D division should NOT be a business unit', () => {
      const businessUnits = taxonomy.organization.business_units;
      const unitIds = businessUnits.map((u: any) => u.id);

      // R&D should NOT be in business_units
      expect(unitIds).not.toContain('rd');
      expect(unitIds).not.toContain('eeg_symbiosis');
      expect(unitIds).not.toContain('eeg');

      // R&D should be in its own section
      expect(taxonomy.organization.rd_division).toBeDefined();
      expect(taxonomy.organization.rd_division.id).toBe('rd');
    });

    test('R&D division should be the orphan holding pen', () => {
      const rd = taxonomy.organization.rd_division;
      expect(rd.orphan_holding_pen).toBe(true);
      expect(rd.contains_orphans).toBe(true);
    });

    test('CryptoJym should NOT be a business unit', () => {
      const businessUnits = taxonomy.organization.business_units;
      const unitIds = businessUnits.map((u: any) => u.id);

      expect(unitIds).not.toContain('cryptojym');

      // Should be in legacy_personal section
      expect(taxonomy.organization.legacy_personal).toBeDefined();
      expect(taxonomy.organization.legacy_personal.id).toBe('cryptojym');
      expect(taxonomy.organization.legacy_personal.note).toContain('NOT a business unit');
    });

    test('should have exactly 2 partner companies', () => {
      const partners = taxonomy.organization.partner_companies;
      expect(partners).toHaveLength(2);

      const partnerIds = partners.map((p: any) => p.id);
      expect(partnerIds).toContain('kahoa');
      expect(partnerIds).toContain('solutionstream');
    });

    test('HDWS should be under Utlyze, not standalone', () => {
      const hdws = taxonomy.organization.business_units.find((u: any) => u.id === 'hdws');
      expect(hdws).toBeDefined();
      expect(hdws.parent).toBe('utlyze');
    });
  });

  describe('Domain Types', () => {
    const REQUIRED_DOMAINS = [
      'product-core',
      'infrastructure',
      'internal-tools',
      'client-delivery',
      'research-experiments',
      'growth-marketing',
      'operations',
      'personal',
      'archived',
    ];

    test('should have all required domains', () => {
      const domainIds = taxonomy.domains.map((d: any) => d.id);
      REQUIRED_DOMAINS.forEach((domain) => {
        expect(domainIds).toContain(domain);
      });
    });

    test('should have exactly 9 domains', () => {
      expect(taxonomy.domains).toHaveLength(9);
    });

    test('research-experiments domain should handle R&D content', () => {
      const researchDomain = taxonomy.domains.find((d: any) => d.id === 'research-experiments');
      expect(researchDomain).toBeDefined();
      expect(researchDomain.special_routing).toBe(true);
    });
  });

  describe('Hierarchy Types', () => {
    test('should define root_project with 3+ criteria threshold', () => {
      expect(taxonomy.hierarchy_types.root_project).toBeDefined();
      expect(taxonomy.hierarchy_types.root_project.criteria_threshold).toBe(3);
      expect(taxonomy.hierarchy_types.root_project.criteria).toHaveLength(5);
    });

    test('should define sub_project with 3+ criteria threshold', () => {
      expect(taxonomy.hierarchy_types.sub_project).toBeDefined();
      expect(taxonomy.hierarchy_types.sub_project.criteria_threshold).toBe(3);
      expect(taxonomy.hierarchy_types.sub_project.criteria).toHaveLength(5);
    });

    test('orphan default placement should be R&D (rd), not eeg_symbiosis', () => {
      expect(taxonomy.hierarchy_types.orphan).toBeDefined();
      expect(taxonomy.hierarchy_types.orphan.default_placement).toBe('rd');
      expect(taxonomy.hierarchy_types.orphan.default_placement).not.toBe('eeg_symbiosis');
    });

    test('orphans should require clarity tasks', () => {
      expect(taxonomy.hierarchy_types.orphan.requires_clarity_task).toBe(true);
    });
  });

  describe('Classification Patterns', () => {
    test('should have R&D patterns under "rd" key, not "eeg_symbiosis"', () => {
      expect(taxonomy.classification_patterns.rd).toBeDefined();
      expect(taxonomy.classification_patterns.eeg_symbiosis).toBeUndefined();

      const rdPatterns = taxonomy.classification_patterns.rd;
      expect(rdPatterns).toContain('eeg');
      expect(rdPatterns).toContain('consciousness');
      expect(rdPatterns).toContain('philosophy');
      expect(rdPatterns).toContain('physics');
    });

    test('Vuplicity patterns should include FCRA-related terms', () => {
      const vuplicity = taxonomy.classification_patterns.vuplicity;
      expect(vuplicity).toContain('fcra');
      expect(vuplicity).toContain('screening');
      expect(vuplicity).toContain('veri');
    });
  });

  describe('Agent Actions', () => {
    test('should define classification actions', () => {
      expect(taxonomy.agent_actions.classification).toContain('assign_business_unit');
      expect(taxonomy.agent_actions.classification).toContain('classify_as_root_project');
      expect(taxonomy.agent_actions.classification).toContain('classify_as_sub_project');
      expect(taxonomy.agent_actions.classification).toContain('mark_as_orphan');
    });

    test('should define domain actions', () => {
      expect(taxonomy.agent_actions.domain).toContain('set_domain');
      expect(taxonomy.agent_actions.domain).toContain('reclassify_domain');
    });

    test('should define hierarchy actions', () => {
      expect(taxonomy.agent_actions.hierarchy).toContain('set_parent');
      expect(taxonomy.agent_actions.hierarchy).toContain('promote_orphan_to_project');
    });

    test('should define maintenance actions', () => {
      expect(taxonomy.agent_actions.maintenance).toContain('archive_project');
      expect(taxonomy.agent_actions.maintenance).toContain('create_clarity_task');
    });
  });
});

describe('Project Taxonomy - Anti-Drift Checks', () => {
  let taxonomy: any;

  beforeAll(() => {
    const content = fs.readFileSync(TAXONOMY_PATH, 'utf-8');
    taxonomy = JSON.parse(content);
  });

  test('should NOT have eeg_symbiosis anywhere as a business unit', () => {
    const content = fs.readFileSync(TAXONOMY_PATH, 'utf-8');

    // Check it's not in business_units array
    const businessUnits = taxonomy.organization.business_units;
    const unitIds = businessUnits.map((u: any) => u.id);
    expect(unitIds).not.toContain('eeg_symbiosis');

    // Check the term doesn't appear as a standalone entity
    expect(content).not.toMatch(/"id":\s*"eeg_symbiosis"/);
  });

  test('should NOT have CryptoJym as a business unit', () => {
    const businessUnits = taxonomy.organization.business_units;
    const unitIds = businessUnits.map((u: any) => u.id);
    expect(unitIds).not.toContain('cryptojym');
  });

  test('should NOT have HDWS as a standalone entity outside Utlyze', () => {
    const hdws = taxonomy.organization.business_units.find((u: any) => u.id === 'hdws');
    expect(hdws.parent).toBe('utlyze');

    // Should not exist as a top-level organization
    expect(taxonomy.organization.umbrella.id).not.toBe('hdws');
  });

  test('orphan placement should reference "rd" not "eeg_symbiosis"', () => {
    expect(taxonomy.hierarchy_types.orphan.default_placement).toBe('rd');
  });
});
