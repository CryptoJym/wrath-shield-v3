import { StatName } from './forge-types';

export type ManifoldDimension =
    | 'coherence'
    | 'fluidity'
    | 'elasticity'
    | 'gradient_awareness'
    | 'entropy_intuition'
    | 'non_dual_resolution'
    | 'generativity';

export type StrandTier = 'Foundation' | 'Bridge' | 'Power' | 'Horizon';

export interface Strand {
    strand: string;
    weight: number; // 0.0 to 1.0
    tier: StrandTier;
    manifold_focus: ManifoldDimension;
}

export interface AssessmentBlueprint {
    stat_name: StatName;
    strands: Strand[];
}

export const ASSESSMENT_BLUEPRINTS: Record<StatName, AssessmentBlueprint> = {
    math: {
        stat_name: 'math',
        strands: [
            // TIER 1: FOUNDATION (Grammar of the Domain)
            { strand: 'Arithmetic & Number Sense', weight: 0.05, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Algebra I (Foundations)', weight: 0.05, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Geometry & Spatial Reasoning', weight: 0.05, tier: 'Foundation', manifold_focus: 'fluidity' },

            // TIER 2: BRIDGE (Fluency & Connection)
            { strand: 'Algebra II & Functions', weight: 0.05, tier: 'Bridge', manifold_focus: 'gradient_awareness' },
            { strand: 'Trigonometry & Cycles', weight: 0.05, tier: 'Bridge', manifold_focus: 'fluidity' },
            { strand: 'Pre-Calculus & Limits', weight: 0.05, tier: 'Bridge', manifold_focus: 'gradient_awareness' },

            // TIER 3: POWER (Synthesis & Resolution)
            { strand: 'Calculus I (Differential)', weight: 0.05, tier: 'Power', manifold_focus: 'gradient_awareness' },
            { strand: 'Calculus II (Integral)', weight: 0.05, tier: 'Power', manifold_focus: 'non_dual_resolution' },
            { strand: 'Calculus III (Multivariable)', weight: 0.05, tier: 'Power', manifold_focus: 'fluidity' },
            { strand: 'Linear Algebra & Vectors', weight: 0.05, tier: 'Power', manifold_focus: 'coherence' },
            { strand: 'Proofs & Logic', weight: 0.05, tier: 'Power', manifold_focus: 'non_dual_resolution' },

            // TIER 4: HORIZON (Generativity & Chaos)
            { strand: 'Differential Equations (ODEs)', weight: 0.05, tier: 'Horizon', manifold_focus: 'entropy_intuition' },
            { strand: 'Partial Differential Equations (PDEs)', weight: 0.05, tier: 'Horizon', manifold_focus: 'entropy_intuition' },
            { strand: 'Abstract Algebra (Groups/Rings)', weight: 0.05, tier: 'Horizon', manifold_focus: 'generativity' },
            { strand: 'Tensor Analysis & Manifolds', weight: 0.05, tier: 'Horizon', manifold_focus: 'generativity' },
            { strand: 'Complex Analysis', weight: 0.05, tier: 'Horizon', manifold_focus: 'elasticity' },
            { strand: 'Topology & Geometry', weight: 0.05, tier: 'Horizon', manifold_focus: 'elasticity' },
            { strand: 'Number Theory', weight: 0.05, tier: 'Horizon', manifold_focus: 'coherence' },
            { strand: 'Game Theory & Optimization', weight: 0.05, tier: 'Horizon', manifold_focus: 'non_dual_resolution' },
            { strand: 'Chaos & Dynamical Systems', weight: 0.05, tier: 'Horizon', manifold_focus: 'entropy_intuition' },
        ],
    },
    reading: {
        stat_name: 'reading',
        strands: [
            // TIER 1: FOUNDATION
            { strand: 'Key Ideas & Details', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Craft & Structure', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },

            // TIER 2: BRIDGE
            { strand: 'Integration of Knowledge', weight: 0.15, tier: 'Bridge', manifold_focus: 'non_dual_resolution' },
            { strand: 'Literary Theory & Criticism', weight: 0.10, tier: 'Bridge', manifold_focus: 'elasticity' },

            // TIER 3: POWER
            { strand: 'Comparative Literature', weight: 0.10, tier: 'Power', manifold_focus: 'fluidity' },
            { strand: 'Philology & Etymology', weight: 0.10, tier: 'Power', manifold_focus: 'coherence' },

            // TIER 4: HORIZON
            { strand: 'Semiotics & Symbology', weight: 0.10, tier: 'Horizon', manifold_focus: 'generativity' },
            { strand: 'Philosophy of Language', weight: 0.15, tier: 'Horizon', manifold_focus: 'generativity' },
        ],
    },
    writing: {
        stat_name: 'writing',
        strands: [
            // TIER 1: FOUNDATION
            { strand: 'Organization & Purpose', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Evidence & Elaboration', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Conventions & Grammar', weight: 0.10, tier: 'Foundation', manifold_focus: 'coherence' },

            // TIER 2: BRIDGE
            { strand: 'Rhetoric & Persuasion', weight: 0.15, tier: 'Bridge', manifold_focus: 'non_dual_resolution' },
            { strand: 'Technical & Scientific Writing', weight: 0.10, tier: 'Bridge', manifold_focus: 'coherence' },

            // TIER 3: POWER
            { strand: 'Creative & Narrative Form', weight: 0.10, tier: 'Power', manifold_focus: 'generativity' },
            { strand: 'Journalism & Reportage', weight: 0.10, tier: 'Power', manifold_focus: 'non_dual_resolution' },

            // TIER 4: HORIZON
            { strand: 'Poetics & Prosody', weight: 0.15, tier: 'Horizon', manifold_focus: 'generativity' },
        ],
    },
    science: {
        stat_name: 'science',
        strands: [
            // TIER 1: FOUNDATION
            { strand: 'Physical Sciences (Newtonian)', weight: 0.10, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Life Sciences (Cellular)', weight: 0.10, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Earth & Space Sciences', weight: 0.10, tier: 'Foundation', manifold_focus: 'coherence' },

            // TIER 2: BRIDGE
            { strand: 'Thermodynamics & Stat Mech', weight: 0.05, tier: 'Bridge', manifold_focus: 'entropy_intuition' },
            { strand: 'Organic Chemistry', weight: 0.10, tier: 'Bridge', manifold_focus: 'fluidity' },
            { strand: 'Genetics & Epigenetics', weight: 0.10, tier: 'Bridge', manifold_focus: 'elasticity' },

            // TIER 3: POWER
            { strand: 'Relativity (Special & General)', weight: 0.10, tier: 'Power', manifold_focus: 'gradient_awareness' },
            { strand: 'Neuroscience & Cognition', weight: 0.10, tier: 'Power', manifold_focus: 'non_dual_resolution' },

            // TIER 4: HORIZON
            { strand: 'Quantum Mechanics', weight: 0.10, tier: 'Horizon', manifold_focus: 'non_dual_resolution' },
            { strand: 'Complexity Science', weight: 0.05, tier: 'Horizon', manifold_focus: 'entropy_intuition' },
            { strand: 'Astrophysics & Cosmology', weight: 0.10, tier: 'Horizon', manifold_focus: 'generativity' },
        ],
    },
    coding: {
        stat_name: 'coding',
        strands: [
            // TIER 1: FOUNDATION
            { strand: 'Algorithms & Logic', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Data Structures', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },

            // TIER 2: BRIDGE
            { strand: 'Systems & Architecture', weight: 0.10, tier: 'Bridge', manifold_focus: 'coherence' },
            { strand: 'Operating Systems & Kernels', weight: 0.10, tier: 'Bridge', manifold_focus: 'coherence' },

            // TIER 3: POWER
            { strand: 'Distributed Systems', weight: 0.10, tier: 'Power', manifold_focus: 'entropy_intuition' },
            { strand: 'Cryptography & Security', weight: 0.10, tier: 'Power', manifold_focus: 'non_dual_resolution' },

            // TIER 4: HORIZON
            { strand: 'Compiler Design & Languages', weight: 0.10, tier: 'Horizon', manifold_focus: 'generativity' },
            { strand: 'AI & Machine Learning Arch', weight: 0.10, tier: 'Horizon', manifold_focus: 'generativity' },
            { strand: 'Quantum Computing', weight: 0.10, tier: 'Horizon', manifold_focus: 'non_dual_resolution' },
        ],
    },
    critical_thinking: {
        stat_name: 'critical_thinking',
        strands: [
            // TIER 1: FOUNDATION
            { strand: 'Analysis & Evaluation', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Logic & Reasoning (Formal)', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },

            // TIER 2: BRIDGE
            { strand: 'Problem Solving Heuristics', weight: 0.15, tier: 'Bridge', manifold_focus: 'fluidity' },
            { strand: 'Cognitive Bias Mitigation', weight: 0.15, tier: 'Bridge', manifold_focus: 'elasticity' },

            // TIER 3: POWER
            { strand: 'Systems Thinking', weight: 0.15, tier: 'Power', manifold_focus: 'gradient_awareness' },
            { strand: 'Epistemology & Truth', weight: 0.15, tier: 'Power', manifold_focus: 'non_dual_resolution' },

            // TIER 4: HORIZON
            { strand: 'Strategic Forecasting', weight: 0.10, tier: 'Horizon', manifold_focus: 'entropy_intuition' },
        ],
    },
    technology: {
        stat_name: 'technology',
        strands: [
            { strand: 'Digital Literacy', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Network & Security', weight: 0.15, tier: 'Bridge', manifold_focus: 'coherence' },
            { strand: 'Hardware & Systems', weight: 0.15, tier: 'Bridge', manifold_focus: 'coherence' },
            { strand: 'AI & Machine Learning', weight: 0.20, tier: 'Power', manifold_focus: 'generativity' },
            { strand: 'Cybernetics & Interfaces', weight: 0.15, tier: 'Horizon', manifold_focus: 'elasticity' },
            { strand: 'Emerging Tech (Bio/Nano)', weight: 0.20, tier: 'Horizon', manifold_focus: 'generativity' },
        ],
    },
    study_skills: {
        stat_name: 'study_skills',
        strands: [
            { strand: 'Time Management', weight: 0.20, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Note Taking & Organization', weight: 0.20, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Test Taking Strategies', weight: 0.20, tier: 'Bridge', manifold_focus: 'coherence' },
            { strand: 'Metacognition', weight: 0.20, tier: 'Power', manifold_focus: 'elasticity' },
            { strand: 'Deep Work & Flow', weight: 0.20, tier: 'Horizon', manifold_focus: 'generativity' },
        ],
    },
    problem_solving: {
        stat_name: 'problem_solving',
        strands: [
            { strand: 'Problem Definition', weight: 0.20, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Strategy Formulation', weight: 0.20, tier: 'Bridge', manifold_focus: 'fluidity' },
            { strand: 'Execution & Monitoring', weight: 0.20, tier: 'Power', manifold_focus: 'coherence' },
            { strand: 'Evaluation & Reflection', weight: 0.20, tier: 'Power', manifold_focus: 'elasticity' },
            { strand: 'Lateral Thinking', weight: 0.20, tier: 'Horizon', manifold_focus: 'generativity' },
        ],
    },
    social_studies: {
        stat_name: 'social_studies',
        strands: [
            { strand: 'History (World & US)', weight: 0.20, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Geography & Geopolitics', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Civics & Government', weight: 0.15, tier: 'Bridge', manifold_focus: 'coherence' },
            { strand: 'Economics (Macro/Micro)', weight: 0.15, tier: 'Bridge', manifold_focus: 'gradient_awareness' },
            { strand: 'Sociology & Anthropology', weight: 0.15, tier: 'Power', manifold_focus: 'elasticity' },
            { strand: 'Philosophy & Ethics', weight: 0.20, tier: 'Horizon', manifold_focus: 'non_dual_resolution' },
        ],
    },
    financial_literacy: {
        stat_name: 'financial_literacy',
        strands: [
            { strand: 'Income & Careers', weight: 0.15, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Money Management', weight: 0.20, tier: 'Foundation', manifold_focus: 'coherence' },
            { strand: 'Credit & Debt', weight: 0.15, tier: 'Bridge', manifold_focus: 'coherence' },
            { strand: 'Investing & Risk', weight: 0.20, tier: 'Power', manifold_focus: 'entropy_intuition' },
            { strand: 'Global Markets', weight: 0.15, tier: 'Power', manifold_focus: 'gradient_awareness' },
            { strand: 'Crypto & DeFi', weight: 0.15, tier: 'Horizon', manifold_focus: 'generativity' },
        ],
    },
};

export function getBlueprint(statName: StatName): AssessmentBlueprint {
    return ASSESSMENT_BLUEPRINTS[statName] || {
        stat_name: statName,
        strands: [{ strand: 'General', weight: 1.0, tier: 'Foundation', manifold_focus: 'coherence' }],
    };
}
