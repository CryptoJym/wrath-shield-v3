/**
 * Assured Word Engine (AWE) v1
 *
 * Maps flagged phrases to confident alternatives.
 * Learns from user edits via assured_fit scores.
 *
 * Architecture:
 * - Seed map provides initial phrase→alternatives mappings
 * - Personal Phrase Bank (from digestion) merges at runtime
 * - Learning weights adjust based on assured_fit scores (1-10)
 * - Output: assured_alt, options array, lift_score
 */

import { ensureServerOnly } from './server-only-guard';

// Enforce server-side execution
ensureServerOnly();

/**
 * Category types matching SpeechMiner confidence flags
 */
export type PhraseCategory =
  | 'hedges'
  | 'apologies'
  | 'permission-seek'
  | 'self-undervalue'
  | 'personalization'
  | 'assured-markers';

/**
 * Phrase mapping with alternatives and metadata
 */
export interface PhraseMapping {
  phrase: string;                  // Original phrase (e.g., "maybe")
  canonical: string;                // Canonical identifier (e.g., "hedge_maybe")
  category: PhraseCategory;         // Category type
  context_tags: string[];           // Context tags (e.g., ["work", "email"])
  assured_alt: string;              // Primary assured alternative
  options: string[];                // Alternative options (3 total)
  lift_score: number;               // Expected confidence lift (0-1)
  enabled: boolean;                 // Whether mapping is active
  assured_fit?: number;             // User fit score (1-10, null if no feedback)
}

/**
 * AWE suggestion output
 */
export interface AWESuggestion {
  original_phrase: string;
  assured_alt: string;              // Primary suggestion
  options: string[];                // 3 alternative options
  lift_score: number;               // Expected confidence lift
  category: PhraseCategory;
  context_tags: string[];
}

/**
 * Seed map from PRD - initial phrase mappings
 *
 * Based on Confidence OS v7 PRD, lines 96-113
 */
const SEED_MAP: PhraseMapping[] = [
  // HEDGES
  {
    phrase: 'maybe',
    canonical: 'hedge_maybe',
    category: 'hedges',
    context_tags: ['work', 'co-parent', 'planning'],
    assured_alt: 'I will',
    options: ['I will', 'I decide', "I'm proceeding"],
    lift_score: 0.18,
    enabled: true,
  },
  {
    phrase: 'I guess',
    canonical: 'hedge_i_guess',
    category: 'hedges',
    context_tags: ['work', 'decision'],
    assured_alt: 'I know',
    options: ['I know', "I'm clear that", "I've decided"],
    lift_score: 0.16,
    enabled: true,
  },
  // APOLOGIES
  {
    phrase: 'sorry for bothering',
    canonical: 'apology_bothering',
    category: 'apologies',
    context_tags: ['email', 'text'],
    assured_alt: 'Thank you for your time',
    options: ['Thank you for your time', "I'll get to the point", "I appreciate your attention"],
    lift_score: 0.16,
    enabled: true,
  },
  // PERMISSION-SEEK
  {
    phrase: "if it's okay",
    canonical: 'permission_seek',
    category: 'permission-seek',
    context_tags: ['request', 'coordination'],
    assured_alt: 'I will',
    options: ['I will', "I've decided to", "I'm doing"],
    lift_score: 0.17,
    enabled: true,
  },
  // SELF-UNDERVALUE
  {
    phrase: "I don't deserve",
    canonical: 'self_undervalue',
    category: 'self-undervalue',
    context_tags: ['self-talk'],
    assured_alt: 'I value my time',
    options: ['I value my time', "I'm enforcing my line", 'My standards apply'],
    lift_score: 0.22,
    enabled: true,
  },
  // PERSONALIZATION (Second Agreement)
  {
    phrase: "they think I'm",
    canonical: 'personalization_took_it_personally',
    category: 'personalization',
    context_tags: ['social', 'conflict'],
    assured_alt: "That's their story; I hold my line",
    options: ["That's their story; I hold my line", 'I honor my path', 'I respect my boundaries'],
    lift_score: 0.14,
    enabled: true,
  },
];

/**
 * Assured Word Engine class
 * Singleton pattern for consistent phrase mappings
 */
class AssuredWordEngine {
  private seedMap: Map<string, PhraseMapping>;
  private personalPhraseBank: Map<string, PhraseMapping>;

  constructor() {
    this.seedMap = new Map();
    this.personalPhraseBank = new Map();
    this.initializeSeedMap();
  }

  /**
   * Initialize seed map from PRD
   */
  private initializeSeedMap(): void {
    for (const mapping of SEED_MAP) {
      // Use lowercase phrase as key for case-insensitive lookup
      this.seedMap.set(mapping.phrase.toLowerCase(), mapping);
    }
  }

  /**
   * Get suggestion for a phrase
   *
   * Lookup priority:
   * 1. Personal Phrase Bank (user-learned)
   * 2. Seed Map (PRD defaults)
   *
   * @param phrase - The phrase to get suggestions for
   * @returns AWESuggestion or null if no mapping found
   */
  getSuggestion(phrase: string): AWESuggestion | null {
    const normalizedPhrase = phrase.toLowerCase().trim();

    // Check Personal Phrase Bank first (user preferences)
    const personalMapping = this.personalPhraseBank.get(normalizedPhrase);
    if (personalMapping && personalMapping.enabled) {
      return this.createSuggestion(personalMapping);
    }

    // Fallback to Seed Map
    const seedMapping = this.seedMap.get(normalizedPhrase);
    if (seedMapping && seedMapping.enabled) {
      return this.createSuggestion(seedMapping);
    }

    // Try partial matches (e.g., "maybe we should" matches "maybe")
    for (const [key, mapping] of this.personalPhraseBank.entries()) {
      if (normalizedPhrase.includes(key) && mapping.enabled) {
        return this.createSuggestion(mapping);
      }
    }

    for (const [key, mapping] of this.seedMap.entries()) {
      if (normalizedPhrase.includes(key) && mapping.enabled) {
        return this.createSuggestion(mapping);
      }
    }

    return null;
  }

