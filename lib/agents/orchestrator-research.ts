/**
 * Orchestrator Research Module
 *
 * Provides web search and research capabilities for the Orchestrator agent.
 * Retained from the original Grok agent functionality.
 *
 * Capabilities:
 * - Web search via xAI or OpenRouter
 * - Research synthesis
 * - Fact checking
 * - Research recording to memory
 */

import { ensureServerOnly } from '../server-only-guard';
import {
  addAgentMemory,
  searchAgentMemory,
  type AgentId,
} from '../memory/zep';

// Prevent client-side imports
ensureServerOnly('lib/agents/orchestrator-research');

const ORCHESTRATOR_AGENT_ID: AgentId = 'orchestrator-agent';

export interface WebSearchOptions {
  maxResults?: number;
  recency?: 'day' | 'week' | 'month' | 'year' | 'any';
  domains?: string[];
  excludeDomains?: string[];
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  publishedDate?: string;
}

export interface ResearchSummary {
  query: string;
  results: SearchResult[];
  synthesis: string;
  confidence: number;
  sources: string[];
  timestamp: string;
}

/**
 * Perform a web search using available LLM provider
 */
export async function webSearch(
  query: string,
  options: WebSearchOptions = {}
): Promise<SearchResult[]> {
  const { maxResults = 5 } = options;

  // Check for xAI API key (Grok has web search capabilities)
  const xaiKey = process.env.XAI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!xaiKey && !openaiKey && !openrouterKey) {
    console.warn('[OrchestratorResearch] No API keys configured for web search');
    return [];
  }

  try {
    // Use xAI/Grok if available (has native search)
    if (xaiKey) {
      return await searchWithXAI(query, maxResults, xaiKey);
    }

    // Fall back to OpenAI with function calling
    if (openaiKey) {
      return await searchWithOpenAI(query, maxResults, openaiKey);
    }

    // Fall back to OpenRouter
    if (openrouterKey) {
      return await searchWithOpenRouter(query, maxResults, openrouterKey);
    }

    return [];
  } catch (error) {
    console.error('[OrchestratorResearch] Web search failed:', error);
    return [];
  }
}

/**
 * Search using xAI/Grok (has native web search)
 */
async function searchWithXAI(
  query: string,
  maxResults: number,
  apiKey: string
): Promise<SearchResult[]> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL || 'grok-2-latest',
      messages: [
        {
          role: 'system',
          content: `You are a research assistant. Search the web for information and return results as JSON.

Return format:
{
  "results": [
    {
      "title": "Page Title",
      "url": "https://example.com",
      "snippet": "Brief description of the content",
      "source": "source name",
      "publishedDate": "2024-01-15"
    }
  ]
}

Limit to ${maxResults} most relevant results.`
        },
        {
          role: 'user',
          content: `Search for: ${query}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`xAI search failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    return (parsed.results || []).slice(0, maxResults);
  } catch {
    return [];
  }
}

/**
 * Search using OpenAI
 */
