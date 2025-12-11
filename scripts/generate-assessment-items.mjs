import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STANDARDS_DIR = path.join(__dirname, '../data/standards');
const OUTPUT_FILE = path.join(__dirname, '../migrations/054_seed_remaining_items.sql');

// Map domains to test IDs
const DOMAIN_TEST_MAP = {
    'Mathematics': 'diag-math',
    'Reading': 'diag-reading',
    'Science': 'diag-science',
    'Critical Thinking': 'diag-critical',
    'Writing': 'diag-writing',
    'Coding': 'diag-coding',
    'Technology': 'diag-tech',
    'Study Skills': 'diag-study',
    'Problem Solving': 'diag-problem'
};

// Synthetic Standards for domains without JSON files
const SYNTHETIC_STANDARDS = {
    'Writing': [
        // Argumentation
        { id: 'W.ARG.1', description: 'Introduce claim(s) and organize the reasons and evidence clearly.' },
        { id: 'W.ARG.2', description: 'Support claim(s) with clear reasons and relevant evidence, using credible sources.' },
        { id: 'W.ARG.3', description: 'Use words, phrases, and clauses to clarify the relationships among claim(s) and reasons.' },
        // Informative
        { id: 'W.INF.1', description: 'Introduce a topic; organize ideas, concepts, and information using strategies such as definition and classification.' },
        { id: 'W.INF.2', description: 'Develop the topic with relevant facts, definitions, concrete details, quotations, or other information.' },
        { id: 'W.INF.3', description: 'Use appropriate transitions to clarify the relationships among ideas and concepts.' },
        // Narrative
        { id: 'W.NAR.1', description: 'Engage and orient the reader by establishing a context and introducing a narrator and/or characters.' },
        { id: 'W.NAR.2', description: 'Use narrative techniques, such as dialogue, pacing, and description, to develop experiences.' },
        { id: 'W.NAR.3', description: 'Use a variety of transition words, phrases, and clauses to convey sequence and signal shifts.' },
        // Language & Grammar
        { id: 'L.GRAM.1', description: 'Ensure subject-verb and pronoun-antecedent agreement.' },
        { id: 'L.GRAM.2', description: 'Recognize and correct inappropriate shifts in pronoun number and person.' },
        { id: 'L.GRAM.3', description: 'Recognize and correct vague pronouns (i.e., ones with unclear or ambiguous antecedents).' },
        { id: 'L.PUNC.1', description: 'Use punctuation (commas, parentheses, dashes) to set off nonrestrictive/parenthetical elements.' },
        { id: 'L.PUNC.2', description: 'Use a comma to separate coordinate adjectives.' },
        // Process
        { id: 'W.PROC.1', description: 'Plan writing by identifying the task, purpose, and audience.' },
        { id: 'W.PROC.2', description: 'Revise writing to improve clarity, coherence, and style.' },
        { id: 'W.PROC.3', description: 'Edit writing for standard English conventions.' }
    ],
    'Coding': [
        // Agentic IDEs & Workflows
        { id: 'AC.IDE.1', description: 'Leverage "Composer" and "YOLO" modes in Cursor/Windsurf for multi-file agentic refactoring.' },
        { id: 'AC.IDE.2', description: 'Debug agentic "loops" where an IDE agent gets stuck in a verification failure cycle.' },
        { id: 'AC.IDE.3', description: 'Utilize "Semantic Diffs" to review AI-proposed changes that span across the entire codebase.' },
        // Advanced Tooling
        { id: 'AC.MCP.1', description: 'Implement a custom MCP (Model Context Protocol) server to expose a local vector DB to Claude/Gemini.' },
        { id: 'AC.MCP.2', description: 'Troubleshoot SSE (Server-Sent Events) transport issues in high-latency MCP connections.' },
        { id: 'AC.SANDBOX.1', description: 'Configure secure, ephemeral Docker sandboxes for agents to execute untrusted code.' },
        // Agent Orchestration
        { id: 'AC.ORCH.1', description: 'Architect a "Swarm" of specialized agents (Planner, Coder, Reviewer) using LangGraph or similar frameworks.' },
        { id: 'AC.ORCH.2', description: 'Implement "Human-in-the-loop" breakpoints for critical agent decisions.' }
    ],
    'Technology': [
        // Frontier Models (Dec 2024+)
        { id: 'AI.MOD.1', description: 'Evaluate Gemini 2.0 Flash Thinking against OpenAI o1 for reasoning-heavy tasks.' },
        { id: 'AI.MOD.2', description: 'Understand the implications of "Test-Time Compute" scaling laws (o1, Q*).' },
        { id: 'AI.MOD.3', description: 'Compare "Multimodal Native" architectures (Gemini 2.0) vs. "Bolt-on" vision adapters.' },
        // Post-Transformer Architectures
        { id: 'AI.ARCH.1', description: 'Explain the efficiency gains of SSMs (State Space Models) like Mamba/Jamba over Transformers for long context.' },
        { id: 'AI.ARCH.2', description: 'Discuss "Mixture of Depths" and dynamic compute allocation per token.' },
        // Hardware & Edge
        { id: 'AI.HW.1', description: 'Optimize local inference for Llama 4 on Apple Silicon (M4) using MLX.' },
        { id: 'AI.HW.2', description: 'Understand the bandwidth bottlenecks in HBM3e for training trillion-parameter models.' }
    ],
    'Problem Solving': [
        // Flow Engineering
        { id: 'PS.FLOW.1', description: 'Transition from "Prompt Engineering" to "Flow Engineering": Designing cyclic graphs for agent reasoning.' },
        { id: 'PS.FLOW.2', description: 'Implement "Self-Correction" loops where an agent critiques and refines its own output.' },
        { id: 'PS.FLOW.3', description: 'Design a "Tree of Thoughts" search strategy for complex planning tasks.' },
        // System Debugging
        { id: 'PS.DEBUG.1', description: 'Debug "Reward Hacking" where an agent satisfies a metric but fails the intent.' },
        { id: 'PS.DEBUG.2', description: 'Identify "Sycophancy" in RLHF-tuned models and mitigate it via system prompts.' }
    ],
    'Critical Thinking': [
        // Analysis
        { id: 'CT.ANA.1', description: 'Identify the main premise and supporting arguments in a text.' },
        { id: 'CT.ANA.2', description: 'Differentiate between fact, opinion, and reasoned judgment.' },
        { id: 'CT.ANA.3', description: 'Analyze how an author uses rhetoric to advance a point of view.' },
        // Evaluation
        { id: 'CT.EVAL.1', description: 'Evaluate the reliability and bias of a source.' },
        { id: 'CT.EVAL.2', description: 'Assess the strength of evidence supporting a claim.' },
        { id: 'CT.EVAL.3', description: 'Identify gaps or inconsistencies in an argument.' },
        // Synthesis
        { id: 'CT.SYN.1', description: 'Integrate information from multiple sources to form a coherent understanding.' },
        { id: 'CT.SYN.2', description: 'Construct a counter-argument to a given position.' }
    ]
};

