// @ts-nocheck
/**
 * Tests for HYRO FORGE: Assessment Blueprints
 *
 * Tests the manifold-aware assessment blueprint system that defines
 * strands, tiers, and weights for each stat/subject area.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Import after any mocks
import {
  getBlueprint,
  ASSESSMENT_BLUEPRINTS,
} from '../../../lib/hyro/forge-blueprints';
import type {
  ManifoldDimension,
  StrandTier,
  Strand,
  AssessmentBlueprint,
} from '../../../lib/hyro/forge-blueprints';

describe('HYRO FORGE: Assessment Blueprints', () => {
  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    it('should define ManifoldDimension values', () => {
      const dimensions: ManifoldDimension[] = [
        'coherence',
        'fluidity',
        'elasticity',
        'gradient_awareness',
        'entropy_intuition',
        'non_dual_resolution',
        'generativity',
      ];
      expect(dimensions).toHaveLength(7);
    });

    it('should define StrandTier values', () => {
      const tiers: StrandTier[] = ['Foundation', 'Bridge', 'Power', 'Horizon'];
      expect(tiers).toHaveLength(4);
    });

    it('should define Strand interface', () => {
      const strand: Strand = {
        strand: 'Arithmetic & Number Sense',
        weight: 0.05,
        tier: 'Foundation',
        manifold_focus: 'coherence',
      };

      expect(strand.strand).toBe('Arithmetic & Number Sense');
      expect(strand.weight).toBe(0.05);
      expect(strand.tier).toBe('Foundation');
      expect(strand.manifold_focus).toBe('coherence');
    });

    it('should define AssessmentBlueprint interface', () => {
      const blueprint: AssessmentBlueprint = {
        stat_name: 'math',
        strands: [],
      };

      expect(blueprint.stat_name).toBe('math');
      expect(Array.isArray(blueprint.strands)).toBe(true);
    });
  });

  // ==========================================================================
  // Blueprint Structure Tests
  // ==========================================================================

  describe('ASSESSMENT_BLUEPRINTS', () => {
    it('should define blueprints for all core stats', () => {
      const coreStats = [
        'math',
        'reading',
        'writing',
        'science',
        'coding',
        'critical_thinking',
        'technology',
        'study_skills',
        'problem_solving',
        'social_studies',
        'financial_literacy',
      ];

      for (const stat of coreStats) {
        expect(ASSESSMENT_BLUEPRINTS[stat]).toBeDefined();
        expect(ASSESSMENT_BLUEPRINTS[stat].stat_name).toBe(stat);
      }
    });

    it('should have strands for each blueprint', () => {
      for (const statName in ASSESSMENT_BLUEPRINTS) {
        const blueprint = ASSESSMENT_BLUEPRINTS[statName];
        expect(blueprint.strands.length).toBeGreaterThan(0);
      }
    });

    it('should have strand weights that sum to approximately 1.0', () => {
      for (const statName in ASSESSMENT_BLUEPRINTS) {
        const blueprint = ASSESSMENT_BLUEPRINTS[statName];
        const totalWeight = blueprint.strands.reduce((sum, s) => sum + s.weight, 0);
        expect(totalWeight).toBeCloseTo(1.0, 1); // Allow small floating point variance
      }
    });

    it('should have valid tier values for all strands', () => {
      const validTiers: StrandTier[] = ['Foundation', 'Bridge', 'Power', 'Horizon'];

      for (const statName in ASSESSMENT_BLUEPRINTS) {
        const blueprint = ASSESSMENT_BLUEPRINTS[statName];
        for (const strand of blueprint.strands) {
          expect(validTiers).toContain(strand.tier);
        }
      }
    });

    it('should have valid manifold_focus values for all strands', () => {
      const validDimensions: ManifoldDimension[] = [
        'coherence',
        'fluidity',
        'elasticity',
        'gradient_awareness',
        'entropy_intuition',
        'non_dual_resolution',
        'generativity',
      ];

      for (const statName in ASSESSMENT_BLUEPRINTS) {
        const blueprint = ASSESSMENT_BLUEPRINTS[statName];
        for (const strand of blueprint.strands) {
          expect(validDimensions).toContain(strand.manifold_focus);
        }
      }
    });
  });

  // ==========================================================================
  // Math Blueprint Tests
  // ==========================================================================

  describe('Math Blueprint', () => {
    it('should have correct stat_name', () => {
      expect(ASSESSMENT_BLUEPRINTS.math.stat_name).toBe('math');
    });

    it('should have foundation tier strands', () => {
      const foundationStrands = ASSESSMENT_BLUEPRINTS.math.strands.filter(
        s => s.tier === 'Foundation'
      );
      expect(foundationStrands.length).toBeGreaterThan(0);
      expect(foundationStrands.some(s => s.strand.includes('Arithmetic'))).toBe(true);
    });

    it('should have bridge tier strands', () => {
      const bridgeStrands = ASSESSMENT_BLUEPRINTS.math.strands.filter(
        s => s.tier === 'Bridge'
      );
      expect(bridgeStrands.length).toBeGreaterThan(0);
    });

    it('should have power tier strands', () => {
      const powerStrands = ASSESSMENT_BLUEPRINTS.math.strands.filter(
        s => s.tier === 'Power'
      );
      expect(powerStrands.length).toBeGreaterThan(0);
      expect(powerStrands.some(s => s.strand.includes('Calculus'))).toBe(true);
    });

    it('should have horizon tier strands', () => {
      const horizonStrands = ASSESSMENT_BLUEPRINTS.math.strands.filter(
        s => s.tier === 'Horizon'
      );
      expect(horizonStrands.length).toBeGreaterThan(0);
      expect(horizonStrands.some(s => s.strand.includes('Abstract Algebra'))).toBe(true);
    });

    it('should include advanced math topics', () => {
      const strandNames = ASSESSMENT_BLUEPRINTS.math.strands.map(s => s.strand);
      expect(strandNames).toContain('Differential Equations (ODEs)');
      expect(strandNames).toContain('Tensor Analysis & Manifolds');
      expect(strandNames).toContain('Chaos & Dynamical Systems');
    });
  });

  // ==========================================================================
  // Reading Blueprint Tests
  // ==========================================================================

  describe('Reading Blueprint', () => {
    it('should have correct stat_name', () => {
      expect(ASSESSMENT_BLUEPRINTS.reading.stat_name).toBe('reading');
    });

    it('should include key reading strands', () => {
      const strandNames = ASSESSMENT_BLUEPRINTS.reading.strands.map(s => s.strand);
      expect(strandNames).toContain('Key Ideas & Details');
      expect(strandNames).toContain('Craft & Structure');
      expect(strandNames).toContain('Philosophy of Language');
    });

    it('should have strands across all tiers', () => {
      const tiers = new Set(ASSESSMENT_BLUEPRINTS.reading.strands.map(s => s.tier));
      expect(tiers.has('Foundation')).toBe(true);
      expect(tiers.has('Bridge')).toBe(true);
      expect(tiers.has('Power')).toBe(true);
      expect(tiers.has('Horizon')).toBe(true);
    });
  });

  // ==========================================================================
  // Writing Blueprint Tests
  // ==========================================================================

  describe('Writing Blueprint', () => {
    it('should have correct stat_name', () => {
      expect(ASSESSMENT_BLUEPRINTS.writing.stat_name).toBe('writing');
    });

    it('should include key writing strands', () => {
      const strandNames = ASSESSMENT_BLUEPRINTS.writing.strands.map(s => s.strand);
      expect(strandNames).toContain('Organization & Purpose');
      expect(strandNames).toContain('Evidence & Elaboration');
      expect(strandNames).toContain('Rhetoric & Persuasion');
    });

    it('should have horizon tier with creative writing', () => {
      const horizonStrands = ASSESSMENT_BLUEPRINTS.writing.strands.filter(
        s => s.tier === 'Horizon'
      );
      expect(horizonStrands.some(s => s.strand.includes('Poetics'))).toBe(true);
    });
  });

  // ==========================================================================
  // Science Blueprint Tests
  // ==========================================================================

  describe('Science Blueprint', () => {
    it('should have correct stat_name', () => {
      expect(ASSESSMENT_BLUEPRINTS.science.stat_name).toBe('science');
    });

    it('should include major science domains', () => {
      const strandNames = ASSESSMENT_BLUEPRINTS.science.strands.map(s => s.strand);
      expect(strandNames).toContain('Physical Sciences (Newtonian)');
      expect(strandNames).toContain('Life Sciences (Cellular)');
      expect(strandNames).toContain('Earth & Space Sciences');
    });

    it('should include advanced physics topics', () => {
      const strandNames = ASSESSMENT_BLUEPRINTS.science.strands.map(s => s.strand);
      expect(strandNames).toContain('Quantum Mechanics');
      expect(strandNames).toContain('Relativity (Special & General)');
    });

    it('should have entropy_intuition for thermodynamics', () => {
      const thermoStrand = ASSESSMENT_BLUEPRINTS.science.strands.find(
        s => s.strand.includes('Thermodynamics')
      );
      expect(thermoStrand?.manifold_focus).toBe('entropy_intuition');
    });
  });

  // ==========================================================================
  // Coding Blueprint Tests
  // ==========================================================================

  describe('Coding Blueprint', () => {
    it('should have correct stat_name', () => {
      expect(ASSESSMENT_BLUEPRINTS.coding.stat_name).toBe('coding');
    });

    it('should include foundational programming strands', () => {
      const strandNames = ASSESSMENT_BLUEPRINTS.coding.strands.map(s => s.strand);
      expect(strandNames).toContain('Algorithms & Logic');
      expect(strandNames).toContain('Data Structures');
    });

    it('should include advanced CS topics', () => {
      const strandNames = ASSESSMENT_BLUEPRINTS.coding.strands.map(s => s.strand);
      expect(strandNames).toContain('Distributed Systems');
      expect(strandNames).toContain('Compiler Design & Languages');
      expect(strandNames).toContain('Quantum Computing');
    });
  });

  // ==========================================================================
  // Critical Thinking Blueprint Tests
  // ==========================================================================

  describe('Critical Thinking Blueprint', () => {
    it('should have correct stat_name', () => {
      expect(ASSESSMENT_BLUEPRINTS.critical_thinking.stat_name).toBe('critical_thinking');
    });

    it('should include epistemology', () => {
      const strandNames = ASSESSMENT_BLUEPRINTS.critical_thinking.strands.map(s => s.strand);
      expect(strandNames).toContain('Epistemology & Truth');
    });

    it('should include bias mitigation', () => {
      const strandNames = ASSESSMENT_BLUEPRINTS.critical_thinking.strands.map(s => s.strand);
      expect(strandNames).toContain('Cognitive Bias Mitigation');
    });
  });

  // ==========================================================================
  // getBlueprint Function Tests
  // ==========================================================================

  describe('getBlueprint', () => {
    it('should return blueprint for valid stat name', () => {
      const blueprint = getBlueprint('math');
      expect(blueprint.stat_name).toBe('math');
      expect(blueprint.strands.length).toBeGreaterThan(0);
    });

    it('should return correct blueprint for each stat', () => {
      const stats = ['reading', 'writing', 'science', 'coding'];

      for (const stat of stats) {
        const blueprint = getBlueprint(stat as any);
        expect(blueprint.stat_name).toBe(stat);
      }
    });

    it('should return fallback blueprint for unknown stat', () => {
      const blueprint = getBlueprint('unknown_stat' as any);

      expect(blueprint.stat_name).toBe('unknown_stat');
      expect(blueprint.strands).toHaveLength(1);
      expect(blueprint.strands[0].strand).toBe('General');
      expect(blueprint.strands[0].weight).toBe(1.0);
    });

    it('should return fallback with correct tier and manifold focus', () => {
      const blueprint = getBlueprint('nonexistent' as any);

      expect(blueprint.strands[0].tier).toBe('Foundation');
      expect(blueprint.strands[0].manifold_focus).toBe('coherence');
    });
  });

  // ==========================================================================
  // Manifold Focus Distribution Tests
  // ==========================================================================

  describe('Manifold Focus Distribution', () => {
    it('should have coherence as primary focus in foundation tiers', () => {
      for (const statName in ASSESSMENT_BLUEPRINTS) {
        const foundationStrands = ASSESSMENT_BLUEPRINTS[statName].strands.filter(
          s => s.tier === 'Foundation'
        );

        const coherenceCount = foundationStrands.filter(
          s => s.manifold_focus === 'coherence'
        ).length;

        // Most foundation strands should focus on coherence
        expect(coherenceCount).toBeGreaterThan(0);
      }
    });

    it('should have generativity focus in horizon tiers', () => {
      let hasGenerativityInHorizon = false;

      for (const statName in ASSESSMENT_BLUEPRINTS) {
        const horizonStrands = ASSESSMENT_BLUEPRINTS[statName].strands.filter(
          s => s.tier === 'Horizon'
        );

        if (horizonStrands.some(s => s.manifold_focus === 'generativity')) {
          hasGenerativityInHorizon = true;
          break;
        }
      }

      expect(hasGenerativityInHorizon).toBe(true);
    });

    it('should distribute manifold dimensions across strands', () => {
      const allDimensions = new Set<ManifoldDimension>();

      for (const statName in ASSESSMENT_BLUEPRINTS) {
        for (const strand of ASSESSMENT_BLUEPRINTS[statName].strands) {
          allDimensions.add(strand.manifold_focus);
        }
      }

      // Should use most available dimensions
      expect(allDimensions.size).toBeGreaterThanOrEqual(5);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle financial_literacy blueprint', () => {
      const blueprint = getBlueprint('financial_literacy');
      expect(blueprint.stat_name).toBe('financial_literacy');
      expect(blueprint.strands.some(s => s.strand.includes('Crypto'))).toBe(true);
    });

    it('should handle technology blueprint', () => {
      const blueprint = getBlueprint('technology');
      expect(blueprint.stat_name).toBe('technology');
      expect(blueprint.strands.some(s => s.strand.includes('AI'))).toBe(true);
    });

    it('should have non-negative weights', () => {
      for (const statName in ASSESSMENT_BLUEPRINTS) {
        for (const strand of ASSESSMENT_BLUEPRINTS[statName].strands) {
          expect(strand.weight).toBeGreaterThanOrEqual(0);
          expect(strand.weight).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should have non-empty strand names', () => {
      for (const statName in ASSESSMENT_BLUEPRINTS) {
        for (const strand of ASSESSMENT_BLUEPRINTS[statName].strands) {
          expect(strand.strand.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
