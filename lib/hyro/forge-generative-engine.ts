/**
 * HYRO FORGE: Generative Assessment Engine
 *
 * @hyro-domain adaptive_assessment
 * @hyro-manifold AI-powered item generation and evaluation
 *
 * PHILOSOPHY:
 * Instead of maintaining thousands of static items, we use AI to:
 * 1. Generate items on-demand at precise difficulty levels
 * 2. Evaluate responses with reasoning analysis
 * 3. Adapt in real-time to student ability
 * 4. Never repeat the same item twice
 *
 * This creates an "infinite item pool" that's always fresh,
 * perfectly calibrated, and capable of true adaptive testing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getBlueprint, type Strand, type StrandTier, type ManifoldDimension } from './forge-blueprints';
import { StatName } from './forge-types';
import { getDomainAgent, buildAgentSystemPrompt, buildAgentEvaluationPrompt } from './forge-domain-agents';

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratedItem {
    id: string;
    stat_name: StatName;
    strand: string;
    tier: StrandTier;
    manifold_focus: ManifoldDimension;
    difficulty: number;  // 0.0 to 1.0

    // The actual question
    prompt: string;
    format: 'multiple_choice' | 'short_answer' | 'explanation' | 'problem_solving';

    // For MC questions
    options?: {
        a: string;
        b: string;
        c: string;
        d: string;
    };
    correct_answer: string;

    // Metadata for evaluation
    solution_path: string;           // How to solve it (for AI grader)
    common_misconceptions: string[]; // What errors reveal
    cognitive_load: 'recall' | 'procedural' | 'conceptual' | 'transfer';

    // Tracking
    generated_at: string;
    generation_seed?: string;        // For reproducibility if needed
}

export interface ResponseEvaluation {
    is_correct: boolean;
    score: number;                   // 0.0 to 1.0 (partial credit possible)

    // Deep analysis
    reasoning_quality: number;       // 0.0 to 1.0
    misconception_detected?: string;
    error_type?: 'computational' | 'conceptual' | 'procedural' | 'careless';

    // Manifold signals
    coherence_signal: number;        // Did they show organized thinking?
    fluidity_signal: number;         // Did they adapt their approach?
    elasticity_signal: number;       // Did they handle ambiguity well?

    // Feedback
    feedback: string;
    suggested_remediation?: string;

    // Confidence
    evaluation_confidence: number;   // How confident is the AI in this eval?
}

export interface AbilityEstimate {
    theta: number;                   // Current ability estimate (-3 to +3 in IRT terms)
    standard_error: number;          // Measurement precision
    items_administered: number;

    // Per-strand breakdown
    strand_estimates: Record<string, {
        theta: number;
        se: number;
        items: number;
    }>;

    // Manifold profile
    manifold_profile: Record<ManifoldDimension, number>;
}

// =============================================================================
// DIFFICULTY CALIBRATION
// =============================================================================

/**
 * Maps our 0-1 difficulty scale to educational concepts
 */
const DIFFICULTY_ANCHORS: Record<StrandTier, { min: number; max: number; description: string }> = {
    'Foundation': {
        min: 0.1,
        max: 0.35,
        description: 'Basic recall and simple application. Grade-level fundamentals.'
    },
    'Bridge': {
        min: 0.35,
        max: 0.6,
        description: 'Multi-step problems. Connecting concepts. AP/honors level.'
    },
    'Power': {
        min: 0.6,
        max: 0.8,
        description: 'Complex synthesis. College-level rigor. Proof and derivation.'
    },
    'Horizon': {
        min: 0.8,
        max: 0.95,
        description: 'Graduate-level abstraction. Novel problem solving. Research-adjacent.'
    }
};

/**
 * Maps difficulty to IRT theta (ability parameter)
 * difficulty 0.5 = theta 0 (average)
 * difficulty 0.1 = theta -2 (below average)
 * difficulty 0.9 = theta +2 (above average)
 */
function difficultyToTheta(difficulty: number): number {
    return (difficulty - 0.5) * 4;  // Maps [0,1] to [-2,+2]
}

