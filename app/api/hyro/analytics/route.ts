/**
 * HYRO FORGE: Behavioral Analytics API
 * Pattern detection and personalized recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  logBehaviorEvent,
  getRecentEvents,
  getEventsByType,
  detectPatterns,
  getActivePatterns,
  getOptimalStudyTime,
  getPersonalizedRecommendations,
  predictSessionSuccess,
  recordPredictionOutcome,
  getPredictionAccuracy,
  EventType,
} from '@/lib/hyro/forge-analytics';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const eventType = searchParams.get('eventType');

    // Get recent events
    if (action === 'events') {
      const limit = parseInt(searchParams.get('limit') || '100');
      const events = eventType
        ? getEventsByType(eventType as EventType, limit)
        : getRecentEvents(limit);
      return NextResponse.json({ events, count: events.length });
    }

    // Get active patterns
    if (action === 'patterns') {
      const patterns = getActivePatterns();
      return NextResponse.json({ patterns, count: patterns.length });
    }

    // Detect patterns (runs analysis)
    if (action === 'detect-patterns') {
      const patterns = detectPatterns();
      return NextResponse.json({
        patterns,
        count: patterns.length,
        message: `Detected ${patterns.length} behavioral patterns`,
      });
    }

    // Get optimal study time
    if (action === 'optimal-time') {
      const timeRange = getOptimalStudyTime();
      return NextResponse.json({
        optimal_time: timeRange,
        has_data: !!timeRange,
      });
    }

    // Get personalized recommendations
    if (action === 'recommendations') {
      const recommendations = getPersonalizedRecommendations();
      return NextResponse.json({ recommendations, count: recommendations.length });
    }

    // Get prediction accuracy
    if (action === 'prediction-accuracy') {
      const accuracy = getPredictionAccuracy();
      return NextResponse.json(accuracy);
    }

    // Default: get overview
    const patterns = getActivePatterns();
    const recommendations = getPersonalizedRecommendations();
    const optimalTime = getOptimalStudyTime();
    const accuracy = getPredictionAccuracy();

    return NextResponse.json({
      patterns,
      recommendations,
      optimal_time: optimalTime,
      prediction_accuracy: accuracy,
      summary: {
        pattern_count: patterns.length,
        recommendation_count: recommendations.length,
      },
    });
  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Log behavioral event
    if (action === 'log-event') {
      const { event_type, event_data, session_id, device_type } = body;
      if (!event_type) {
        return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
      }

      const event = logBehaviorEvent(event_type, event_data, session_id, device_type);
      return NextResponse.json({ event, message: 'Event logged' });
    }

    // Predict session success
    if (action === 'predict') {
      const { activity_type } = body;
      if (!activity_type) {
        return NextResponse.json({ error: 'activity_type is required' }, { status: 400 });
      }

      const prediction = predictSessionSuccess(activity_type);
      return NextResponse.json({
        prediction,
        message: `Prediction confidence: ${Math.round(prediction.confidence * 100)}%`,
      });
    }

    // Record prediction outcome
    if (action === 'record-outcome') {
      const { prediction_id, success } = body;
      if (!prediction_id || success === undefined) {
        return NextResponse.json({ error: 'prediction_id and success are required' }, { status: 400 });
      }

      recordPredictionOutcome(prediction_id, success);
      return NextResponse.json({ message: 'Outcome recorded' });
    }

    // Run pattern detection
    if (action === 'run-detection') {
      const patterns = detectPatterns();
      return NextResponse.json({
        patterns,
        count: patterns.length,
        message: `Pattern detection complete. Found ${patterns.length} patterns.`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Analytics POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process analytics action' },
      { status: 500 }
    );
  }
}
