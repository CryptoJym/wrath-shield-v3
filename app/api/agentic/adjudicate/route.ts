import { NextRequest, NextResponse } from 'next/server';
import { adjudicateItem } from '@/lib/ea/adjudicator';
import { getAgenticActionById, updateAgenticActionStatusWithMeta } from '@/lib/db/queries';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, content, source, hint } = body;

        if (!id && !content) {
            return NextResponse.json({ error: 'id or content required' }, { status: 400 });
        }

        let textToAnalyze = content;
        let itemSource = source || 'unknown';

        // If ID provided, fetch from DB
        if (id) {
            const action = getAgenticActionById(id);
            if (action) {
                textToAnalyze = action.content || action.title;
                itemSource = action.type;
            }
        }

        if (!textToAnalyze) {
            return NextResponse.json({ error: 'No content to analyze' }, { status: 400 });
        }

        // Run AI Adjudication
        const result = await adjudicateItem(textToAnalyze, itemSource, hint);

        // If we have an ID, update the item status/metadata
        if (id) {

            // Map AI result to status
            let newStatus = 'queued'; // Default
            if (result.action === 'archive') newStatus = 'dismissed';

            // Use 'executed' only if we add auto-execute logic later
            // if (result.action === 'execute') newStatus = 'executed'; 

            await updateAgenticActionStatusWithMeta(id, newStatus as any, {
                adjudication: result,
                reason: result.reasoning
            });
        }

        return NextResponse.json({ ok: true, result });

    } catch (e: any) {
        console.error('Adjudication API Error', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