function thetaToDifficulty(theta: number): number {
    return (theta / 4) + 0.5;  // Maps [-2,+2] to [0,1]
}

// =============================================================================
// ITEM GENERATION PROMPTS
// =============================================================================

function getStrandContext(stat: StatName, strand: string, tier: StrandTier): string {
    const contexts: Record<string, Record<string, string>> = {
        math: {
            'Arithmetic & Number Sense': 'Basic operations, number properties, mental math, estimation',
            'Algebra I (Foundations)': 'Linear equations, inequalities, graphing lines, slope-intercept',
            'Geometry & Spatial Reasoning': 'Shapes, area, perimeter, volume, coordinate geometry, transformations',
            'Algebra II & Functions': 'Quadratics, polynomials, rational functions, exponentials, logarithms',
            'Trigonometry & Cycles': 'Unit circle, trig functions, identities, inverse trig, periodic behavior',
            'Pre-Calculus & Limits': 'Limits, continuity, sequences, series, parametric equations',
            'Calculus I (Differential)': 'Derivatives, rates of change, optimization, related rates',
            'Calculus II (Integral)': 'Integrals, area under curves, volumes, techniques of integration',
            'Calculus III (Multivariable)': 'Partial derivatives, multiple integrals, vector calculus',
            'Linear Algebra & Vectors': 'Matrices, determinants, eigenvalues, vector spaces, linear transformations',
            'Proofs & Logic': 'Mathematical reasoning, proof techniques, set theory, logic',
            'Differential Equations (ODEs)': 'First and second order ODEs, systems, Laplace transforms',
            'Partial Differential Equations (PDEs)': 'Heat equation, wave equation, boundary conditions',
            'Abstract Algebra (Groups/Rings)': 'Groups, rings, fields, homomorphisms, isomorphisms',
            'Tensor Analysis & Manifolds': 'Tensors, differential forms, manifolds, curvature',
            'Complex Analysis': 'Complex functions, contour integrals, residues, conformal maps',
            'Topology & Geometry': 'Topological spaces, continuity, compactness, connectedness',
            'Number Theory': 'Primes, modular arithmetic, Diophantine equations, cryptographic applications',
            'Game Theory & Optimization': 'Nash equilibrium, linear programming, convex optimization',
            'Chaos & Dynamical Systems': 'Attractors, bifurcations, Lyapunov exponents, fractals',
        },
        science: {
            'Physical Sciences (Newtonian)': 'Mechanics, forces, energy, momentum, waves, basic electricity',
            'Life Sciences (Cellular)': 'Cell biology, genetics basics, evolution, ecology, anatomy',
            'Earth & Space Sciences': 'Geology, weather, climate, astronomy, plate tectonics',
            'Thermodynamics & Stat Mech': 'Heat, entropy, statistical mechanics, phase transitions',
            'Organic Chemistry': 'Carbon compounds, reactions, synthesis, biochemistry applications',
            'Genetics & Epigenetics': 'DNA/RNA, gene expression, inheritance, epigenetic mechanisms',
            'Relativity (Special & General)': 'Time dilation, Lorentz transforms, spacetime curvature',
            'Neuroscience & Cognition': 'Brain structure, neural networks, cognition, consciousness',
            'Quantum Mechanics': 'Wave functions, uncertainty, superposition, entanglement',
            'Complexity Science': 'Emergence, self-organization, networks, information theory',
            'Astrophysics & Cosmology': 'Stellar evolution, black holes, Big Bang, dark matter/energy',
        },
        reading: {
            'Key Ideas & Details': 'Main idea, supporting details, summarization, textual evidence',
            'Craft & Structure': 'Word choice, tone, structure, point of view, genre conventions',
            'Integration of Knowledge': 'Synthesizing sources, comparing texts, evaluating arguments',
            'Literary Theory & Criticism': 'Critical lenses, literary movements, authorial intent',
            'Comparative Literature': 'Cross-cultural texts, translation, intertextuality',
            'Philology & Etymology': 'Word origins, language evolution, semantic shifts',
            'Semiotics & Symbology': 'Signs, symbols, meaning-making, cultural codes',
            'Philosophy of Language': 'Meaning, reference, speech acts, language and thought',
        },
        critical_thinking: {
            'Analysis & Evaluation': 'Breaking down arguments, identifying assumptions, evaluating evidence',
            'Logic & Reasoning (Formal)': 'Deductive/inductive reasoning, logical fallacies, validity',
            'Problem Solving Heuristics': 'Strategies, decomposition, analogical reasoning',
            'Cognitive Bias Mitigation': 'Recognizing biases, debiasing techniques, calibration',
            'Systems Thinking': 'Feedback loops, emergence, unintended consequences',
            'Epistemology & Truth': 'Knowledge, justification, skepticism, scientific method',
            'Strategic Forecasting': 'Prediction, scenario planning, uncertainty quantification',
        },
        social_studies: {
            'History (World & US)': 'Historical events, causation, primary sources, historiography',
            'Geography & Geopolitics': 'Physical/human geography, geopolitical analysis, maps',
            'Civics & Government': 'Political systems, rights, democracy, policy analysis',
            'Economics (Macro/Micro)': 'Supply/demand, markets, fiscal/monetary policy, trade',
            'Sociology & Anthropology': 'Social structures, culture, research methods, theory',
            'Philosophy & Ethics': 'Ethical frameworks, moral reasoning, applied ethics',
        },
    };

    return contexts[stat]?.[strand] || strand;
}

