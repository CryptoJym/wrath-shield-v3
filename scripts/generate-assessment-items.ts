import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Types for our generation templates
type ItemTemplate = {
    stat_name: string;
    constructs: string[];
    difficulty_range: [number, number]; // 0-1
    generate: () => { prompt: string; options?: Record<string, string>; correct: string; rubric?: any };
};

const TEMPLATES: ItemTemplate[] = [
    // --- MATHEMATICS ---
    {
        stat_name: 'Mathematics',
        constructs: ['algebra', 'linear_equations'],
        difficulty_range: [0.3, 0.6],
        generate: () => {
            const a = Math.floor(Math.random() * 9) + 2; // 2-10
            const x = Math.floor(Math.random() * 10) + 1; // 1-10
            const b = Math.floor(Math.random() * 20) + 1; // 1-20
            const c = a * x + b;

            return {
                prompt: `Solve for x: ${a}x + ${b} = ${c}`,
                options: {
                    a: `x = ${x - 1}`,
                    b: `x = ${x}`,
                    c: `x = ${x + 1}`,
                    d: `x = ${Math.floor(c / a)}`
                },
                correct: 'b'
            };
        }
    },
    {
        stat_name: 'Mathematics',
        constructs: ['arithmetic', 'percentages'],
        difficulty_range: [0.4, 0.7],
        generate: () => {
            const total = Math.floor(Math.random() * 10) * 10 + 50; // 50, 60... 140
            const percent = Math.floor(Math.random() * 4) * 10 + 10; // 10, 20, 30, 40
            const answer = (total * percent) / 100;

            return {
                prompt: `What is ${percent}% of ${total}?`,
                options: {
                    a: `${answer - 5}`,
                    b: `${answer + 10}`,
                    c: `${answer}`,
                    d: `${answer * 2}`
                },
                correct: 'c'
            };
        }
    },
    // --- READING ---
    {
        stat_name: 'Reading',
        constructs: ['vocabulary', 'context_clues'],
        difficulty_range: [0.4, 0.8],
        generate: () => {
            const words = [
                { word: 'ephemeral', context: 'The joy of the victory was ephemeral, fading as quickly as the setting sun.', correct: 'short-lived', distractor: 'eternal' },
                { word: 'meticulous', context: 'She was meticulous in her work, checking every detail three times.', correct: 'very careful', distractor: 'sloppy' },
                { word: 'pragmatic', context: 'His pragmatic approach solved the problem efficiently, ignoring theoretical debates.', correct: 'practical', distractor: 'idealistic' }
            ];
            const selected = words[Math.floor(Math.random() * words.length)];

            return {
                prompt: `In the sentence: "${selected.context}", what does the word "${selected.word}" most likely mean?`,
                options: {
                    a: selected.distractor,
                    b: selected.correct,
                    c: 'confusing',
                    d: 'irrelevant'
                },
                correct: 'b'
            };
        }
    },
    // --- CRITICAL THINKING ---
    {
        stat_name: 'Critical Thinking',
        constructs: ['logic', 'deduction'],
        difficulty_range: [0.5, 0.9],
        generate: () => {
            const scenarios = [
                { p1: 'All birds have feathers', p2: 'Penguins are birds', concl: 'Penguins have feathers', valid: true },
                { p1: 'If it rains, the ground is wet', p2: 'The ground is wet', concl: 'It rained', valid: false },
            ];
            const selected = scenarios[Math.floor(Math.random() * scenarios.length)];

            return {
                prompt: `Premise 1: ${selected.p1}. Premise 2: ${selected.p2}. Conclusion: ${selected.concl}. Is this argument logically valid?`,
                options: {
                    a: 'Yes',
                    b: 'No',
                },
                correct: selected.valid ? 'a' : 'b'
            };
        }
    }
];

function generateSQL() {
    const items: string[] = [];
    const TOTAL_ITEMS_PER_DOMAIN = 50;

    console.log(`Generating ${TOTAL_ITEMS_PER_DOMAIN} items per domain template...`);

    TEMPLATES.forEach(template => {
        for (let i = 0; i < 20; i++) { // Generate 20 variations per template
            const data = template.generate();
            const id = `${template.stat_name.toLowerCase().substring(0, 4)}_${randomUUID().substring(0, 8)}`;
            const difficulty = Math.random() * (template.difficulty_range[1] - template.difficulty_range[0]) + template.difficulty_range[0];

            // Escape single quotes for SQL
            const prompt = data.prompt.replace(/'/g, "''");
            const options = JSON.stringify(data.options).replace(/'/g, "''");

            const sql = `(
  '${id}', 
  '${template.stat_name}', 
  'mcq', 
  'text', 
  ${difficulty.toFixed(2)}, 
  '${JSON.stringify(template.constructs)}', 
  '${prompt}', 
  '${options}', 
  '${data.correct}', 
  NULL
)`;
            items.push(sql);
        }
    });

    const output = `
-- ============================================================================
-- SEED COMPREHENSIVE ITEMS
-- Migration 051: Procedurally generated item bank
-- Generated at: ${new Date().toISOString()}
-- ============================================================================

INSERT OR IGNORE INTO hyro_diagnostic_items_v2 (
  id, stat_name, item_type, modality, difficulty, constructs_measured,
  prompt, options, correct_answer, scoring_rubric
) VALUES
${items.join(',\n')};
`;

    const outputPath = path.resolve(process.cwd(), 'migrations', '051_seed_comprehensive_items.sql');
    fs.writeFileSync(outputPath, output);
    console.log(`Generated ${items.length} items to ${outputPath}`);
}

generateSQL();
