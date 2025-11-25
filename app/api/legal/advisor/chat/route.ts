import { NextRequest, NextResponse } from 'next/server';
import { saveChatMessage, listChatMessages } from '@/lib/legal/store';
import { chat, LegalContext } from '@/lib/legal/LegalAdvisorLLM';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Load context from scraped data
function loadCaseContext(): LegalContext {
  const scrapersPath = path.resolve(process.cwd(), 'packages', 'legal-scrapers', 'scraped_data');

  const context: LegalContext = {
    caseNumber: '164400524',
    nextHearing: null,
    judge: null,
    parties: [],
    recentEmails: [],
    recentTexts: [],
    timeline: [],
    strategicBrief: null,
  };

  // Load court data from MyCase scrape
  try {
    const mycaseFiles = fs.existsSync(scrapersPath)
      ? fs.readdirSync(scrapersPath)
          .filter(f => f.startsWith('mycase_data_') && f.endsWith('.json'))
          .sort()
          .reverse()
      : [];

    if (mycaseFiles.length > 0) {
      const data = JSON.parse(fs.readFileSync(path.join(scrapersPath, mycaseFiles[0]), 'utf-8'));
      const rawText = data.raw_text || '';

      // Parse case details
      const caseMatch = rawText.match(/Case Number:\s*\n?\s*(\d+)/);
      if (caseMatch) context.caseNumber = caseMatch[1];

      const judgeMatch = rawText.match(/Assigned Judge:\s*\n?\s*([A-Z\s]+?)(?:\n|$)/);
      if (judgeMatch) context.judge = judgeMatch[1].trim();

      const hearingMatch = rawText.match(/Next Hearing:\s*\n?\s*([\d-]+)\s+([\d:]+\s*[AP]M)/i);
      if (hearingMatch) {
        context.nextHearing = { date: hearingMatch[1], time: hearingMatch[2] };
      }

      // Parse parties from table_0 if available
      if (data.table_0 && Array.isArray(data.table_0)) {
        for (let i = 1; i < data.table_0.length; i++) {
          const row = data.table_0[i];
          if (row && row.length >= 2) {
            context.parties.push({
              type: row[0] || '',
              name: row[1] || '',
              attorney: row[2] || null,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('[LegalAdvisor] Failed to load court data:', e);
  }

  // Load strategic brief
  try {
    const analysisDir = path.join(scrapersPath, 'analysis');
    if (fs.existsSync(analysisDir)) {
      const briefFiles = fs.readdirSync(analysisDir)
        .filter(f => f.startsWith('strategic_brief_') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (briefFiles.length > 0) {
        context.strategicBrief = JSON.parse(fs.readFileSync(path.join(analysisDir, briefFiles[0]), 'utf-8'));
      }
    }
  } catch (e) {
    console.error('[LegalAdvisor] Failed to load strategic brief:', e);
  }

  // Helper to normalize dates/timestamps
  const normalizeDate = (d: any): string => {
    if (!d) return '';
    if (typeof d === 'number') {
      return new Date(d > 1e12 ? d : d * 1000).toISOString();
    }
    if (typeof d === 'string' && /^\d+(\.\d+)?$/.test(d)) {
      const ts = parseFloat(d);
      return new Date(ts > 1e12 ? ts : ts * 1000).toISOString();
    }
    return d;
  };

  // Load ALL available data (no cutoff - data may be stale but dates are visible)

  // Load emails with legal relevance filtering
  try {
    const emailFiles = ['zack_emails_current.json', 'gmail_current_emails.json', 'gmail_destiny_messages.json'];
    const scrapersRoot = path.resolve(process.cwd(), 'packages', 'legal-scrapers');

    // Helper to check if email is case-relevant
    const isLegalRelevant = (from: string, subject: string, body: string): boolean => {
      const text = `${from} ${subject} ${body}`.toLowerCase();
      const legalKeywords = [
        'zstarr', 'moodybrown', 'starr', 'zachary',  // Attorney
        'destinyhyte', 'destiny', 'hyte',            // Ex-wife
        'hyro', 'custody', 'parent', 'hearing',      // Case terms
        'court', 'modification', 'child support',
      ];
      return legalKeywords.some(kw => text.includes(kw));
    };

    const legalEmails: typeof context.recentEmails = [];
    const otherEmails: typeof context.recentEmails = [];

    for (const emailFile of emailFiles) {
      const filePath = path.join(scrapersRoot, emailFile);
      if (fs.existsSync(filePath)) {
        const emails = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(emails)) {
          for (const e of emails) {
            const isoDate = normalizeDate(e.timestamp || e.date || e.ts);
            const from = e.from || e.sender || 'Unknown';
            const subject = e.subject || 'No subject';
            const body = e.body || e.snippet || '';

            const emailObj = {
              from,
              subject,
              snippet: e.snippet || body?.slice(0, 200) || '',
              date: isoDate,
            };

            if (isLegalRelevant(from, subject, body)) {
              legalEmails.push(emailObj);
            } else {
              otherEmails.push(emailObj);
            }
          }
        }
      }
    }

    // Sort by date and prioritize legal emails
    legalEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    otherEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Prioritize legal-relevant emails (up to 8), fill with others (up to 2)
    context.recentEmails = [
      ...legalEmails.slice(0, 8),
      ...otherEmails.slice(0, 2),
    ];
  } catch (e) {
    console.error('[LegalAdvisor] Failed to load emails:', e);
  }

  // Load texts with proper timestamp handling
  try {
    const scrapersRoot = path.resolve(process.cwd(), 'packages', 'legal-scrapers');
    const textFiles = fs.readdirSync(scrapersRoot)
      .filter(f => f.toLowerCase().includes('destiny') && (f.endsWith('.json') || f.endsWith('.jsonl')));

    for (const textFile of textFiles) {
      const content = fs.readFileSync(path.join(scrapersRoot, textFile), 'utf-8');

      // Handle JSONL or newline-delimited JSON
      if (textFile.endsWith('.jsonl') || content.includes('\n{')) {
        for (const line of content.split('\n')) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line);
              const isoDate = normalizeDate(msg.ts || msg.timestamp || msg.date);
              if (!msg.text?.trim()) continue;

              context.recentTexts.push({
                text: msg.text || msg.content || '',
                date: isoDate,
                from: msg.is_from_me === true || msg.is_from_me === 1 ? 'James' : 'Destiny',
              });
            } catch {}
          }
        }
      } else {
        const texts = JSON.parse(content);
        if (Array.isArray(texts)) {
          for (const t of texts) {
            const isoDate = normalizeDate(t.ts || t.timestamp || t.date);
            if (!t.text?.trim()) continue;

            context.recentTexts.push({
              text: t.text || t.content || '',
              date: isoDate,
              from: t.is_from_me === true || t.is_from_me === 1 ? 'James' : 'Destiny',
            });
          }
        }
      }
    }
    // Sort newest first and limit
    context.recentTexts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    context.recentTexts = context.recentTexts.slice(0, 20);
  } catch (e) {
    console.error('[LegalAdvisor] Failed to load texts:', e);
  }

  return context;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Save user message
    saveChatMessage({
      user_id: 'default',
      role: 'user',
      content: message,
    });

    // Load case context
    const context = loadCaseContext();

    // Get chat history
    const chatHistory = listChatMessages('default', 20).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Call real AI
    const result = await chat(message, context, chatHistory);

    // Save assistant response
    saveChatMessage({
      user_id: 'default',
      role: 'assistant',
      content: result.response,
      metadata: {
        suggestedActions: result.suggestedActions,
        evidenceUsed: result.evidenceUsed,
        memoryUpdated: result.memoryUpdated,
      },
    });

    return NextResponse.json({
      response: result.response,
      suggestedResponses: result.suggestedActions,
      evidenceUsed: result.evidenceUsed,
      memoryUpdated: result.memoryUpdated,
    });
  } catch (error: any) {
    console.error('[LegalAdvisor] Chat error:', error);

    // Return a helpful error with fallback
    return NextResponse.json({
      response: `I apologize, but I encountered an issue processing your request. Error: ${error.message}\n\nPlease ensure your OpenRouter API key is configured. In the meantime, you can review the strategic brief for case information.`,
      suggestedResponses: [
        'Show me the case status',
        'What documents do I have?',
        'Check system configuration',
      ],
      error: error.message,
    }, { status: error.message.includes('not configured') ? 503 : 500 });
  }
}