function generateItem(standard, domain) {
    const id = crypto.randomUUID();
    const testId = DOMAIN_TEST_MAP[domain] || 'diag-general';

    // Template-based generation (simplified for this script)
    const prompt = `Question based on standard ${standard.id}: ${standard.description}`;

    const options = [
        "Correct Answer based on standard",
        "Distractor 1 (Plausible but wrong)",
        "Distractor 2 (Common misconception)",
        "Distractor 3 (Clearly incorrect)"
    ];

    // Shuffle options
    const shuffledOptions = options.sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf("Correct Answer based on standard");
    const correctValue = shuffledOptions[correctIndex];

    // Generate a slightly more specific prompt based on domain
    let specificPrompt = prompt;
    if (domain === 'Coding') {
        specificPrompt = `Which code snippet best demonstrates: ${standard.description}?`;
    } else if (domain === 'Writing') {
        specificPrompt = `Which sentence best exemplifies: ${standard.description}?`;
    }

    return {
        id,
        test_id: testId,
        stat_name: domain.toLowerCase().replace(' ', '_'),
        question_text: specificPrompt,
        question_type: 'multiple_choice',
        options: JSON.stringify(shuffledOptions),
        correct_answer: correctValue,
        explanation: `This answer correctly demonstrates ${standard.id}.`,
        difficulty_level: parseFloat((Math.random() * 0.8 + 0.1).toFixed(2)), // 0.1 to 0.9
        topic: standard.id,
        source: 'generated_v3'
    };
}

function escapeSql(str) {
    return str.replace(/'/g, "''");
}

async function main() {
    console.log('Generating assessment items for remaining domains...');

    let sql = `-- MIGRATION 054: Seed Remaining Assessment Items\n`;
    sql += `INSERT INTO hyro_diagnostic_questions (id, test_id, stat_name, question_text, question_type, options, correct_answer, explanation, difficulty_level, topic, source) VALUES\n`;

    const items = [];

    // Generate items for synthetic standards
    for (const [domain, standards] of Object.entries(SYNTHETIC_STANDARDS)) {
        console.log(`Processing ${domain}...`);
        for (const standard of standards) {
            // Generate 10 items per standard to ensure coverage
            for (let i = 0; i < 10; i++) {
                items.push(generateItem(standard, domain));
            }
        }
    }

    // Format SQL values
    const values = items.map(item => {
        return `('${item.id}', '${item.test_id}', '${item.stat_name}', '${escapeSql(item.question_text)}', '${item.question_type}', '${escapeSql(item.options)}', '${escapeSql(item.correct_answer)}', '${escapeSql(item.explanation)}', ${item.difficulty_level}, '${escapeSql(item.topic)}', '${item.source}')`;
    });

    sql += values.join(',\n') + ';\n';

    fs.writeFileSync(OUTPUT_FILE, sql);
    console.log(`Generated ${items.length} items. SQL written to ${OUTPUT_FILE}`);
}

main().catch(console.error);
