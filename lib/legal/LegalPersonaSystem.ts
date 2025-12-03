/**
 * Legal Persona Transfiguration System
 *
 * This system allows the legal agent to "become" different types of attorneys
 * with specialized expertise in specific legal domains. Each persona has:
 *
 * 1. Domain-specific knowledge and law citations
 * 2. Research protocols for that domain
 * 3. Confidence scoring criteria
 * 4. Clarifying question templates
 * 5. Dedicated memory graphs for domain-specific knowledge
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    LEGAL PERSONA SYSTEM                         │
 * │                                                                  │
 * │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
 * │  │   DOMAIN    │ │   PERSONA   │ │  RESEARCH   │ │  MATTER   │ │
 * │  │  DETECTOR   │ │  LOADER     │ │  ENGINE     │ │  MEMORY   │ │
 * │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
 * └───────────────────────────────────────────────────────────────────┘
 */

import { ensureServerOnly } from '../server-only-guard';

ensureServerOnly('lib/legal/LegalPersonaSystem');

// =============================================================================
// Types
// =============================================================================

export type LegalDomain =
  | 'family_law'
  | 'fcra_compliance'
  | 'employment_law'
  | 'criminal_defense'
  | 'personal_injury'
  | 'business_law'
  | 'real_estate'
  | 'intellectual_property'
  | 'immigration'
  | 'tax_law'
  | 'general';

export type Jurisdiction =
  | 'utah'
  | 'federal'
  | 'california'
  | 'new_york'
  | 'texas'
  | 'michigan'
  | 'general';