async function searchWithOpenAI(
  query: string,
  maxResults: number,
  apiKey: string
): Promise<SearchResult[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.1',
      messages: [
        {
          role: 'system',
          content: `You are a research assistant. Based on your knowledge, provide relevant search-like results for the query.

Return format as JSON:
{
  "results": [
    {
      "title": "Relevant Topic Title",
      "url": "https://example.com (use real URLs when possible)",
      "snippet": "Brief description of the content",
      "source": "source name"
    }
  ]
}

Limit to ${maxResults} most relevant results. Use real, accurate URLs when you know them.`
        },
        {
          role: 'user',
          content: `Find information about: ${query}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI search failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    return (parsed.results || []).slice(0, maxResults);
  } catch {
    return [];
  }
}

/**
 * Search using OpenRouter
 */
async function searchWithOpenRouter(
  query: string,
  maxResults: number,
  apiKey: string
): Promise<SearchResult[]> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'wrath-shield-v3',
      'X-Title': 'orchestrator-research',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: `You are a research assistant. Based on your knowledge, provide relevant search-like results.

Return as JSON:
{
  "results": [
    {
      "title": "Topic Title",
      "url": "https://example.com",
      "snippet": "Brief description",
      "source": "source name"
    }
  ]
}

Limit to ${maxResults} results.`
        },
        {
          role: 'user',
          content: `Find information about: ${query}`
        }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter search failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) return [];

  try {
    // Try to extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.results || []).slice(0, maxResults);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Synthesize research from multiple sources
 */
export async function synthesizeResearch(
  topic: string,
  sources: SearchResult[]
): Promise<ResearchSummary> {
  const timestamp = new Date().toISOString();

  if (sources.length === 0) {
    return {
      query: topic,
      results: [],
      synthesis: `No sources found for: ${topic}`,
      confidence: 0,
      sources: [],
      timestamp,
    };
  }

  // Use available LLM for synthesis
  const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      query: topic,
      results: sources,
      synthesis: sources.map(s => s.snippet).join('\n\n'),
      confidence: 0.5,
      sources: sources.map(s => s.url),
      timestamp,
    };
  }

  const sourceContext = sources.map((s, i) =>
    `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`
  ).join('\n\n');

  try {
    const response = await fetch(
      process.env.XAI_API_KEY ? 'https://api.x.ai/v1/chat/completions' :
        process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1/chat/completions' :
          'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(process.env.OPENROUTER_API_KEY && !process.env.XAI_API_KEY && !process.env.OPENAI_API_KEY
            ? { 'HTTP-Referer': 'wrath-shield-v3', 'X-Title': 'orchestrator-research' }
            : {}),
        },
        body: JSON.stringify({
          model: process.env.XAI_API_KEY ? 'grok-2-latest' :
            process.env.OPENAI_API_KEY ? 'gpt-4o' : 'anthropic/claude-3.5-sonnet',
          messages: [
            {
              role: 'system',
              content: `Synthesize the following sources into a coherent summary about "${topic}".
Be concise, accurate, and cite sources by number. Rate your confidence (0-1) based on source quality and agreement.

Return as JSON:
{
  "synthesis": "Your synthesized summary with [1], [2] citations",
  "confidence": 0.85,
  "key_points": ["point 1", "point 2"]
}`
            },
            {
              role: 'user',
              content: `Sources:\n\n${sourceContext}`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Synthesis failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (content) {
      const parsed = JSON.parse(content);
      return {
        query: topic,
        results: sources,
        synthesis: parsed.synthesis || 'Synthesis failed',
        confidence: parsed.confidence || 0.5,
        sources: sources.map(s => s.url),
        timestamp,
      };
    }
  } catch (error) {
    console.error('[OrchestratorResearch] Synthesis failed:', error);
  }

  // Fallback: simple concatenation
  return {
    query: topic,
    results: sources,
    synthesis: sources.map(s => s.snippet).join('\n\n'),
    confidence: 0.5,
    sources: sources.map(s => s.url),
    timestamp,
  };
}

/**
 * Fact check a claim against available knowledge
 */
export async function factCheck(
  claim: string
): Promise<{
  verdict: 'likely_true' | 'likely_false' | 'uncertain' | 'partially_true';
  confidence: number;
  explanation: string;
  sources?: string[];
}> {
  // Search for relevant information
  const searchResults = await webSearch(claim, { maxResults: 5 });

  if (searchResults.length === 0) {
    return {
      verdict: 'uncertain',
      confidence: 0,
      explanation: 'Unable to find sources to verify this claim.',
    };
  }

  const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      verdict: 'uncertain',
      confidence: 0.3,
      explanation: 'No API key configured for fact checking.',
      sources: searchResults.map(s => s.url),
    };
  }

  const sourceContext = searchResults.map((s, i) =>
    `[${i + 1}] ${s.title}: ${s.snippet}`
  ).join('\n');

  try {
    const response = await fetch(
      process.env.XAI_API_KEY ? 'https://api.x.ai/v1/chat/completions' :
        process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1/chat/completions' :
          'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.XAI_API_KEY ? 'grok-2-latest' :
            process.env.OPENAI_API_KEY ? 'gpt-4o' : 'anthropic/claude-3.5-sonnet',
          messages: [
            {
              role: 'system',
              content: `You are a fact-checker. Evaluate the claim against the sources provided.

Return as JSON:
{
  "verdict": "likely_true" | "likely_false" | "uncertain" | "partially_true",
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation with source citations [1], [2]"
}`
            },
            {
              role: 'user',
              content: `Claim: "${claim}"\n\nSources:\n${sourceContext}`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (content) {
        const parsed = JSON.parse(content);
        return {
          verdict: parsed.verdict || 'uncertain',
          confidence: parsed.confidence || 0.5,
          explanation: parsed.explanation || 'No explanation available',
          sources: searchResults.map(s => s.url),
        };
      }
    }
  } catch (error) {
    console.error('[OrchestratorResearch] Fact check failed:', error);
  }

  return {
    verdict: 'uncertain',
    confidence: 0.3,
    explanation: 'Fact check processing failed.',
    sources: searchResults.map(s => s.url),
  };
}

/**
 * Record research to orchestrator memory
 */
export async function recordResearch(
  query: string,
  summary: ResearchSummary
): Promise<void> {
  const text = `[RESEARCH] Query: ${query}
Synthesis: ${summary.synthesis}
Confidence: ${(summary.confidence * 100).toFixed(0)}%
Sources: ${summary.sources.join(', ')}
Results count: ${summary.results.length}`;

  await addAgentMemory(ORCHESTRATOR_AGENT_ID, text, {
    type: 'research',
    query,
    confidence: summary.confidence,
    source_count: summary.sources.length,
    timestamp: summary.timestamp,
  });

  console.log(`[OrchestratorResearch] Recorded research: ${query.substring(0, 50)}...`);
}

/**
 * Find previous research on similar topics
 */
export async function findPreviousResearch(
  topic: string,
  limit: number = 5
): Promise<{
  memory: { id: string; text: string; metadata?: Record<string, any> };
  score?: number;
}[]> {
  const results = await searchAgentMemory(ORCHESTRATOR_AGENT_ID, `research ${topic}`, limit * 2);
  return results.filter(r => r.memory.metadata?.type === 'research').slice(0, limit);
}

/**
 * Conduct full research workflow: search -> synthesize -> record
 */
export async function conductResearch(
  topic: string,
  options?: WebSearchOptions
): Promise<ResearchSummary> {
  console.log(`[OrchestratorResearch] Conducting research: ${topic}`);

  // Search for information
  const searchResults = await webSearch(topic, options);

  // Synthesize findings
  const summary = await synthesizeResearch(topic, searchResults);

  // Record to memory
  await recordResearch(topic, summary);

  return summary;
}
