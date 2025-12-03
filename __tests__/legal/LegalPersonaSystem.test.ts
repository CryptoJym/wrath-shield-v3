/**
 * Legal Persona System Tests
 *
 * Tests the legal persona transfiguration functionality.
 */

import {
  detectLegalDomain,
  transfigurePersona,
  createMatter,
  getMatter,
  updateMatter,
  getAllMatters,
  LEGAL_PERSONAS,
  DOMAIN_KEYWORDS,
  type LegalDomain,
} from '@/lib/legal/LegalPersonaSystem';

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('LegalPersonaSystem', () => {
  describe('Domain Detection', () => {
    it('should detect family law domain from custody keywords', () => {
      const result = detectLegalDomain('I need help with my custody case');
      expect(result.domain).toBe('family_law');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchedKeywords).toContain('custody');
    });

    it('should detect FCRA domain from credit report keywords', () => {
      const result = detectLegalDomain('There is an error on my credit report from Experian');
      expect(result.domain).toBe('fcra_compliance');
      expect(result.matchedKeywords).toContain('credit report');
    });

    it('should detect employment law domain', () => {
      const result = detectLegalDomain('I was wrongfully terminated and facing discrimination');
      expect(result.domain).toBe('employment_law');
      expect(result.matchedKeywords).toContain('terminated');
    });

    it('should detect criminal defense domain', () => {
      const result = detectLegalDomain('I was arrested for DUI and need help with charges');
      expect(result.domain).toBe('criminal_defense');
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    });

    it('should return general domain when no keywords match', () => {
      const result = detectLegalDomain('Hello, how are you today?');
      expect(result.domain).toBe('general');
      expect(result.confidence).toBe(0.3);
      expect(result.matchedKeywords).toEqual([]);
    });

    it('should detect Utah jurisdiction', () => {
      // Need family law keywords to get a domain match first
      const result = detectLegalDomain('My custody case is in the Utah courts in Salt Lake');
      expect(result.suggestedJurisdiction).toBe('utah');
    });

    it('should detect federal jurisdiction from IRS keywords', () => {
      const result = detectLegalDomain('I received an audit notice from the IRS');
      expect(result.suggestedJurisdiction).toBe('federal');
    });

    it('should handle multiple domain matches and choose highest confidence', () => {
      const result = detectLegalDomain('I need help with divorce, custody, and child support');
      expect(result.domain).toBe('family_law');
      expect(result.matchedKeywords.length).toBeGreaterThan(2);
    });
  });

  describe('Legal Personas', () => {
    it('should have all expected domains defined', () => {
      const expectedDomains: LegalDomain[] = [
        'family_law',
        'fcra_compliance',
        'employment_law',
        'criminal_defense',
        'personal_injury',
        'business_law',
        'real_estate',
        'intellectual_property',
        'immigration',
        'tax_law',
        'general',
      ];

      for (const domain of expectedDomains) {
        expect(LEGAL_PERSONAS[domain]).toBeDefined();
        expect(LEGAL_PERSONAS[domain].id).toBeDefined();
        expect(LEGAL_PERSONAS[domain].name).toBeDefined();
      }
    });

    it('should have key statutes for each persona', () => {
      const persona = LEGAL_PERSONAS.family_law;
      expect(persona.keyStatutes).toBeInstanceOf(Array);
      expect(persona.keyStatutes.length).toBeGreaterThan(0);
      expect(persona.keyStatutes.some((s) => s.includes('81-9'))).toBe(true);
    });

    it('should have clarifying question templates', () => {
      const persona = LEGAL_PERSONAS.fcra_compliance;
      expect(persona.clarifyingQuestionTemplates).toBeInstanceOf(Array);
      expect(persona.clarifyingQuestionTemplates.length).toBeGreaterThan(0);
    });

    it('should have confidence thresholds', () => {
      const persona = LEGAL_PERSONAS.employment_law;
      expect(persona.confidenceThresholds.high).toBeGreaterThan(persona.confidenceThresholds.medium);
      expect(persona.confidenceThresholds.medium).toBeGreaterThan(persona.confidenceThresholds.low);
    });
  });

  describe('Domain Keywords', () => {
    it('should have keywords for each domain', () => {
      for (const domain of Object.keys(LEGAL_PERSONAS) as LegalDomain[]) {
        if (domain !== 'general') {
          expect(DOMAIN_KEYWORDS[domain]).toBeDefined();
          expect(DOMAIN_KEYWORDS[domain].length).toBeGreaterThan(0);
        }
      }
    });

    it('should have unique keywords per domain (mostly)', () => {
      const allKeywords = new Set<string>();
      let duplicateCount = 0;

      for (const keywords of Object.values(DOMAIN_KEYWORDS)) {
        for (const keyword of keywords) {
          if (allKeywords.has(keyword)) {
            duplicateCount++;
          }
          allKeywords.add(keyword);
        }
      }

      // Some overlap is expected, but should be limited
      expect(duplicateCount).toBeLessThan(10);
    });
  });

  describe('Matter Management', () => {
    it('should create a new matter', () => {
      const matter = createMatter('family_law', 'utah', ['James', 'Destiny']);
      expect(matter.matterId).toMatch(/^matter_/);
      expect(matter.domain).toBe('family_law');
      expect(matter.jurisdiction).toBe('utah');
      expect(matter.parties).toContain('James');
    });

    it('should retrieve a matter by ID', () => {
      const created = createMatter('fcra_compliance', 'federal');
      const retrieved = getMatter(created.matterId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.matterId).toBe(created.matterId);
    });

    it('should return null for unknown matter ID', () => {
      const result = getMatter('nonexistent_matter');
      expect(result).toBeNull();
    });

    it('should update a matter', () => {
      const matter = createMatter('employment_law', 'utah');
      const updated = updateMatter(matter.matterId, {
        parties: ['Employee', 'Employer'],
      });
      expect(updated).not.toBeNull();
      expect(updated?.parties).toContain('Employee');
    });

    it('should track key dates in matter', () => {
      const matter = createMatter('criminal_defense', 'utah');
      updateMatter(matter.matterId, {
        keyDates: [{ date: '2025-01-15', description: 'Arraignment' }],
      });
      const retrieved = getMatter(matter.matterId);
      expect(retrieved?.keyDates.length).toBe(1);
    });

    it('should get all matters', () => {
      createMatter('tax_law', 'federal');
      createMatter('business_law', 'utah');
      const allMatters = getAllMatters();
      expect(allMatters.length).toBeGreaterThan(0);
    });
  });

  describe('Persona Transfiguration', () => {
    it('should transfigure to family law persona', async () => {
      const result = await transfigurePersona('Help with my divorce and custody case in Utah');

      expect(result.persona.domain).toBe('family_law');
      expect(result.domainConfidence).toBeGreaterThan(0); // Confidence varies based on keyword matches
      expect(result.enrichedSystemPrompt).toContain('FAMILY LAW PERSONA ACTIVATED');
      expect(result.matterId).toMatch(/^matter_/);
    });

    it('should generate clarifying questions', async () => {
      const result = await transfigurePersona('I have a legal question about my employer');

      expect(result.clarifyingQuestions.length).toBeGreaterThan(0);
      expect(result.clarifyingQuestions[0].question).toBeDefined();
      expect(result.clarifyingQuestions[0].type).toBeDefined();
    });

    it('should suggest research queries', async () => {
      const result = await transfigurePersona('FCRA violation by credit bureau');

      expect(result.suggestedResearch.length).toBeGreaterThan(0);
      expect(result.suggestedResearch[0].domain).toBe('fcra_compliance');
    });

    it('should allow forcing domain', async () => {
      const result = await transfigurePersona('General question', 'immigration');

      expect(result.persona.domain).toBe('immigration');
    });

    it('should allow forcing jurisdiction', async () => {
      const result = await transfigurePersona('Family law question', undefined, 'california');

      expect(result.enrichedSystemPrompt).toContain('CALIFORNIA');
    });

    it('should include matter ID in enriched prompt', async () => {
      const result = await transfigurePersona('Legal help needed');

      expect(result.enrichedSystemPrompt).toContain(result.matterId);
    });
  });
});