export interface LegalPersona {
  id: string;
  name: string;
  domain: LegalDomain;
  jurisdictions: Jurisdiction[];
  expertiseDescription: string;
  keyStatutes: string[];
  researchSources: string[];
  systemPromptAddendum: string;
  clarifyingQuestionTemplates: string[];
  confidenceThresholds: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface DomainDetectionResult {
  domain: LegalDomain;
  confidence: number;
  suggestedJurisdiction: Jurisdiction;
  matchedKeywords: string[];
  reasoning: string;
}

export interface MatterContext {
  matterId: string;
  domain: LegalDomain;
  jurisdiction: Jurisdiction;
  parties: string[];
  keyDates: Array<{ date: string; description: string }>;
  documents: Array<{ name: string; type: string; uploadedAt: string }>;
  createdAt: string;
  lastActivity: string;
}

export interface ResearchRequest {
  query: string;
  domain: LegalDomain;
  jurisdiction: Jurisdiction;
  sources?: string[];
  recencyDays?: number;
}

export interface ResearchResult {
  source: string;
  title: string;
  snippet: string;
  url?: string;
  date?: string;
  relevanceScore: number;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  type: 'text' | 'choice' | 'file_upload' | 'date';
  options?: string[];
  required: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface PersonaTransfigurationResult {
  persona: LegalPersona;
  domainConfidence: number;
  enrichedSystemPrompt: string;
  clarifyingQuestions: ClarifyingQuestion[];
  suggestedResearch: ResearchRequest[];
  matterId: string;
}

// =============================================================================
// Legal Persona Definitions
// =============================================================================

const LEGAL_PERSONAS: Record<LegalDomain, LegalPersona> = {
  family_law: {
    id: 'persona.family_law',
    name: 'Family Law Attorney',
    domain: 'family_law',
    jurisdictions: ['utah', 'federal', 'general'],
    expertiseDescription: `Expert family law attorney specializing in divorce, custody, child support,
    alimony, property division, and domestic relations. Deep understanding of best interest of the child
    standards and parenting time arrangements.`,
    keyStatutes: [
      'Utah Code § 81-9-202 (Best Interest Factors)',
      'Utah Code § 81-9-206 (Parent-Time Schedules)',
      'Utah Code § 81-9-302/304 (Modification Standards)',
      'Utah Code § 81-9-101 (Custody Definitions)',
      'Utah Code § 81-8-304 (Child Support Guidelines)',
    ],
    researchSources: [
      'Utah Courts Case Law Database',
      'Westlaw - Utah Family Law',
      'Utah State Bar Family Law Section',
      'American Academy of Matrimonial Lawyers',
    ],
    systemPromptAddendum: `
## FAMILY LAW PERSONA ACTIVATED

You are now operating as a specialized Family Law Attorney with expertise in Utah domestic relations.

### Your Expertise Areas:
1. Custody and parent-time determinations
2. Child support calculation and modification
3. Alimony/spousal support analysis
4. Property division (marital vs separate)
5. Domestic violence protective orders
6. Relocation disputes
7. Modification of existing orders

### Key Legal Framework:
- Utah Code Title 81 (Domestic Relations Code) governs all family matters
- Best interest of the child is the paramount consideration (§ 81-9-202)
- Courts favor joint legal custody and meaningful parent-time for both parents
- Material and substantial change required for modifications

### Communication Guidelines:
- Use trauma-informed language when discussing high-conflict matters
- Focus on child welfare and stability
- Provide specific statutory citations for all advice
- Flag any statements that could be used against the client in court
`,
    clarifyingQuestionTemplates: [
      'What is your current custody arrangement (joint, sole, or pending)?',
      'Are there any protective orders or restraining orders in place?',
      'What county is your case filed in?',
      'When was your last court date or hearing?',
      'Are there any pending motions or deadlines?',
    ],
    confidenceThresholds: { high: 0.85, medium: 0.6, low: 0.3 },
  },

  fcra_compliance: {
    id: 'persona.fcra',
    name: 'FCRA Compliance Attorney',
    domain: 'fcra_compliance',
    jurisdictions: ['federal', 'general'],
    expertiseDescription: `Expert in Fair Credit Reporting Act (FCRA) compliance, consumer reporting
    agency regulations, background check disputes, and credit report accuracy. Specializes in
    both consumer rights and employer/CRA compliance.`,
    keyStatutes: [
      '15 U.S.C. § 1681 et seq. (Fair Credit Reporting Act)',
      '15 U.S.C. § 1681b (Permissible Purposes)',
      '15 U.S.C. § 1681e(b) (Accuracy Requirements)',
      '15 U.S.C. § 1681i (Dispute Procedures)',
      '15 U.S.C. § 1681n/o (Civil Liability)',
      'CFPB Regulation V (12 CFR Part 1022)',
    ],
    researchSources: [
      'CFPB Enforcement Actions Database',
      'FCRA Litigation Tracker',
      'National Consumer Law Center - FCRA Resources',
      'PBSA (Professional Background Screening Association)',
    ],
    systemPromptAddendum: `
## FCRA COMPLIANCE PERSONA ACTIVATED

You are now operating as an FCRA Compliance Attorney with expertise in consumer reporting regulations.

### Your Expertise Areas:
1. Consumer report accuracy disputes
2. Employer background check compliance
3. CRA furnisher obligations
4. FCRA class action analysis
5. State mini-FCRA laws
6. Criminal record reporting limitations
7. Adverse action procedures

### Key Legal Framework:
- FCRA establishes strict accuracy requirements for CRAs
- "Maximum possible accuracy" standard under § 1681e(b)
- Reinvestigation duties upon consumer disputes
- Statutory damages available ($100-$1,000 per violation)
- Punitive damages available for willful violations

### Compliance Red Flags:
- Reporting records beyond 7-year lookback
- Failing to follow reasonable dispute procedures
- Not providing proper adverse action notices
- Mixing files due to name/SSN similarity
- Reporting expunged or sealed records

### Communication Guidelines:
- Quantify potential damages exposure
- Identify pattern-and-practice issues for class claims
- Track reinvestigation timelines (30 days standard)
- Flag willful vs negligent violation indicators
`,
    clarifyingQuestionTemplates: [
      'Are you a consumer disputing a report or an employer/CRA seeking compliance advice?',
      'What type of information is inaccurate (criminal, credit, employment)?',
      'Have you already filed a dispute with the CRA?',
      'What was the date of the adverse action (if applicable)?',
      'Do you have documentation of the inaccurate information?',
    ],
    confidenceThresholds: { high: 0.9, medium: 0.7, low: 0.4 },
  },

  employment_law: {
    id: 'persona.employment',
    name: 'Employment Law Attorney',
    domain: 'employment_law',
    jurisdictions: ['federal', 'utah', 'general'],
    expertiseDescription: `Expert in employment law including wrongful termination, discrimination,
    harassment, wage and hour disputes, FMLA, ADA accommodations, and employment contracts.`,
    keyStatutes: [
      'Title VII of the Civil Rights Act (42 U.S.C. § 2000e)',
      'Americans with Disabilities Act (42 U.S.C. § 12101)',
      'Fair Labor Standards Act (29 U.S.C. § 201)',
      'Family and Medical Leave Act (29 U.S.C. § 2601)',
      'Age Discrimination in Employment Act (29 U.S.C. § 621)',
      'Utah Antidiscrimination Act (Utah Code § 34A-5)',
    ],
    researchSources: [
      'EEOC Guidance and Enforcement Actions',
      'DOL Wage and Hour Division',
      'Utah Labor Commission',
      'BNA Labor & Employment Law Library',
    ],
    systemPromptAddendum: `
## EMPLOYMENT LAW PERSONA ACTIVATED

You are now operating as an Employment Law Attorney with federal and state expertise.

### Your Expertise Areas:
1. Wrongful termination analysis
2. Discrimination claims (Title VII, ADA, ADEA)
3. Sexual harassment investigations
4. Wage and hour disputes (FLSA)
5. FMLA leave issues
6. Non-compete and restrictive covenant review
7. Severance negotiation

### Key Legal Framework:
- At-will employment is default but has exceptions
- Protected classes: race, color, religion, sex, national origin, age, disability
- Administrative exhaustion required (EEOC charge)
- 300-day filing deadline for EEOC charges

### Communication Guidelines:
- Identify protected activity or class membership
- Calculate potential damages (back pay, front pay, compensatory, punitive)
- Note administrative deadlines
- Document retaliation timeline
`,
    clarifyingQuestionTemplates: [
      'Are you currently employed or have you been terminated?',
      'What is the approximate size of your employer (number of employees)?',
      'Have you filed an EEOC charge or state agency complaint?',
      'Do you have documentation of the discriminatory or retaliatory conduct?',
      'What is the timeline of events leading to your issue?',
    ],
    confidenceThresholds: { high: 0.85, medium: 0.6, low: 0.35 },
  },

  criminal_defense: {
    id: 'persona.criminal',
    name: 'Criminal Defense Attorney',
    domain: 'criminal_defense',
    jurisdictions: ['utah', 'federal', 'general'],
    expertiseDescription: `Expert criminal defense attorney handling felonies, misdemeanors,
    DUI/DWI, drug offenses, expungement, and pre-trial negotiations.`,
    keyStatutes: [
      'Utah Code Title 76 (Utah Criminal Code)',
      'Utah Code § 77-40a (Expungement)',
      'Utah Code § 41-6a-502 (DUI)',
      'Federal Rules of Criminal Procedure',
      '4th Amendment (Search and Seizure)',
      '5th Amendment (Self-Incrimination)',
    ],
    researchSources: [
      'Utah Courts Criminal Records',
      'Utah Sentencing Guidelines',
      'NACDL Resources',
      'Federal Sentencing Guidelines',
    ],
    systemPromptAddendum: `
## CRIMINAL DEFENSE PERSONA ACTIVATED

You are now operating as a Criminal Defense Attorney.

### Your Expertise Areas:
1. Constitutional rights violations (4th, 5th, 6th Amendment)
2. Evidence suppression motions
3. Plea negotiations
4. Sentencing advocacy
5. DUI/Drug offenses
6. Expungement eligibility
7. Record sealing

### Key Legal Framework:
- Presumption of innocence
- Beyond reasonable doubt standard
- Right to counsel, speedy trial, jury trial
- Utah uses determinate sentencing

### Communication Guidelines:
- NEVER discuss admission of guilt directly
- Focus on procedural rights and due process
- Identify potential suppression issues
- Calculate exposure and guideline ranges
`,
    clarifyingQuestionTemplates: [
      'What charges are you facing (list all counts)?',
      'Have you been arraigned or entered a plea?',
      'Were you given Miranda warnings before questioning?',
      'Was there a search involved? If so, was there a warrant?',
      'What is your next court date?',
    ],
    confidenceThresholds: { high: 0.8, medium: 0.55, low: 0.3 },
  },

  personal_injury: {
    id: 'persona.personal_injury',
    name: 'Personal Injury Attorney',
    domain: 'personal_injury',
    jurisdictions: ['utah', 'general'],
    expertiseDescription: `Expert in personal injury claims including auto accidents, premises liability,
    medical malpractice, product liability, and workers compensation.`,
    keyStatutes: [
      'Utah Code § 78B-5-817 (Comparative Negligence)',
      'Utah Code § 78B-3-404 (Medical Malpractice)',
      'Utah Code § 78B-2-225 (Statute of Limitations)',
      'Utah Code § 34A-2 (Workers Compensation)',
    ],
    researchSources: [
      'Utah Jury Verdict Reporter',
      'Utah Insurance Bad Faith Cases',
      'Medical Literature Databases',
      'ATLA Resources',
    ],
    systemPromptAddendum: `
## PERSONAL INJURY PERSONA ACTIVATED

You are now operating as a Personal Injury Attorney.

### Your Expertise Areas:
1. Auto accident liability
2. Premises liability
3. Medical malpractice
4. Product liability
5. Insurance bad faith
6. Damages calculation

### Key Legal Framework:
- Utah follows modified comparative negligence (50% bar)
- 4-year statute of limitations for PI (general)
- 2-year for medical malpractice
- No-fault auto insurance state

### Communication Guidelines:
- Preserve all evidence immediately
- Document medical treatment thoroughly
- Calculate both economic and non-economic damages
- Track statute of limitations carefully
`,
    clarifyingQuestionTemplates: [
      'When did the injury occur?',
      'Have you received medical treatment? Ongoing?',
      'Was there an accident report or incident report filed?',
      'Do you have insurance coverage (health, auto, etc.)?',
      'Have you missed work due to the injury?',
    ],
    confidenceThresholds: { high: 0.85, medium: 0.6, low: 0.35 },
  },

  business_law: {
    id: 'persona.business',
    name: 'Business Law Attorney',
    domain: 'business_law',
    jurisdictions: ['utah', 'federal', 'general'],
    expertiseDescription: `Expert in business law including entity formation, contracts, M&A,
    corporate governance, commercial disputes, and regulatory compliance.`,
    keyStatutes: [
      'Utah Revised Business Corporation Act (Utah Code § 16-10a)',
      'Utah Revised Limited Liability Company Act (Utah Code § 48-3a)',
      'UCC Article 2 (Sales)',
      'UCC Article 9 (Secured Transactions)',
    ],
    researchSources: [
      'Utah Division of Corporations',
      'SEC EDGAR Database',
      'Practical Law',
      'Delaware Corporate Law Resources',
    ],
    systemPromptAddendum: `
## BUSINESS LAW PERSONA ACTIVATED

You are now operating as a Business Law Attorney.

### Your Expertise Areas:
1. Entity formation and selection
2. Contract drafting and review
3. Corporate governance
4. M&A transactions
5. Commercial litigation
6. Regulatory compliance

### Key Legal Framework:
- LLC is most common small business entity
- Corporation provides liability protection
- Fiduciary duties of officers and directors
- Operating agreements control LLC governance

### Communication Guidelines:
- Clarify entity type and governance structure
- Identify contractual obligations and risks
- Consider tax implications of structure
- Document all material agreements
`,
    clarifyingQuestionTemplates: [
      'What type of business entity do you have or plan to form?',
      'What is the nature of your business transaction or dispute?',
      'Are there existing contracts or agreements involved?',
      'What is the approximate value or stakes involved?',
      'Are there any regulatory or licensing requirements?',
    ],
    confidenceThresholds: { high: 0.8, medium: 0.55, low: 0.3 },
  },

  real_estate: {
    id: 'persona.real_estate',
    name: 'Real Estate Attorney',
    domain: 'real_estate',
    jurisdictions: ['utah', 'general'],
    expertiseDescription: `Expert in real estate law including purchase/sale transactions,
    title issues, landlord-tenant disputes, zoning, and property development.`,
    keyStatutes: [
      'Utah Code § 57-1 (Conveyances)',
      'Utah Code § 57-8 (Condominiums)',
      'Utah Code § 57-22 (Fit Premises Act)',
      'Utah Code § 78B-6-8 (Unlawful Detainer)',
    ],
    researchSources: [
      'Utah County Recorder Offices',
      'Utah Land Title Association',
      'HUD Guidance',
      'Utah Real Estate Commission',
    ],
    systemPromptAddendum: `
## REAL ESTATE PERSONA ACTIVATED

You are now operating as a Real Estate Attorney.

### Your Expertise Areas:
1. Purchase and sale transactions
2. Title examination and insurance
3. Landlord-tenant disputes
4. Zoning and land use
5. HOA/Condo disputes
6. Commercial leases

### Key Legal Framework:
- Utah is a title theory state
- Deed of trust used for mortgages
- 3-day notice for unlawful detainer
- Recording statutes protect bona fide purchasers

### Communication Guidelines:
- Review all title documents carefully
- Identify encumbrances and easements
- Calculate closing costs and prorations
- Ensure proper recording
`,
    clarifyingQuestionTemplates: [
      'Is this residential or commercial property?',
      'Are you buying, selling, or leasing?',
      'What county is the property located in?',
      'Are there any existing liens or title issues?',
      'What is the anticipated closing date?',
    ],
    confidenceThresholds: { high: 0.85, medium: 0.6, low: 0.35 },
  },

  intellectual_property: {
    id: 'persona.ip',
    name: 'Intellectual Property Attorney',
    domain: 'intellectual_property',
    jurisdictions: ['federal', 'general'],
    expertiseDescription: `Expert in intellectual property law including patents, trademarks,
    copyrights, trade secrets, and licensing agreements.`,
    keyStatutes: [
      '35 U.S.C. (Patent Act)',
      '15 U.S.C. § 1051 (Lanham Act - Trademarks)',
      '17 U.S.C. (Copyright Act)',
      '18 U.S.C. § 1836 (Defend Trade Secrets Act)',
    ],
    researchSources: [
      'USPTO Patent and Trademark Databases',
      'Copyright Office Records',
      'WIPO Global Brand Database',
      'Google Patents',
    ],
    systemPromptAddendum: `
## INTELLECTUAL PROPERTY PERSONA ACTIVATED

You are now operating as an Intellectual Property Attorney.

### Your Expertise Areas:
1. Patent prosecution and litigation
2. Trademark registration and enforcement
3. Copyright registration and infringement
4. Trade secret protection
5. Licensing agreements
6. IP due diligence

### Key Legal Framework:
- Patents: 20 years from filing, utility/design/plant
- Trademarks: Indefinite with continued use, 10-year renewals
- Copyrights: Life + 70 years (individuals)
- Trade secrets: Indefinite with reasonable protection

### Communication Guidelines:
- Conduct thorough prior art/clearance searches
- Document creation and ownership chain
- Identify potential infringement risks
- Structure licensing for maximum protection
`,
    clarifyingQuestionTemplates: [
      'What type of IP are you trying to protect (patent, trademark, copyright)?',
      'Have you conducted a prior art or trademark search?',
      'Is this for registration, licensing, or enforcement?',
      'What is the commercial value or use of the IP?',
      'Are there any existing agreements involving this IP?',
    ],
    confidenceThresholds: { high: 0.85, medium: 0.6, low: 0.35 },
  },

  immigration: {
    id: 'persona.immigration',
    name: 'Immigration Attorney',
    domain: 'immigration',
    jurisdictions: ['federal', 'general'],
    expertiseDescription: `Expert in immigration law including visas, green cards, naturalization,
    deportation defense, and employment-based immigration.`,
    keyStatutes: [
      'Immigration and Nationality Act (8 U.S.C.)',
      '8 CFR (Immigration Regulations)',
      'USCIS Policy Manual',
      'BIA Precedent Decisions',
    ],
    researchSources: [
      'USCIS Website and Processing Times',
      'EOIR Immigration Court',
      'AILA Resources',
      'State Department Visa Bulletin',
    ],
    systemPromptAddendum: `
## IMMIGRATION PERSONA ACTIVATED

You are now operating as an Immigration Attorney.

### Your Expertise Areas:
1. Family-based immigration
2. Employment-based visas (H-1B, L-1, O-1)
3. Naturalization/citizenship
4. Deportation defense
5. Asylum and refugee claims
6. DACA/TPS

### Key Legal Framework:
- Visa categories based on relationship or employment
- Priority dates and visa bulletin
- Inadmissibility grounds (criminal, health, fraud)
- Removal defense requires immigration court

### Communication Guidelines:
- Never guarantee outcomes in immigration
- Track all filing deadlines precisely
- Document status maintenance carefully
- Identify any inadmissibility issues early
`,
    clarifyingQuestionTemplates: [
      'What is your current immigration status?',
      'What type of visa or benefit are you seeking?',
      'Have you ever been out of status or had visa violations?',
      'Do you have a criminal history (any arrests or convictions)?',
      'Do you have a US citizen or permanent resident sponsor?',
    ],
    confidenceThresholds: { high: 0.9, medium: 0.7, low: 0.4 },
  },

  tax_law: {
    id: 'persona.tax',
    name: 'Tax Attorney',
    domain: 'tax_law',
    jurisdictions: ['federal', 'utah', 'general'],
    expertiseDescription: `Expert in tax law including individual and business taxation,
    IRS disputes, tax planning, and state tax matters.`,
    keyStatutes: [
      'Internal Revenue Code (26 U.S.C.)',
      'Treasury Regulations (26 CFR)',
      'Utah Code Title 59 (Revenue and Taxation)',
      'Tax Court Rules',
    ],
    researchSources: [
      'IRS Website and Publications',
      'Tax Court Decisions',
      'Utah State Tax Commission',
      'CCH and RIA Tax Databases',
    ],
    systemPromptAddendum: `
## TAX LAW PERSONA ACTIVATED

You are now operating as a Tax Attorney.

### Your Expertise Areas:
1. Individual income tax planning
2. Business entity taxation
3. IRS audit representation
4. Tax controversy and appeals
5. Collection alternatives (OIC, IA)
6. State and local tax

### Key Legal Framework:
- IRC provides federal tax framework
- Treasury Regs have force of law
- 3-year SOL for audits (6 if 25%+ understatement)
- Tax Court is pre-payment forum

### Communication Guidelines:
- Never guarantee tax positions
- Document reasonable basis for positions
- Calculate statute of limitations precisely
- Identify audit risk factors
`,
    clarifyingQuestionTemplates: [
      'Is this regarding individual or business taxes?',
      'Are you dealing with an IRS notice or audit?',
      'What tax years are involved?',
      'What is the approximate amount in dispute?',
      'Have you already filed the returns in question?',
    ],
    confidenceThresholds: { high: 0.85, medium: 0.6, low: 0.35 },
  },

  general: {
    id: 'persona.general',
    name: 'General Practice Attorney',
    domain: 'general',
    jurisdictions: ['general'],
    expertiseDescription: `General legal advisor capable of handling a variety of legal matters
    and providing initial guidance before referral to specialists.`,
    keyStatutes: ['Varies by matter'],
    researchSources: ['General legal databases'],
    systemPromptAddendum: `
## GENERAL LEGAL PERSONA

You are operating as a General Practice Attorney providing initial legal guidance.

### Communication Guidelines:
- Identify the legal domain of the issue
- Provide general guidance and red flags
- Recommend specialist referral for complex matters
- Focus on immediate actionable steps
`,
    clarifyingQuestionTemplates: [
      'Can you describe the legal issue you are facing?',
      'What is the most urgent aspect of your situation?',
      'Have you consulted with any other attorneys?',
      'What outcome are you hoping to achieve?',
    ],
    confidenceThresholds: { high: 0.7, medium: 0.4, low: 0.2 },
  },
};

// =============================================================================
// Domain Detection
// =============================================================================

const DOMAIN_KEYWORDS: Record<LegalDomain, string[]> = {
  family_law: [
    'divorce', 'custody', 'child', 'parent', 'alimony', 'spousal support',
    'visitation', 'parent-time', 'marital', 'separation', 'guardian',
    'adoption', 'paternity', 'child support', 'domestic', 'family court',
  ],
  fcra_compliance: [
    'fcra', 'credit report', 'background check', 'consumer report', 'cra',
    'credit bureau', 'experian', 'equifax', 'transunion', 'credit score',
    'adverse action', 'dispute', 'inaccurate', 'furnisher', 'permissible purpose',
  ],
  employment_law: [
    'employer', 'employee', 'fired', 'terminated', 'harassment', 'discrimination',
    'wage', 'overtime', 'fmla', 'leave', 'wrongful termination', 'eeoc',
    'retaliation', 'hostile work', 'non-compete', 'severance',
  ],
  criminal_defense: [
    'criminal', 'arrested', 'charges', 'felony', 'misdemeanor', 'dui', 'dwi',
    'drug', 'assault', 'theft', 'plea', 'probation', 'expungement', 'jail',
    'prison', 'bail', 'public defender',
  ],
  personal_injury: [
    'accident', 'injury', 'hurt', 'medical bills', 'insurance claim', 'car accident',
    'slip and fall', 'negligence', 'damages', 'pain and suffering', 'malpractice',
    'defective product', 'workers comp',
  ],
  business_law: [
    'contract', 'business', 'corporation', 'llc', 'partnership', 'shareholder',
    'merger', 'acquisition', 'startup', 'investor', 'commercial', 'breach',
    'operating agreement', 'bylaws',
  ],
  real_estate: [
    'property', 'house', 'home', 'land', 'lease', 'landlord', 'tenant', 'eviction',
    'title', 'deed', 'mortgage', 'closing', 'zoning', 'hoa', 'condo',
  ],
  intellectual_property: [
    'patent', 'trademark', 'copyright', 'trade secret', 'infringement', 'ip',
    'invention', 'brand', 'logo', 'licensing', 'software', 'piracy',
  ],
  immigration: [
    'visa', 'green card', 'citizenship', 'naturalization', 'deportation', 'asylum',
    'uscis', 'immigration', 'h-1b', 'daca', 'undocumented', 'sponsor',
  ],
  tax_law: [
    'taxes', 'irs', 'audit', 'tax return', 'deduction', 'refund', 'tax debt',
    'back taxes', 'levy', 'lien', 'tax court', 'offer in compromise',
  ],
  general: [],
};

/**
 * Detect legal domain from input text
 */
export function detectLegalDomain(text: string): DomainDetectionResult {
  const lowerText = text.toLowerCase();
  const results: Array<{ domain: LegalDomain; matches: string[]; score: number }> = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const matches: string[] = [];
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches.push(keyword);
      }
    }