function buildGenerationPrompt(
    stat: StatName,
    strand: string,
    tier: StrandTier,
    difficulty: number,
    manifold: ManifoldDimension,
    format: 'multiple_choice' | 'short_answer' | 'problem_solving',
    avoidTopics?: string[]  // Topics already tested in this session
): string {
    const context = getStrandContext(stat, strand, tier);
    const anchor = DIFFICULTY_ANCHORS[tier];

    // ─────────────────────────────────────────────────────────────────
    // DOMAIN AGENT INTEGRATION
    // Leverage domain-specific expertise for item generation
    // ─────────────────────────────────────────────────────────────────
    const agent = getDomainAgent(stat);
    const strandContext = agent.strandContexts[strand] || context;
    const tierDifficultyMarkers = agent.difficultyMarkers[tier.toLowerCase() as keyof typeof agent.difficultyMarkers] || [];

    const manifoldGuidance: Record<ManifoldDimension, string> = {
        'coherence': 'Test whether they can organize information logically and identify patterns',
        'fluidity': 'Test whether they can shift between representations or approaches',
        'elasticity': 'Test whether they can handle ambiguity or novel framings',
        'gradient_awareness': 'Test whether they understand degrees/spectrums rather than binaries',
        'entropy_intuition': 'Test whether they can reason about uncertainty and disorder',
        'non_dual_resolution': 'Test whether they can hold contradictions or synthesize opposites',
        'generativity': 'Test whether they can create novel solutions or extend ideas',
    };

    return `${agent.expertPersona}

You are creating an assessment item for an adaptive educational diagnostic.

ASSESSMENT PHILOSOPHY:
${agent.assessmentPhilosophy}

CONTEXT:
- Subject: ${stat} (${agent.displayName})
- Strand: ${strand}
- Strand Details: ${strandContext}
- Tier: ${tier} (${anchor.description})
- Target Difficulty: ${difficulty.toFixed(2)} (scale: 0.0 easiest to 1.0 hardest)
- Cognitive Focus: ${manifoldGuidance[manifold]}
- Format: ${format}

DIFFICULTY CALIBRATION FOR ${tier.toUpperCase()} TIER:
${tierDifficultyMarkers.slice(0, 4).map(m => `• ${m}`).join('\n')}

COMMON MISCONCEPTIONS TO PROBE:
${agent.commonMisconceptions.slice(0, 3).map(m => `• ${m}`).join('\n')}

QUALITY CRITERIA:
${agent.qualityCriteria.slice(0, 4).map(c => `• ${c}`).join('\n')}

${avoidTopics?.length ? `AVOID these specific topics (already tested): ${avoidTopics.join(', ')}` : ''}

REQUIREMENTS:
1. Create ONE question at EXACTLY the target difficulty level
2. The question must authentically test the strand content
3. For multiple choice: Create 4 options where distractors represent realistic misconceptions
4. Include the solution path (how an expert would solve it)
5. List 2-3 common misconceptions this question could reveal

${format === 'multiple_choice' ? `
OUTPUT FORMAT (JSON):
{
  "prompt": "The question text",
  "options": {
    "a": "First option",
    "b": "Second option",
    "c": "Third option",
    "d": "Fourth option"
  },
  "correct_answer": "a",
  "solution_path": "Step by step solution",
  "common_misconceptions": ["Misconception 1 revealed by choosing B", "Misconception 2 revealed by choosing C"],
  "cognitive_load": "procedural"
}` : `
OUTPUT FORMAT (JSON):
{
  "prompt": "The question text",
  "correct_answer": "The expected answer or key components",
  "solution_path": "Step by step solution",
  "rubric": {
    "full_credit": "What demonstrates full understanding",
    "partial_credit": "What demonstrates partial understanding",
    "no_credit": "What indicates fundamental misunderstanding"
  },
  "common_misconceptions": ["Misconception 1", "Misconception 2"],
  "cognitive_load": "conceptual"
}`}

Generate the item now. Output ONLY valid JSON, no markdown or explanation.`;
}

