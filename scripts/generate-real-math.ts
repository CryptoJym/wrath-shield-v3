
import { Database } from 'bun:sqlite';
import { v4 as uuidv4 } from 'uuid';

const db = new Database('data/wrath-shield.db');

/**
 * Generate unique distractors that don't duplicate
 */
function generateUniqueDistractors(correct: number, count: number = 3): number[] {
    const distractors = new Set<number>();
    const variations = [1, -1, 2, -2, 3, -3, 5, 10, -5];

    for (const v of variations) {
        if (distractors.size >= count) break;
        const dist = correct + v;
        if (dist !== correct && dist > 0) {
            distractors.add(dist);
        }
    }

    // Fill remaining with random if needed
    while (distractors.size < count) {
        const random = correct + Math.floor(Math.random() * 20) - 10;
        if (random !== correct && random > 0 && !distractors.has(random)) {
            distractors.add(random);
        }
    }

    return Array.from(distractors).slice(0, count);
}

// TIER 1: FOUNDATION (Arithmetic, Algebra I, Geometry)
function generateFoundationItems() {
    const items: any[] = [];

    // Arithmetic - Multiplication
    for (let i = 0; i < 5; i++) {
        const a = Math.floor(Math.random() * 10) + 3;
        const b = Math.floor(Math.random() * 10) + 3;
        const correct = a * b;
        const distractors = generateUniqueDistractors(correct);

        items.push({
            id: `math_found_arith_${uuidv4().slice(0, 8)}`,
            stat_name: 'math',
            topic: 'Arithmetic & Number Sense',
            prompt: `What is ${a} × ${b}?`,
            options: JSON.stringify({
                a: `${correct}`,
                b: `${distractors[0]}`,
                c: `${distractors[1]}`,
                d: `${distractors[2]}`
            }),
            correct: `${correct}`,
            difficulty: 0.2
        });
    }

    // Arithmetic - Division
    for (let i = 0; i < 5; i++) {
        const divisor = Math.floor(Math.random() * 8) + 2;
        const quotient = Math.floor(Math.random() * 10) + 2;
        const dividend = divisor * quotient;
        const distractors = generateUniqueDistractors(quotient);

        items.push({
            id: `math_found_div_${uuidv4().slice(0, 8)}`,
            stat_name: 'math',
            topic: 'Arithmetic & Number Sense',
            prompt: `What is ${dividend} ÷ ${divisor}?`,
            options: JSON.stringify({
                a: `${quotient}`,
                b: `${distractors[0]}`,
                c: `${distractors[1]}`,
                d: `${distractors[2]}`
            }),
            correct: `${quotient}`,
            difficulty: 0.2
        });
    }

    // Algebra I - Linear equations (ensuring x > 3 for distinct distractors)
    for (let i = 0; i < 10; i++) {
        const x = Math.floor(Math.random() * 10) + 4; // x from 4 to 13
        const m = Math.floor(Math.random() * 5) + 2;  // coefficient from 2 to 6
        const b = Math.floor(Math.random() * 10) + 1; // constant from 1 to 10
        const y = m * x + b;
        const distractors = generateUniqueDistractors(x);

        items.push({
            id: `math_found_alg1_${uuidv4().slice(0, 8)}`,
            stat_name: 'math',
            topic: 'Algebra I (Foundations)',
            prompt: `Solve for x: ${m}x + ${b} = ${y}`,
            options: JSON.stringify({
                a: `x = ${x}`,
                b: `x = ${distractors[0]}`,
                c: `x = ${distractors[1]}`,
                d: `x = ${distractors[2]}`
            }),
            correct: `x = ${x}`,
            difficulty: 0.3
        });
    }

    // Geometry basics
    const geometryBasics = [
        {
            prompt: "What is the area of a rectangle with length 8 and width 5?",
            correct: "40",
            distractors: ["45", "35", "13"]
        },
        {
            prompt: "What is the perimeter of a square with side length 6?",
            correct: "24",
            distractors: ["36", "12", "18"]
        },
        {
            prompt: "What is the area of a triangle with base 10 and height 6?",
            correct: "30",
            distractors: ["60", "16", "20"]
        },
    ];

    for (const q of geometryBasics) {
        items.push({
            id: `math_found_geom_${uuidv4().slice(0, 8)}`,
            stat_name: 'math',
            topic: 'Geometry & Spatial Reasoning',
            prompt: q.prompt,
            options: JSON.stringify({
                a: q.correct,
                b: q.distractors[0],
                c: q.distractors[1],
                d: q.distractors[2]
            }),
            correct: q.correct,
            difficulty: 0.3
        });
    }

    return items;
}