  /**
   * Create AWESuggestion from PhraseMapping
   */
  private createSuggestion(mapping: PhraseMapping): AWESuggestion {
    // Adjust lift_score based on assured_fit if available
    let adjustedLiftScore = mapping.lift_score;
    if (mapping.assured_fit !== undefined) {
      // Scale lift_score by fit: fit=10 → 1.5x, fit=5 → 1.0x, fit=1 → 0.5x
      const fitMultiplier = 0.5 + (mapping.assured_fit / 10) * 0.5;
      adjustedLiftScore = mapping.lift_score * fitMultiplier;
    }

    return {
      original_phrase: mapping.phrase,
      assured_alt: mapping.assured_alt,
      options: mapping.options,
      lift_score: adjustedLiftScore,
      category: mapping.category,
      context_tags: mapping.context_tags,
    };
  }

  /**
   * Get all available mappings
   *
   * @returns Array of all phrase mappings (seed + personal)
   */
  getAllMappings(): PhraseMapping[] {
    const allMappings: PhraseMapping[] = [];

    // Add seed mappings
    for (const mapping of this.seedMap.values()) {
      allMappings.push({ ...mapping });
    }

    // Add personal mappings (override seed if duplicate)
    for (const mapping of this.personalPhraseBank.values()) {
      const existingIndex = allMappings.findIndex(
        (m) => m.canonical === mapping.canonical
      );
      if (existingIndex >= 0) {
        allMappings[existingIndex] = { ...mapping };
      } else {
        allMappings.push({ ...mapping });
      }
    }

    return allMappings;
  }

  /**
   * Update assured_fit score for a phrase
   * Learning mechanism - adjusts weights based on user edits
   *
   * @param phrase - The phrase that was edited
   * @param assuredFit - User fit score (1-10)
   */
  updateAssuredFit(phrase: string, assuredFit: number): void {
    const normalizedPhrase = phrase.toLowerCase().trim();

    // Validate assured_fit range
    if (assuredFit < 1 || assuredFit > 10) {
      throw new Error('assured_fit must be between 1 and 10');
    }

    // Update in personal phrase bank if exists
    const personalMapping = this.personalPhraseBank.get(normalizedPhrase);
    if (personalMapping) {
      personalMapping.assured_fit = assuredFit;
      return;
    }

    // Update in seed map (but don't modify original - copy to personal bank)
    const seedMapping = this.seedMap.get(normalizedPhrase);
    if (seedMapping) {
      const personalizedMapping: PhraseMapping = {
        ...seedMapping,
        assured_fit: assuredFit,
      };
      this.personalPhraseBank.set(normalizedPhrase, personalizedMapping);
    }
  }

  /**
   * Add a new phrase mapping to Personal Phrase Bank
   * Used for digestion and user-added phrases
   *
   * @param mapping - The phrase mapping to add
   */
  addPersonalMapping(mapping: PhraseMapping): void {
    const normalizedPhrase = mapping.phrase.toLowerCase().trim();
    this.personalPhraseBank.set(normalizedPhrase, mapping);
  }

  /**
   * Merge Personal Phrase Bank from external source
   * Used for Limitless digestion integration
   *
   * @param mappings - Array of phrase mappings to merge
   */
  mergePersonalPhraseBank(mappings: PhraseMapping[]): void {
    for (const mapping of mappings) {
      this.addPersonalMapping(mapping);
    }
  }

  /**
   * Get mappings by category
   *
   * @param category - The category to filter by
   * @returns Array of mappings in that category
   */
  getMappingsByCategory(category: PhraseCategory): PhraseMapping[] {
    return this.getAllMappings().filter((m) => m.category === category);
  }

  /**
   * Enable or disable a phrase mapping
   *
   * @param phrase - The phrase to enable/disable
   * @param enabled - Whether to enable the mapping
   */
  setMappingEnabled(phrase: string, enabled: boolean): void {
    const normalizedPhrase = phrase.toLowerCase().trim();

    // Update in personal phrase bank if exists
    const personalMapping = this.personalPhraseBank.get(normalizedPhrase);
    if (personalMapping) {
      personalMapping.enabled = enabled;
      return;
    }

    // Copy seed mapping to personal bank with new enabled state
    const seedMapping = this.seedMap.get(normalizedPhrase);
    if (seedMapping) {
      const personalizedMapping: PhraseMapping = {
        ...seedMapping,
        enabled,
      };
      this.personalPhraseBank.set(normalizedPhrase, personalizedMapping);
    }
  }

  /**
   * Clear Personal Phrase Bank
   * Useful for testing and reset
   */
  clearPersonalPhraseBank(): void {
    this.personalPhraseBank.clear();
  }
}

// Singleton instance
let instance: AssuredWordEngine | null = null;

/**
 * Get Assured Word Engine singleton instance
 *
 * @returns AssuredWordEngine instance
 */
export function getAssuredWordEngine(): AssuredWordEngine {
  if (!instance) {
    instance = new AssuredWordEngine();
  }
  return instance;
}

/**
 * Convenience function: Get suggestion for a phrase
 *
 * @param phrase - The phrase to get suggestions for
 * @returns AWESuggestion or null
 */
export function getSuggestion(phrase: string): AWESuggestion | null {
  return getAssuredWordEngine().getSuggestion(phrase);
}