// =============================================================================
// EVALUATION PROMPTS
// =============================================================================

function buildEvaluationPrompt(
    item: GeneratedItem,
    studentResponse: string,
    responseTime?: number
): string {
    // ─────────────────────────────────────────────────────────────────
    // DOMAIN AGENT INTEGRATION
    // Use domain-specific evaluation guidance
    // ─────────────────────────────────────────────────────────────────
    const agent = getDomainAgent(item.stat_name);

    return `${agent.expertPersona}

You are evaluating a student response using your domain expertise.

EVALUATION PHILOSOPHY:
${agent.evaluationGuidance}

PARTIAL CREDIT APPROACH:
${agent.partialCreditGuidelines}

QUESTION:
${item.prompt}

${item.options ? `OPTIONS:
a) ${item.options.a}
b) ${item.options.b}
c) ${item.options.c}
d) ${item.options.d}` : ''}

CORRECT ANSWER: ${item.correct_answer}
SOLUTION PATH: ${item.solution_path}
KNOWN MISCONCEPTIONS: ${item.common_misconceptions.join('; ')}

STUDENT RESPONSE: "${studentResponse}"
${responseTime ? `RESPONSE TIME: ${responseTime} seconds` : ''}

EVALUATE:
1. Is the response correct? (For open-ended, assess against rubric)
2. Score from 0.0 to 1.0 (partial credit allowed for open-ended)
3. What does this response reveal about their understanding?
4. What specific misconception (if any) does this reveal?
5. Rate their reasoning quality (0-1) based on their approach
6. Provide brief, constructive feedback aligned with the assessment philosophy

OUTPUT FORMAT (JSON):
{
  "is_correct": true/false,
  "score": 0.0-1.0,
  "reasoning_quality": 0.0-1.0,
  "misconception_detected": "specific misconception or null",
  "error_type": "computational|conceptual|procedural|careless|null",
  "coherence_signal": 0.0-1.0,
  "fluidity_signal": 0.0-1.0,
  "elasticity_signal": 0.0-1.0,
  "feedback": "Brief constructive feedback",
  "suggested_remediation": "What they should review or practice"
}

Output ONLY valid JSON.`;
}

// =============================================================================
// GENERATIVE ENGINE CLASS
// =============================================================================

export class GenerativeAssessmentEngine {
    private client: Anthropic;
    private model: string = 'claude-sonnet-4-20250514';  // Fast + capable

    constructor() {
        this.client = new Anthropic();
    }

    /**
     * Generate a single assessment item
     */
    async generateItem(
        stat: StatName,
        strand: string,
        tier: StrandTier,
        difficulty: number,
        manifold: ManifoldDimension,
        format: 'multiple_choice' | 'short_answer' | 'problem_solving' = 'multiple_choice',
        avoidTopics?: string[]
    ): Promise<GeneratedItem> {
        const prompt = buildGenerationPrompt(stat, strand, tier, difficulty, manifold, format, avoidTopics);

        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type');
        }

