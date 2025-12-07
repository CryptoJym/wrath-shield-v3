
import { generateInterviewQuestion, evaluateResponse } from '@/lib/hyro/forge-ai-tutor';

async function main() {
    const standardId = '6.RL.2'; // "Determine a theme or central idea..."

    console.log(`Testing Interview for Standard: ${standardId}`);

    // 1. Generate Question
    try {
        const q = await generateInterviewQuestion(standardId, []);
        console.log('Generated Question:', q);

        if (!q.question) throw new Error("No question generated");

        // 2. Evaluate "Good" Response
        const goodAnswer = "The theme is that perseverance pays off, because the main character keeps trying despite failure.";
        console.log(`Evaluating Good Answer: "${goodAnswer}"`);
        const resultGood = await evaluateResponse(standardId, q.question, goodAnswer);
        console.log('Result (Good):', resultGood);

        // 3. Evaluate "Bad" Response
        const badAnswer = "The book was blue.";
        console.log(`Evaluating Bad Answer: "${badAnswer}"`);
        const resultBad = await evaluateResponse(standardId, q.question, badAnswer);
        console.log('Result (Bad):', resultBad);

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

main();
