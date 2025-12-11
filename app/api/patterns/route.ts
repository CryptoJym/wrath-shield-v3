import { NextRequest, NextResponse } from 'next/server';
import { getPatternRecognizer } from '@/lib/learning/pattern-recognizer';

/**
 * GET /api/patterns
 * Retrieve detected patterns
 *
 * Query parameters:
 * - agentId: Filter by agent ID
 * - domain: Filter by domain
 * - minConfidence: Minimum confidence threshold (0-1)
 * - minFrequency: Minimum frequency threshold (events/week)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const domain = searchParams.get('domain');
    const minConfidence = searchParams.get('minConfidence');
    const minFrequency = searchParams.get('minFrequency');

    const recognizer = getPatternRecognizer();
    let patterns = recognizer.getAllPatterns();

    // Apply filters
    if (agentId) {
      patterns = patterns.filter(p => p.agentId === agentId);
    }

    if (domain) {
      patterns = patterns.filter(p => p.domain === domain);
    }

    if (minConfidence) {
      const threshold = parseFloat(minConfidence);
      patterns = patterns.filter(p => p.confidence >= threshold);
    }

    if (minFrequency) {
      const threshold = parseFloat(minFrequency);
      patterns = patterns.filter(p => p.frequency >= threshold);
    }

    // Sort by confidence descending
    patterns.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      success: true,
      count: patterns.length,
      patterns: patterns.map(p => ({
        ...p,
        // Convert dates to ISO strings for JSON serialization
        firstSeen: p.firstSeen.toISOString(),
        lastSeen: p.lastSeen.toISOString()
      }))
    });
  } catch (error) {
    console.error('[Patterns API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve patterns',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/patterns/analyze
 * Trigger manual pattern analysis
 */
export async function POST(request: NextRequest) {
  try {
    const recognizer = getPatternRecognizer();
    await recognizer.analyzePatterns();

    const patterns = recognizer.getAllPatterns();

    return NextResponse.json({
      success: true,
      message: 'Pattern analysis completed',
      patternsDetected: patterns.length
    });
  } catch (error) {
    console.error('[Patterns API] Analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze patterns',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