        const parsed = JSON.parse(content.text);

        return {
            id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            stat_name: stat,
            strand,
            tier,
            manifold_focus: manifold,
            difficulty,
            prompt: parsed.prompt,
            format,
            options: parsed.options,
            correct_answer: parsed.correct_answer,
            solution_path: parsed.solution_path,
            common_misconceptions: parsed.common_misconceptions,
            cognitive_load: parsed.cognitive_load,
            generated_at: new Date().toISOString(),
        };
    }

    /**
     * Evaluate a student response
     */
    async evaluateResponse(
        item: GeneratedItem,
        studentResponse: string,
        responseTime?: number
    ): Promise<ResponseEvaluation> {
        // Fast path for MC with exact match
        if (item.format === 'multiple_choice' && item.options) {
            const normalized = studentResponse.trim().toLowerCase();
            const correctLetter = item.correct_answer.toLowerCase();

            // If they just gave the letter
            if (normalized === correctLetter || normalized === correctLetter + ')') {
                return this.createQuickEvaluation(true, item);
            }

            // If they gave wrong letter
            if (['a', 'b', 'c', 'd'].includes(normalized) && normalized !== correctLetter) {
                return this.createQuickEvaluation(false, item, normalized);
            }
        }

        // Full AI evaluation for complex responses
        const prompt = buildEvaluationPrompt(item, studentResponse, responseTime);

        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 512,
            messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type');
        }

        const parsed = JSON.parse(content.text);

        return {
            is_correct: parsed.is_correct,
            score: parsed.score,
            reasoning_quality: parsed.reasoning_quality,
            misconception_detected: parsed.misconception_detected,
            error_type: parsed.error_type,
            coherence_signal: parsed.coherence_signal,
            fluidity_signal: parsed.fluidity_signal,
            elasticity_signal: parsed.elasticity_signal,
            feedback: parsed.feedback,
            suggested_remediation: parsed.suggested_remediation,
            evaluation_confidence: 0.9,  // AI evaluation
        };
    }

    private createQuickEvaluation(
        correct: boolean,
        item: GeneratedItem,
        wrongChoice?: string
    ): ResponseEvaluation {
        return {
            is_correct: correct,
            score: correct ? 1.0 : 0.0,
            reasoning_quality: correct ? 0.7 : 0.3,  // Can't assess reasoning from letter alone
            misconception_detected: !correct && wrongChoice
                ? item.common_misconceptions[['a','b','c','d'].indexOf(wrongChoice)]
                : undefined,
            error_type: correct ? undefined : 'unknown' as any,
            coherence_signal: correct ? 0.7 : 0.4,
            fluidity_signal: 0.5,  // Neutral without more info
            elasticity_signal: 0.5,
            feedback: correct
                ? 'Correct!'
                : `The correct answer was ${item.correct_answer}. ${item.solution_path.slice(0, 100)}...`,
            evaluation_confidence: 1.0,  // Exact match is certain
        };
    }

    /**
     * Select next item based on current ability estimate
     * Implements Maximum Information criterion from IRT
     */
    async selectNextItem(
        stat: StatName,
        abilityEstimate: AbilityEstimate,
        sessionHistory: GeneratedItem[]
    ): Promise<{ strand: string; tier: StrandTier; difficulty: number; manifold: ManifoldDimension }> {
        const blueprint = getBlueprint(stat);

        // Count items per strand in this session
        const strandCounts: Record<string, number> = {};
        for (const item of sessionHistory) {
            strandCounts[item.strand] = (strandCounts[item.strand] || 0) + 1;
        }

        // Find most undersampled strand weighted by blueprint
        let bestStrand: Strand | null = null;
        let maxDeficit = -Infinity;

        const totalItems = sessionHistory.length || 1;

        for (const strand of blueprint.strands) {
            const currentCount = strandCounts[strand.strand] || 0;
            const currentProportion = currentCount / totalItems;
            const targetProportion = strand.weight;
            const deficit = targetProportion - currentProportion;

            // Also consider strand-specific ability - prefer strands with high uncertainty
            const strandEstimate = abilityEstimate.strand_estimates[strand.strand];
            const uncertaintyBonus = strandEstimate ? strandEstimate.se * 0.5 : 0.5;

            const adjustedDeficit = deficit + uncertaintyBonus;

            if (adjustedDeficit > maxDeficit) {
                maxDeficit = adjustedDeficit;
                bestStrand = strand;
            }
        }

        if (!bestStrand) {
            bestStrand = blueprint.strands[0];
        }

        // Target difficulty based on ability
        // In IRT, maximum information is at difficulty = ability (theta)
        // But we want to be slightly challenging, so target theta + 0.5 SE
        const strandTheta = abilityEstimate.strand_estimates[bestStrand.strand]?.theta ?? 0;
        const targetDifficulty = Math.max(0.1, Math.min(0.95, thetaToDifficulty(strandTheta + 0.3)));

        return {
            strand: bestStrand.strand,
            tier: bestStrand.tier,
            difficulty: targetDifficulty,
            manifold: bestStrand.manifold_focus,
        };
    }

    /**
     * Update ability estimate after a response (simplified IRT update)
     */
    updateAbilityEstimate(
        current: AbilityEstimate,
        item: GeneratedItem,
        evaluation: ResponseEvaluation
    ): AbilityEstimate {
        const itemTheta = difficultyToTheta(item.difficulty);
        const response = evaluation.score;

        // Simplified EAP update (Bayesian update on ability)
        // More sophisticated would use full likelihood, but this works well in practice
        const learningRate = 0.3 / Math.sqrt(current.items_administered + 1);
        const prediction = 1 / (1 + Math.exp(-(current.theta - itemTheta)));  // Rasch probability
        const error = response - prediction;

        const newTheta = current.theta + learningRate * error;
        const newSE = current.standard_error * 0.95;  // SE decreases with more items

        // Update strand-specific estimate
        const strandEstimates = { ...current.strand_estimates };
        const strandKey = item.strand;

        if (!strandEstimates[strandKey]) {
            strandEstimates[strandKey] = { theta: 0, se: 1.5, items: 0 };
        }

        const strandEst = strandEstimates[strandKey];
        const strandLR = 0.4 / Math.sqrt(strandEst.items + 1);
        const strandPred = 1 / (1 + Math.exp(-(strandEst.theta - itemTheta)));
        const strandError = response - strandPred;

        strandEstimates[strandKey] = {
            theta: strandEst.theta + strandLR * strandError,
            se: strandEst.se * 0.92,
            items: strandEst.items + 1,
        };

        // Update manifold profile
        const manifoldProfile = { ...current.manifold_profile };
        const manifoldKey = item.manifold_focus;
        const currentManifold = manifoldProfile[manifoldKey] ?? 0.5;
        manifoldProfile[manifoldKey] = currentManifold * 0.8 + evaluation[`${manifoldKey.replace('_', '')}_signal` as keyof ResponseEvaluation] as number * 0.2;

        return {
            theta: Math.max(-3, Math.min(3, newTheta)),
            standard_error: Math.max(0.2, newSE),
            items_administered: current.items_administered + 1,
            strand_estimates: strandEstimates,
            manifold_profile: manifoldProfile,
        };
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

let engineInstance: GenerativeAssessmentEngine | null = null;

export function getGenerativeEngine(): GenerativeAssessmentEngine {
    if (!engineInstance) {
        engineInstance = new GenerativeAssessmentEngine();
    }
    return engineInstance;
}

// =============================================================================
// INITIAL ABILITY ESTIMATE
// =============================================================================

export function createInitialAbilityEstimate(): AbilityEstimate {
    return {
        theta: 0,           // Start at average
        standard_error: 1.5, // High uncertainty
        items_administered: 0,
        strand_estimates: {},
        manifold_profile: {
            coherence: 0.5,
            fluidity: 0.5,
            elasticity: 0.5,
            gradient_awareness: 0.5,
            entropy_intuition: 0.5,
            non_dual_resolution: 0.5,
            generativity: 0.5,
        },
    };
}