// TIER 2: BRIDGE (Algebra II, Trig, Pre-Calc)
function generateBridgeItems() {
    const items: any[] = [];

    // Trig - Exact values
    const trigQuestions = [
        { prompt: "What is the exact value of sin(30°)?", correct: "1/2", distractors: ["√3/2", "√2/2", "1"] },
        { prompt: "What is the exact value of cos(45°)?", correct: "√2/2", distractors: ["1/2", "√3/2", "1"] },
        { prompt: "What is the exact value of tan(45°)?", correct: "1", distractors: ["0", "√3", "undefined"] },
        { prompt: "What is the exact value of sin(90°)?", correct: "1", distractors: ["0", "-1", "undefined"] },
        { prompt: "What is the exact value of cos(60°)?", correct: "1/2", distractors: ["√3/2", "√2/2", "0"] },
    ];

    for (const q of trigQuestions) {
        items.push({
            id: `math_bridge_trig_${uuidv4().slice(0, 8)}`,
            stat_name: 'math',
            topic: 'Trigonometry & Cycles',
            prompt: q.prompt,
            options: JSON.stringify({
                a: q.correct,
                b: q.distractors[0],
                c: q.distractors[1],
                d: q.distractors[2]
            }),
            correct: q.correct,
            difficulty: 0.5
        });
    }

    // Algebra II - Quadratics
    const quadratics = [
        { prompt: "What are the solutions to x² - 5x + 6 = 0?", correct: "x = 2, x = 3", distractors: ["x = 1, x = 6", "x = -2, x = -3", "x = 2, x = -3"] },
        { prompt: "What is the vertex form of y = x² - 4x + 3?", correct: "y = (x-2)² - 1", distractors: ["y = (x-2)² + 3", "y = (x+2)² - 1", "y = (x-4)² + 3"] },
        { prompt: "Factor: x² - 9", correct: "(x+3)(x-3)", distractors: ["(x+9)(x-1)", "(x+3)(x+3)", "(x-3)(x-3)"] },
    ];

    for (const q of quadratics) {
        items.push({
            id: `math_bridge_quad_${uuidv4().slice(0, 8)}`,
            stat_name: 'math',
            topic: 'Algebra II & Functions',
            prompt: q.prompt,
            options: JSON.stringify({
                a: q.correct,
                b: q.distractors[0],
                c: q.distractors[1],
                d: q.distractors[2]
            }),
            correct: q.correct,
            difficulty: 0.5
        });
    }

    // Pre-Calculus - Limits conceptual
    const precalc = [
        { prompt: "What is lim(x→2) of (x² - 4)/(x - 2)?", correct: "4", distractors: ["0", "2", "undefined"] },
        { prompt: "What is lim(x→∞) of 1/x?", correct: "0", distractors: ["1", "∞", "undefined"] },
    ];

    for (const q of precalc) {
        items.push({
            id: `math_bridge_precalc_${uuidv4().slice(0, 8)}`,
            stat_name: 'math',
            topic: 'Pre-Calculus & Limits',
            prompt: q.prompt,
            options: JSON.stringify({
                a: q.correct,
                b: q.distractors[0],
                c: q.distractors[1],
                d: q.distractors[2]
            }),
            correct: q.correct,
            difficulty: 0.6
        });
    }

    return items;
}

// TIER 3: POWER (Calculus)
function generatePowerItems() {
    const items = [];

    // Derivatives
    items.push({
        id: `math_power_calc1_${uuidv4().slice(0, 8)}`,
        stat_name: 'math',
        topic: 'Calculus I (Differential)',
        prompt: "Find the derivative of f(x) = x².",
        options: JSON.stringify({
            a: "2x",
            b: "x",
            c: "2",
            d: "x³"
        }),
        correct: "2x",
        difficulty: 0.7
    });

    items.push({
        id: `math_power_calc1_2_${uuidv4().slice(0, 8)}`,
        stat_name: 'math',
        topic: 'Calculus I (Differential)',
        prompt: "Find the derivative of f(x) = sin(x).",
        options: JSON.stringify({
            a: "cos(x)",
            b: "-cos(x)",
            c: "sin(x)",
            d: "-sin(x)"
        }),
        correct: "cos(x)",
        difficulty: 0.7
    });

    return items;
}

// TIER 4: HORIZON (Advanced)
function generateHorizonItems() {
    const items = [];

    // Linear Algebra / Tensors (Conceptual)
    items.push({
        id: `math_horizon_tensor_${uuidv4().slice(0, 8)}`,
        stat_name: 'math',
        topic: 'Tensor Analysis & Manifolds',
        prompt: "What is the rank of a scalar in tensor notation?",
        options: JSON.stringify({
            a: "Rank 0",
            b: "Rank 1",
            c: "Rank 2",
            d: "Rank 3"
        }),
        correct: "Rank 0",
        difficulty: 0.9
    });

    return items;
}

const allItems = [
    ...generateFoundationItems(),
    ...generateBridgeItems(),
    ...generatePowerItems(),
    ...generateHorizonItems()
];

console.log(`Generated ${allItems.length} real math items.`);

const stmt = db.prepare(`
  INSERT OR IGNORE INTO hyro_diagnostic_questions (id, stat_name, topic, question_text, options, correct_answer, difficulty_level, question_type)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'multiple_choice')
`);

db.transaction(() => {
    for (const item of allItems) {
        stmt.run(item.id, item.stat_name, item.topic, item.prompt, item.options, item.correct, item.difficulty);
    }
})();

console.log('Inserted items into database.');
