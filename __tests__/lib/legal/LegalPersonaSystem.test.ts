// @ts-nocheck
/**
 * Wrath Shield v3 - Legal Persona System Tests
 *
 * Tests for the legal persona transfiguration system:
 * - Domain detection from keywords
 * - Jurisdiction detection
 * - Matter management (create, get, update)
 * - Persona transfiguration
 * - Research functionality
 * - LEGAL_PERSONAS constant
 * - DOMAIN_KEYWORDS constant
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

import {
  detectLegalDomain,
  createMatter,
  getMatter,
  updateMatter,
  getAllMatters,
  transfigurePersona,
  researchLegalTopic,
  LEGAL_PERSONAS,
  DOMAIN_KEYWORDS,
  type LegalDomain,
  type Jurisdiction,
  type LegalPersona,
  type DomainDetectionResult,
  type MatterContext,
  type ResearchRequest,
  type ResearchResult,
  type ClarifyingQuestion,
  type PersonaTransfigurationResult,
} from '@/lib/legal/LegalPersonaSystem';

describe('Legal Persona System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Types', () => {
    it('should define LegalDomain type with all domain options', () => {
      const domains: LegalDomain[] = [
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

      expect(domains).toHaveLength(11);
    });

    it('should define Jurisdiction type with all jurisdiction options', () => {
      const jurisdictions: Jurisdiction[] = [
        'utah',
        'federal',
        'california',
        'new_york',
        'texas',
        'michigan',
        'general',
      ];

      expect(jurisdictions).toHaveLength(7);
    });

    it('should define LegalPersona interface', () => {
      const persona: LegalPersona = {
        id: 'persona.test',
        name: 'Test Attorney',
        domain: 'general',
        jurisdictions: ['general'],
        expertiseDescription: 'Test expertise',
        keyStatutes: ['Test statute'],
        researchSources: ['Test source'],
        systemPromptAddendum: 'Test prompt',
        clarifyingQuestionTemplates: ['What is your question?'],
        confidenceThresholds: {
          high: 0.9,
          medium: 0.6,
          low: 0.3,
        },
      };

      expect(persona.id).toBe('persona.test');
      expect(persona.confidenceThresholds.high).toBe(0.9);
    });

    it('should define DomainDetectionResult interface', () => {
      const result: DomainDetectionResult = {
        domain: 'family_law',
        confidence: 0.85,
        suggestedJurisdiction: 'utah',
        matchedKeywords: ['divorce', 'custody'],
        reasoning: 'Detected family law based on keywords',
      };

      expect(result.confidence).toBe(0.85);
      expect(result.matchedKeywords).toContain('divorce');
    });

    it('should define MatterContext interface', () => {
      const matter: MatterContext = {
        matterId: 'matter_123',
        domain: 'employment_law',
        jurisdiction: 'federal',
        parties: ['John Doe', 'ACME Corp'],
        keyDates: [{ date: '2025-01-15', description: 'Filing deadline' }],
        documents: [{ name: 'complaint.pdf', type: 'filing', uploadedAt: '2025-01-01' }],
        createdAt: '2025-01-01T00:00:00Z',
        lastActivity: '2025-01-10T00:00:00Z',
      };

      expect(matter.matterId).toBe('matter_123');
      expect(matter.parties).toHaveLength(2);
    });

    it('should define ResearchRequest interface', () => {
      const request: ResearchRequest = {
        query: 'custody modification standards',
        domain: 'family_law',
        jurisdiction: 'utah',
        sources: ['Utah Courts'],
        recencyDays: 90,
      };

      expect(request.query).toBe('custody modification standards');
      expect(request.recencyDays).toBe(90);
    });

    it('should define ResearchResult interface', () => {
      const result: ResearchResult = {
        source: 'Utah Courts',
        title: 'Case Law Summary',
        snippet: 'Relevant case details...',
        url: 'https://courts.utah.gov/case/123',
        date: '2025-01-10',
        relevanceScore: 0.92,
      };

      expect(result.relevanceScore).toBe(0.92);
    });

    it('should define ClarifyingQuestion interface', () => {
      const question: ClarifyingQuestion = {
        id: 'q_0',
        question: 'What is your current custody arrangement?',
        type: 'text',
        options: undefined,
        required: true,
        priority: 'high',
      };

      expect(question.type).toBe('text');
      expect(question.required).toBe(true);
    });

    it('should define PersonaTransfigurationResult interface', () => {
      const result: PersonaTransfigurationResult = {
        persona: LEGAL_PERSONAS.general,
        domainConfidence: 0.75,
        enrichedSystemPrompt: 'You are a legal assistant...',
        clarifyingQuestions: [],
        suggestedResearch: [],
        matterId: 'matter_123',
      };

      expect(result.domainConfidence).toBe(0.75);
    });
  });

  describe('LEGAL_PERSONAS constant', () => {
    it('should have all expected domain personas', () => {
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
        expect(LEGAL_PERSONAS[domain].domain).toBe(domain);
      }
    });

    it('should have valid structure for each persona', () => {
      for (const [domain, persona] of Object.entries(LEGAL_PERSONAS)) {
        expect(persona.id).toMatch(/^persona\./);
        expect(persona.name).toBeTruthy();
        expect(persona.jurisdictions.length).toBeGreaterThan(0);
        expect(persona.expertiseDescription).toBeTruthy();
        expect(Array.isArray(persona.keyStatutes)).toBe(true);
        expect(Array.isArray(persona.researchSources)).toBe(true);
        expect(persona.systemPromptAddendum).toBeTruthy();
        expect(Array.isArray(persona.clarifyingQuestionTemplates)).toBe(true);
        expect(persona.confidenceThresholds.high).toBeGreaterThan(persona.confidenceThresholds.medium);
        expect(persona.confidenceThresholds.medium).toBeGreaterThan(persona.confidenceThresholds.low);
      }
    });

    it('should have family law persona with Utah statutes', () => {
      const familyLaw = LEGAL_PERSONAS.family_law;
      expect(familyLaw.name).toBe('Family Law Attorney');
      expect(familyLaw.jurisdictions).toContain('utah');
      expect(familyLaw.keyStatutes.some(s => s.includes('Utah Code'))).toBe(true);
    });

    it('should have FCRA persona with federal focus', () => {
      const fcra = LEGAL_PERSONAS.fcra_compliance;
      expect(fcra.name).toBe('FCRA Compliance Attorney');
      expect(fcra.jurisdictions).toContain('federal');
      expect(fcra.keyStatutes.some(s => s.includes('15 U.S.C.'))).toBe(true);
    });

    it('should have employment law persona', () => {
      const employment = LEGAL_PERSONAS.employment_law;
      expect(employment.name).toBe('Employment Law Attorney');
      expect(employment.keyStatutes.some(s => s.includes('Title VII'))).toBe(true);
    });

    it('should have criminal defense persona', () => {
      const criminal = LEGAL_PERSONAS.criminal_defense;
      expect(criminal.name).toBe('Criminal Defense Attorney');
      expect(criminal.systemPromptAddendum).toContain('CRIMINAL DEFENSE PERSONA');
    });

    it('should have general persona as fallback', () => {
      const general = LEGAL_PERSONAS.general;
      expect(general.name).toBe('General Practice Attorney');
      expect(general.jurisdictions).toContain('general');
      expect(general.confidenceThresholds.high).toBeLessThan(0.85);
    });
  });

  describe('DOMAIN_KEYWORDS constant', () => {
    it('should have keywords for all domains', () => {
      const domains: LegalDomain[] = [
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

      for (const domain of domains) {
        expect(DOMAIN_KEYWORDS[domain]).toBeDefined();
        expect(Array.isArray(DOMAIN_KEYWORDS[domain])).toBe(true);
      }
    });

    it('should have family law keywords', () => {
      const keywords = DOMAIN_KEYWORDS.family_law;
      expect(keywords).toContain('divorce');
      expect(keywords).toContain('custody');
      expect(keywords).toContain('child support');
    });

    it('should have FCRA keywords', () => {
      const keywords = DOMAIN_KEYWORDS.fcra_compliance;
      expect(keywords).toContain('fcra');
      expect(keywords).toContain('credit report');
      expect(keywords).toContain('background check');
    });

    it('should have employment keywords', () => {
      const keywords = DOMAIN_KEYWORDS.employment_law;
      expect(keywords).toContain('employer');
      expect(keywords).toContain('fired');
      expect(keywords).toContain('harassment');
    });

    it('should have criminal defense keywords', () => {
      const keywords = DOMAIN_KEYWORDS.criminal_defense;
      expect(keywords).toContain('criminal');
      expect(keywords).toContain('arrested');
      expect(keywords).toContain('felony');
    });

    it('should have empty general keywords', () => {
      const keywords = DOMAIN_KEYWORDS.general;
      expect(keywords).toHaveLength(0);
    });
  });

  describe('detectLegalDomain', () => {
    it('should detect family law domain', () => {
      const result = detectLegalDomain('I am going through a divorce and need help with custody');

      expect(result.domain).toBe('family_law');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchedKeywords).toContain('divorce');
      expect(result.matchedKeywords).toContain('custody');
    });

    it('should detect FCRA compliance domain', () => {
      const result = detectLegalDomain('My credit report has inaccurate information from a background check');

      expect(result.domain).toBe('fcra_compliance');
      expect(result.matchedKeywords.some(k => ['credit report', 'background check', 'inaccurate'].includes(k))).toBe(true);
    });

    it('should detect employment law domain', () => {
      const result = detectLegalDomain('I was wrongfully terminated after reporting harassment');

      expect(result.domain).toBe('employment_law');
      expect(result.matchedKeywords.some(k => ['terminated', 'harassment'].includes(k))).toBe(true);
    });

    it('should detect criminal defense domain', () => {
      const result = detectLegalDomain('I was arrested for a DUI and facing felony charges');

      expect(result.domain).toBe('criminal_defense');
      expect(result.matchedKeywords.some(k => ['arrested', 'dui', 'felony'].includes(k))).toBe(true);
    });

    it('should detect personal injury domain', () => {
      const result = detectLegalDomain('I was in a car accident and have medical bills from my injury');

      expect(result.domain).toBe('personal_injury');
      expect(result.matchedKeywords.some(k => ['accident', 'injury', 'medical bills'].includes(k))).toBe(true);
    });

    it('should detect business law domain', () => {
      const result = detectLegalDomain('I need help forming an LLC and reviewing a contract');

      expect(result.domain).toBe('business_law');
      expect(result.matchedKeywords.some(k => ['llc', 'contract'].includes(k))).toBe(true);
    });

    it('should detect real estate domain', () => {
      const result = detectLegalDomain('My landlord is trying to evict me from my property');

      expect(result.domain).toBe('real_estate');
      expect(result.matchedKeywords.some(k => ['landlord', 'eviction', 'property'].includes(k))).toBe(true);
    });

    it('should detect intellectual property domain', () => {
      const result = detectLegalDomain('I need to file a patent for my invention and protect my trademark');

      expect(result.domain).toBe('intellectual_property');
      expect(result.matchedKeywords.some(k => ['patent', 'invention', 'trademark'].includes(k))).toBe(true);
    });

    it('should detect immigration domain', () => {
      const result = detectLegalDomain('I need help with my visa application for a green card');

      expect(result.domain).toBe('immigration');
      expect(result.matchedKeywords.some(k => ['visa', 'green card'].includes(k))).toBe(true);
    });

    it('should detect tax law domain', () => {
      const result = detectLegalDomain('The IRS is auditing my tax return and I owe back taxes');

      expect(result.domain).toBe('tax_law');
      expect(result.matchedKeywords.some(k => ['irs', 'audit', 'tax return', 'back taxes'].includes(k))).toBe(true);
    });

    it('should return general for unrecognized text', () => {
      const result = detectLegalDomain('Hello, I have a question about something');

      expect(result.domain).toBe('general');
      expect(result.confidence).toBe(0.3);
      expect(result.matchedKeywords).toHaveLength(0);
      expect(result.reasoning).toContain('No specific legal domain');
    });

    it('should detect Utah jurisdiction', () => {
      const result = detectLegalDomain('I am going through a divorce in Salt Lake City, Utah');

      expect(result.suggestedJurisdiction).toBe('utah');
    });

    it('should detect federal jurisdiction', () => {
      const result = detectLegalDomain('I need to file a complaint with the EEOC about discrimination');

      expect(result.suggestedJurisdiction).toBe('federal');
    });

    it('should detect California jurisdiction', () => {
      const result = detectLegalDomain('I live in Los Angeles, California and need employment help');

      expect(result.suggestedJurisdiction).toBe('california');
    });

    it('should default to general jurisdiction', () => {
      const result = detectLegalDomain('I have a legal question');

      expect(result.suggestedJurisdiction).toBe('general');
    });

    it('should provide reasoning in the result', () => {
      const result = detectLegalDomain('I need help with custody of my child');

      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning).toContain('family_law');
    });
  });

  describe('Matter Management', () => {
    describe('createMatter', () => {
      it('should create a new matter with unique ID', () => {
        const matter = createMatter('family_law', 'utah');

        expect(matter.matterId).toMatch(/^matter_\d+_[a-z0-9]+$/);
        expect(matter.domain).toBe('family_law');
        expect(matter.jurisdiction).toBe('utah');
        expect(matter.parties).toHaveLength(0);
        expect(matter.keyDates).toHaveLength(0);
        expect(matter.documents).toHaveLength(0);
      });

      it('should create matter with parties', () => {
        const matter = createMatter('employment_law', 'federal', ['John Doe', 'ACME Corp']);

        expect(matter.parties).toHaveLength(2);
        expect(matter.parties).toContain('John Doe');
        expect(matter.parties).toContain('ACME Corp');
      });

      it('should set timestamps on creation', () => {
        const matter = createMatter('business_law', 'general');

        expect(matter.createdAt).toBeTruthy();
        expect(matter.lastActivity).toBeTruthy();
        expect(matter.createdAt).toBe(matter.lastActivity);
      });
    });

    describe('getMatter', () => {
      it('should retrieve existing matter by ID', () => {
        const created = createMatter('criminal_defense', 'utah');
        const retrieved = getMatter(created.matterId);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.matterId).toBe(created.matterId);
        expect(retrieved?.domain).toBe('criminal_defense');
      });

      it('should return null for non-existent matter', () => {
        const retrieved = getMatter('non_existent_matter_id');

        expect(retrieved).toBeNull();
      });
    });

    describe('updateMatter', () => {
      it('should update matter fields', () => {
        const created = createMatter('real_estate', 'utah');
        const updated = updateMatter(created.matterId, {
          parties: ['Seller', 'Buyer'],
        });

        expect(updated).not.toBeNull();
        expect(updated?.parties).toHaveLength(2);
        expect(updated?.parties).toContain('Seller');
      });

      it('should update lastActivity timestamp', () => {
        const created = createMatter('tax_law', 'federal');
        const originalActivity = created.lastActivity;

        // Small delay to ensure timestamp difference
        const updated = updateMatter(created.matterId, {
          keyDates: [{ date: '2025-04-15', description: 'Tax deadline' }],
        });

        expect(updated?.lastActivity).not.toBe(originalActivity);
      });

      it('should return null for non-existent matter', () => {
        const updated = updateMatter('non_existent_id', { parties: ['Test'] });

        expect(updated).toBeNull();
      });

      it('should preserve existing fields', () => {
        const created = createMatter('immigration', 'federal', ['Applicant']);
        const updated = updateMatter(created.matterId, {
          keyDates: [{ date: '2025-06-01', description: 'Visa interview' }],
        });

        expect(updated?.parties).toHaveLength(1);
        expect(updated?.parties).toContain('Applicant');
      });
    });

    describe('getAllMatters', () => {
      it('should return all created matters', () => {
        // Create some matters
        createMatter('family_law', 'utah');
        createMatter('employment_law', 'federal');

        const allMatters = getAllMatters();

        expect(allMatters.length).toBeGreaterThanOrEqual(2);
      });

      it('should return array of MatterContext objects', () => {
        const allMatters = getAllMatters();

        for (const matter of allMatters) {
          expect(matter.matterId).toBeTruthy();
          expect(matter.domain).toBeTruthy();
          expect(matter.jurisdiction).toBeTruthy();
        }
      });
    });
  });

  describe('transfigurePersona', () => {
    it('should return persona based on detected domain', async () => {
      const result = await transfigurePersona('I need help with my divorce and custody');

      expect(result.persona.domain).toBe('family_law');
      expect(result.domainConfidence).toBeGreaterThan(0);
    });

    it('should include enriched system prompt', async () => {
      const result = await transfigurePersona('I was arrested for a DUI');

      expect(result.enrichedSystemPrompt).toContain('CRIMINAL DEFENSE');
      expect(result.enrichedSystemPrompt).toContain(result.matterId);
    });

    it('should generate clarifying questions', async () => {
      const result = await transfigurePersona('I have an employment issue');

      expect(result.clarifyingQuestions.length).toBeGreaterThan(0);
      expect(result.clarifyingQuestions[0]).toHaveProperty('id');
      expect(result.clarifyingQuestions[0]).toHaveProperty('question');
      expect(result.clarifyingQuestions[0]).toHaveProperty('type');
      expect(result.clarifyingQuestions[0]).toHaveProperty('required');
      expect(result.clarifyingQuestions[0]).toHaveProperty('priority');
    });

    it('should mark first two questions as required', async () => {
      const result = await transfigurePersona('I need help with my credit report');

      const requiredQuestions = result.clarifyingQuestions.filter(q => q.required);
      expect(requiredQuestions.length).toBeGreaterThanOrEqual(2);
    });

    it('should generate suggested research requests', async () => {
      const result = await transfigurePersona('I have a tax problem with the IRS');

      expect(result.suggestedResearch.length).toBeGreaterThan(0);
      expect(result.suggestedResearch[0]).toHaveProperty('query');
      expect(result.suggestedResearch[0]).toHaveProperty('domain');
      expect(result.suggestedResearch[0]).toHaveProperty('jurisdiction');
    });

    it('should create a matter ID', async () => {
      const result = await transfigurePersona('I need to form an LLC');

      expect(result.matterId).toMatch(/^matter_\d+_[a-z0-9]+$/);
    });

    it('should use forced domain when provided', async () => {
      const result = await transfigurePersona('Hello', 'immigration');

      expect(result.persona.domain).toBe('immigration');
    });

    it('should use forced jurisdiction when provided', async () => {
      const result = await transfigurePersona('I need legal help', undefined, 'california');

      expect(result.enrichedSystemPrompt).toContain('CALIFORNIA');
    });

    it('should not add jurisdiction section for general jurisdiction', async () => {
      const result = await transfigurePersona('General legal question', 'general', 'general');

      expect(result.enrichedSystemPrompt).not.toContain('Jurisdiction Focus:');
    });

    it('should return general persona for unrecognized input', async () => {
      const result = await transfigurePersona('xyz abc 123');

      expect(result.persona.domain).toBe('general');
    });
  });

  describe('researchLegalTopic', () => {
    it('should accept research request and return results', async () => {
      const request: ResearchRequest = {
        query: 'custody modification standards in Utah',
        domain: 'family_law',
        jurisdiction: 'utah',
      };

      const results = await researchLegalTopic(request);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return results with required fields', async () => {
      const request: ResearchRequest = {
        query: 'FCRA accuracy requirements',
        domain: 'fcra_compliance',
        jurisdiction: 'federal',
      };

      const results = await researchLegalTopic(request);

      expect(results[0]).toHaveProperty('source');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('snippet');
      expect(results[0]).toHaveProperty('relevanceScore');
    });

    it('should log research request', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const request: ResearchRequest = {
        query: 'employment discrimination case law',
        domain: 'employment_law',
        jurisdiction: 'federal',
        recencyDays: 30,
      };

      await researchLegalTopic(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LegalPersona] Research requested:')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Persona System Prompts', () => {
    it('should include expertise areas in family law prompt', () => {
      const persona = LEGAL_PERSONAS.family_law;
      expect(persona.systemPromptAddendum).toContain('Custody');
      expect(persona.systemPromptAddendum).toContain('Child support');
      expect(persona.systemPromptAddendum).toContain('Alimony');
    });

    it('should include compliance red flags in FCRA prompt', () => {
      const persona = LEGAL_PERSONAS.fcra_compliance;
      expect(persona.systemPromptAddendum).toContain('Compliance Red Flags');
      expect(persona.systemPromptAddendum).toContain('7-year lookback');
    });

    it('should include administrative deadlines in employment prompt', () => {
      const persona = LEGAL_PERSONAS.employment_law;
      expect(persona.systemPromptAddendum).toContain('300-day');
      expect(persona.systemPromptAddendum).toContain('EEOC');
    });

    it('should include Miranda warning note in criminal prompt', () => {
      const persona = LEGAL_PERSONAS.criminal_defense;
      expect(persona.systemPromptAddendum).toContain('NEVER discuss admission');
    });

    it('should include statute of limitations in personal injury prompt', () => {
      const persona = LEGAL_PERSONAS.personal_injury;
      expect(persona.systemPromptAddendum).toContain('statute of limitations');
      expect(persona.systemPromptAddendum).toContain('4-year');
    });
  });

  describe('Confidence Thresholds', () => {
    it('should have appropriate thresholds for specialized domains', () => {
      // FCRA and Immigration should have higher thresholds due to complexity
      expect(LEGAL_PERSONAS.fcra_compliance.confidenceThresholds.high).toBeGreaterThanOrEqual(0.9);
      expect(LEGAL_PERSONAS.immigration.confidenceThresholds.high).toBeGreaterThanOrEqual(0.9);
    });

    it('should have lower thresholds for general domain', () => {
      const general = LEGAL_PERSONAS.general;
      expect(general.confidenceThresholds.high).toBeLessThan(0.8);
    });

    it('should have valid threshold hierarchy', () => {
      for (const [domain, persona] of Object.entries(LEGAL_PERSONAS)) {
        const { high, medium, low } = persona.confidenceThresholds;
        expect(high).toBeGreaterThan(medium);
        expect(medium).toBeGreaterThan(low);
        expect(low).toBeGreaterThanOrEqual(0);
        expect(high).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input text', () => {
      const result = detectLegalDomain('');

      expect(result.domain).toBe('general');
      expect(result.confidence).toBe(0.3);
    });

    it('should handle case-insensitive keyword matching', () => {
      const result = detectLegalDomain('DIVORCE CUSTODY ALIMONY');

      expect(result.domain).toBe('family_law');
    });

    it('should handle mixed domain keywords by selecting highest score', () => {
      // Text with both family and employment keywords - family should win with more matches
      const result = detectLegalDomain('divorce custody child support alimony visitation guardian');

      expect(result.domain).toBe('family_law');
    });

    it('should handle special characters in input', () => {
      const result = detectLegalDomain('I need help with my divorce... custody??? @attorney #legal');

      expect(result.domain).toBe('family_law');
    });
  });
});