    if (matches.length > 0) {
      // Score based on number of matches and keyword specificity
      const score = matches.length / keywords.length;
      results.push({ domain: domain as LegalDomain, matches, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  if (results.length === 0) {
    return {
      domain: 'general',
      confidence: 0.3,
      suggestedJurisdiction: 'general',
      matchedKeywords: [],
      reasoning: 'No specific legal domain keywords detected. Using general legal persona.',
    };
  }

  const topResult = results[0];
  const confidence = Math.min(topResult.score * 2, 1); // Scale up but cap at 1

  // Detect jurisdiction from text
  const jurisdiction = detectJurisdiction(text);

  return {
    domain: topResult.domain,
    confidence,
    suggestedJurisdiction: jurisdiction,
    matchedKeywords: topResult.matches,
    reasoning: `Detected ${topResult.domain} domain with ${topResult.matches.length} keyword matches: ${topResult.matches.join(', ')}`,
  };
}

/**
 * Detect jurisdiction from text
 */
function detectJurisdiction(text: string): Jurisdiction {
  const lowerText = text.toLowerCase();

  const jurisdictionPatterns: Record<Jurisdiction, string[]> = {
    utah: ['utah', 'salt lake', 'provo', 'ogden', 'st. george'],
    california: ['california', 'los angeles', 'san francisco', 'san diego'],
    new_york: ['new york', 'nyc', 'manhattan', 'brooklyn'],
    texas: ['texas', 'houston', 'dallas', 'austin', 'san antonio'],
    michigan: ['michigan', 'detroit', 'ann arbor'],
    federal: ['federal', 'u.s.', 'united states', 'irs', 'uscis', 'eeoc', 'nlrb'],
    general: [],
  };

  for (const [jurisdiction, patterns] of Object.entries(jurisdictionPatterns)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        return jurisdiction as Jurisdiction;
      }
    }
  }

  return 'general';
}

// =============================================================================
// Matter Memory Management
// =============================================================================

const matterContexts: Map<string, MatterContext> = new Map();

/**
 * Create a new matter with dedicated memory
 */
export function createMatter(
  domain: LegalDomain,
  jurisdiction: Jurisdiction,
  parties: string[] = []
): MatterContext {
  const matterId = `matter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const matter: MatterContext = {
    matterId,
    domain,
    jurisdiction,
    parties,
    keyDates: [],
    documents: [],
    createdAt: now,
    lastActivity: now,
  };

  matterContexts.set(matterId, matter);
  return matter;
}

/**
 * Get matter by ID
 */
export function getMatter(matterId: string): MatterContext | null {
  return matterContexts.get(matterId) || null;
}

/**
 * Update matter
 */
export function updateMatter(matterId: string, update: Partial<MatterContext>): MatterContext | null {
  const matter = matterContexts.get(matterId);
  if (!matter) return null;

  const updated = {
    ...matter,
    ...update,
    lastActivity: new Date().toISOString(),
  };
  matterContexts.set(matterId, updated);
  return updated;
}

/**
 * Get all matters
 */
export function getAllMatters(): MatterContext[] {
  return Array.from(matterContexts.values());
}

// =============================================================================
// Persona Transfiguration
// =============================================================================

/**
 * Transfigure the legal agent into a specific persona
 */
export async function transfigurePersona(
  inputText: string,
  forceDomain?: LegalDomain,
  forceJurisdiction?: Jurisdiction
): Promise<PersonaTransfigurationResult> {
  // 1. Detect domain (or use forced)
  const detection = detectLegalDomain(inputText);
  const domain = forceDomain || detection.domain;
  const jurisdiction = forceJurisdiction || detection.suggestedJurisdiction;

  // 2. Get persona
  const persona = LEGAL_PERSONAS[domain];

  // 3. Create matter for this interaction
  const matter = createMatter(domain, jurisdiction);

  // 4. Build enriched system prompt
  let enrichedPrompt = persona.systemPromptAddendum;

  // Add jurisdiction-specific context
  if (jurisdiction !== 'general') {
    enrichedPrompt += `\n\n### Jurisdiction Focus: ${jurisdiction.toUpperCase()}\nAll advice should be tailored to ${jurisdiction} law and courts where applicable.\n`;
  }

