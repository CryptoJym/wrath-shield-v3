/**
 * SpeechMiner v2 - Confidence Flag Lexicons
 *
 * Defines lexicons and heuristic rules for detecting confidence flags
 * in transcripts and chat input. Each category includes:
 * - Base patterns (phrases/words)
 * - Severity base weights (1-5)
 * - Intensifier modifiers
 * - Contextual rules
 */

/**
 * Severity Scoring System:
 * 1 = Minimal impact on perceived confidence
 * 2 = Slight hesitation or softening
 * 3 = Moderate confidence reduction
 * 4 = Significant confidence undermining
 * 5 = Severe confidence deficit signal
 *
 * Modifiers:
 * +1 for each intensifier word (really, very, extremely, etc.)
 * +1 for repetition within same sentence
 * +1 for multiple flags in quick succession (<50 words apart)
 * Capped at severity 5
 */

export interface FlagPattern {
  pattern: string | RegExp;
  baseWeight: 1 | 2 | 3 | 4 | 5;
  description: string;
}

export interface CategoryLexicon {
  name: string;
  description: string;
  patterns: FlagPattern[];
  intensifiers: string[];
}

/**
 * CATEGORY 1: Hedges
 * Words/phrases that weaken statements and introduce uncertainty
 */
export const HEDGES_LEXICON: CategoryLexicon = {
  name: 'hedges',
  description: 'Weakening words that introduce uncertainty or soften statements',
  patterns: [
    // Severity 1: Mild hedges
    { pattern: /\b(maybe|perhaps|possibly)\b/i, baseWeight: 1, description: 'Mild possibility markers' },
    { pattern: /\b(somewhat|kind of|sort of)\b/i, baseWeight: 1, description: 'Qualifying softeners' },

    // Severity 2: Moderate hedges
    { pattern: /\bi think\b/i, baseWeight: 2, description: 'Opinion framing' },
    { pattern: /\bi guess\b/i, baseWeight: 2, description: 'Uncertain assumption' },
    { pattern: /\bmight\b/i, baseWeight: 2, description: 'Tentative possibility' },
    { pattern: /\bcould be\b/i, baseWeight: 2, description: 'Uncertain possibility' },

    // Severity 3: Strong hedges
    { pattern: /\bi'm not sure (but|if)\b/i, baseWeight: 3, description: 'Explicit uncertainty' },
    { pattern: /\bi don't know (if|whether)\b/i, baseWeight: 3, description: 'Knowledge uncertainty' },
    { pattern: /\bprobably\b/i, baseWeight: 3, description: 'Probabilistic hedge' },

    // Severity 4: Severe hedges
    { pattern: /\bi have no idea\b/i, baseWeight: 4, description: 'Total uncertainty' },
    { pattern: /\bi'm completely unsure\b/i, baseWeight: 4, description: 'Maximum uncertainty' },
  ],
  intensifiers: ['really', 'very', 'extremely', 'totally', 'completely', 'absolutely'],
};

/**
 * CATEGORY 2: Apologies
 * Unnecessary apologies that signal insecurity or over-accommodation
 */
export const APOLOGIES_LEXICON: CategoryLexicon = {
  name: 'apologies',
  description: 'Unnecessary apologies signaling insecurity',
  patterns: [
    // Severity 2: Mild apologies
    { pattern: /\bsorry for\b/i, baseWeight: 2, description: 'General apology' },
    { pattern: /\bapologies for\b/i, baseWeight: 2, description: 'Formal apology' },
    { pattern: /\bexcuse me\b/i, baseWeight: 2, description: 'Polite interruption' },

    // Severity 3: Moderate apologies
    { pattern: /\bi'm sorry (to|for)\b/i, baseWeight: 3, description: 'Personal apology' },
    { pattern: /\bsorry if (that|this)\b/i, baseWeight: 3, description: 'Conditional apology' },

    // Severity 4: Strong apologies
    { pattern: /\bi'm really sorry\b/i, baseWeight: 4, description: 'Intensified apology' },
    { pattern: /\bsorry to bother\b/i, baseWeight: 4, description: 'Apologizing for presence' },
    { pattern: /\bsorry to interrupt\b/i, baseWeight: 4, description: 'Apologizing for participation' },

    // Severity 5: Severe apologies
    { pattern: /\bi'm so sorry (for|about)\b/i, baseWeight: 5, description: 'Maximum apologetic' },
    { pattern: /\bdeep(?:est)? apologies\b/i, baseWeight: 5, description: 'Extreme apology' },
  ],
  intensifiers: ['so', 'really', 'very', 'deeply', 'sincerely', 'truly'],
};

/**
 * CATEGORY 3: Self-Undervalue
 * Phrases that diminish one's own worth, ideas, or contributions
 */
export const SELF_UNDERVALUE_LEXICON: CategoryLexicon = {
  name: 'self-undervalue',
  description: 'Phrases diminishing one\'s own worth or contributions',
  patterns: [
    // Severity 2: Mild self-deprecation
    { pattern: /\bjust my (opinion|thought|idea)\b/i, baseWeight: 2, description: 'Minimizing own input' },
    { pattern: /\bi'm no expert\b/i, baseWeight: 2, description: 'Disclaiming expertise' },

    // Severity 3: Moderate self-undervalue
    { pattern: /\bthis might be stupid but\b/i, baseWeight: 3, description: 'Pre-emptive self-criticism' },
    { pattern: /\bthis is probably wrong but\b/i, baseWeight: 3, description: 'Assuming incorrectness' },
    { pattern: /\bi'm not (good|great) at\b/i, baseWeight: 3, description: 'Ability denial' },

    // Severity 4: Strong self-undervalue
    { pattern: /\bi don't really know what i'm (doing|talking about)\b/i, baseWeight: 4, description: 'Competence denial' },
    { pattern: /\bthis is probably a dumb question\b/i, baseWeight: 4, description: 'Self-labeling as incompetent' },
    { pattern: /\bi'm probably missing something obvious\b/i, baseWeight: 4, description: 'Assuming own oversight' },

    // Severity 5: Severe self-undervalue
    { pattern: /\bi have no idea what i'm doing\b/i, baseWeight: 5, description: 'Total competence denial' },
    { pattern: /\bi'm completely clueless\b/i, baseWeight: 5, description: 'Extreme self-diminishment' },
  ],
  intensifiers: ['really', 'totally', 'completely', 'absolutely', 'probably', 'definitely'],
};

/**
 * CATEGORY 4: Permission Seeking
 * Asking for permission unnecessarily, signaling lack of autonomy
 */
export const PERMISSION_SEEK_LEXICON: CategoryLexicon = {
  name: 'permission-seek',
  description: 'Unnecessary permission requests signaling lack of autonomy',
  patterns: [
    // Severity 2: Mild permission seeking
    { pattern: /\bwould it be (okay|alright|fine)\b/i, baseWeight: 2, description: 'Tentative permission request' },
    { pattern: /\bdo you mind if\b/i, baseWeight: 2, description: 'Polite permission check' },

    // Severity 3: Moderate permission seeking
    { pattern: /\bis it okay (if|to)\b/i, baseWeight: 3, description: 'Direct permission request' },
    { pattern: /\bcan i (ask|suggest|propose)\b/i, baseWeight: 3, description: 'Action permission' },
    { pattern: /\bmay i\b/i, baseWeight: 3, description: 'Formal permission' },

    // Severity 4: Strong permission seeking
    { pattern: /\bwould you allow me to\b/i, baseWeight: 4, description: 'Submissive permission request' },
    { pattern: /\bi hope it's okay (if|that)\b/i, baseWeight: 4, description: 'Hopeful permission' },

    // Severity 5: Severe permission seeking
    { pattern: /\bplease let me know if i can\b/i, baseWeight: 5, description: 'Maximum deference' },
    { pattern: /\bi need your permission to\b/i, baseWeight: 5, description: 'Explicit subordination' },
  ],
  intensifiers: ['really', 'please', 'possibly', 'maybe'],
};

/**
 * CATEGORY 5: Assured Markers (POSITIVE FLAGS)
 * Strong, confident language indicating assertiveness
 * Note: Lower base weights are better for positive flags
 */
export const ASSURED_MARKERS_LEXICON: CategoryLexicon = {
  name: 'assured-markers',
  description: 'Confident, assertive language (positive indicator)',
  patterns: [
    // Severity 1: Strong confidence (GOOD)
    { pattern: /\bi will\b/i, baseWeight: 1, description: 'Definite future action' },
    { pattern: /\bi can\b/i, baseWeight: 1, description: 'Ability assertion' },
    { pattern: /\bthis is (correct|right|accurate)\b/i, baseWeight: 1, description: 'Certainty statement' },

    // Severity 2: Moderate confidence (GOOD)
    { pattern: /\bi believe\b/i, baseWeight: 2, description: 'Conviction statement' },
    { pattern: /\bin my experience\b/i, baseWeight: 2, description: 'Expertise reference' },

    // Note: For assured markers, detection adds POSITIVE confidence score
    // Implementation should track these separately from negative flags
  ],
  intensifiers: ['definitely', 'certainly', 'absolutely', 'clearly'],
};

/**
 * CATEGORY 6: Personalization Cues
 * Excessive use of "I" statements, over-personalizing neutral topics
 */
export const PERSONALIZATION_LEXICON: CategoryLexicon = {
  name: 'personalization',
  description: 'Excessive personalization, over-using "I" statements',
  patterns: [
    // Severity is calculated based on frequency in context window
    // Base weight 1 per occurrence, escalates with density
    { pattern: /\bi feel (like|that)\b/i, baseWeight: 1, description: 'Emotional framing' },
    { pattern: /\bfor me\b/i, baseWeight: 1, description: 'Personal perspective' },
    { pattern: /\bin my opinion\b/i, baseWeight: 1, description: 'Opinion qualifier' },
    { pattern: /\bto me\b/i, baseWeight: 1, description: 'Personal interpretation' },
    { pattern: /\bfrom my perspective\b/i, baseWeight: 1, description: 'Perspective framing' },
  ],
  intensifiers: ['personally', 'really', 'strongly'],
};

/**
 * Combined lexicon for efficient lookup
 */
export const ALL_LEXICONS: CategoryLexicon[] = [
  HEDGES_LEXICON,
  APOLOGIES_LEXICON,
  SELF_UNDERVALUE_LEXICON,
  PERMISSION_SEEK_LEXICON,
  ASSURED_MARKERS_LEXICON,
  PERSONALIZATION_LEXICON,
];

/**
 * Severity calculation rules:
 *
 * 1. Start with pattern's baseWeight
 * 2. Add +1 for each intensifier word within 3 words before the pattern
 * 3. Add +1 if same pattern appears multiple times in same sentence
 * 4. Add +1 if multiple different flags appear within 50 words
 * 5. Cap final severity at 5
 *
 * Example:
 * "I'm really not sure" -> base: 3 (not sure) + 1 (intensifier "really") = 4
 * "I'm so, so sorry" -> base: 5 (so sorry) + 1 (repetition) = 5 (capped)
 */

/**
 * Context window for flag clustering:
 * - Check 50 words before and after each flag
 * - If 3+ flags in this window, increase all severities by +1
 * - Maximum severity remains capped at 5
 */