  // Add matter tracking
  enrichedPrompt += `\n\n### Active Matter: ${matter.matterId}\nThis conversation is being tracked for case management purposes.\n`;

  // 5. Generate clarifying questions
  const clarifyingQuestions: ClarifyingQuestion[] = persona.clarifyingQuestionTemplates.map(
    (q, i) => ({
      id: `q_${i}`,
      question: q,
      type: 'text' as const,
      required: i < 2, // First 2 are required
      priority: i === 0 ? 'high' : i < 3 ? 'medium' : 'low',
    })
  );

  // 6. Generate research suggestions
  const suggestedResearch: ResearchRequest[] = [
    {
      query: `latest ${domain.replace('_', ' ')} cases ${jurisdiction}`,
      domain,
      jurisdiction,
      recencyDays: 90,
    },
    {
      query: `${domain.replace('_', ' ')} statute updates ${new Date().getFullYear()}`,
      domain,
      jurisdiction,
      recencyDays: 365,
    },
  ];

  return {
    persona,
    domainConfidence: detection.confidence,
    enrichedSystemPrompt: enrichedPrompt,
    clarifyingQuestions,
    suggestedResearch,
    matterId: matter.matterId,
  };
}

// =============================================================================
// Research Engine (Stub - integrate with web search)
// =============================================================================

/**
 * Research legal topic (stub - integrate with actual search)
 */
export async function researchLegalTopic(request: ResearchRequest): Promise<ResearchResult[]> {
  // This would integrate with:
  // 1. Web search for recent cases
  // 2. Legal databases (Westlaw, LexisNexis)
  // 3. Government sites (courts.utah.gov, uscourts.gov)
  // 4. Agency sites (CFPB, EEOC, USCIS)

  console.log(`[LegalPersona] Research requested: ${request.query} in ${request.domain}/${request.jurisdiction}`);

  // Return stub results - in production, this would call actual search APIs
  return [
    {
      source: 'Legal Research',
      title: `Research results for: ${request.query}`,
      snippet: 'Research integration pending. This would return actual search results.',
      relevanceScore: 0.5,
    },
  ];
}

// =============================================================================
// Exports
// =============================================================================

export {
  LEGAL_PERSONAS,
  DOMAIN_KEYWORDS,
};
