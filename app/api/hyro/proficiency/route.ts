/**
 * HYRO FORGE: Skill Proficiency API
 * Evidence-based skill quantification with Bayesian estimation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  recordSkillEvidence,
  getSkillEvidence,
  getSkillProficiency,
  getProficiencyProfile,
  saveProficiencySnapshot,
  getProficiencyHistory,
  predictPerformance,
  recordPrediction,
  recordOutcome,
  getCalibrationFeedback,
  compareToBenchmark,
  getAllBenchmarks,
} from '@/lib/hyro/forge-proficiency';
import { STAT_NAMES, StatName } from '@/lib/hyro/forge-types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const statName = searchParams.get('stat') as StatName;

    // Get proficiency profile (all stats)
    if (action === 'profile') {
      const profile = getProficiencyProfile();
      return NextResponse.json({ profile });
    }

    // Get proficiency for single stat
    if (statName && action === 'proficiency') {
      if (!STAT_NAMES.includes(statName)) {
        return NextResponse.json({ error: 'Invalid stat name' }, { status: 400 });
      }
      const proficiency = getSkillProficiency(statName);
      return NextResponse.json({ proficiency });
    }

    // Get evidence for a stat
    if (statName && action === 'evidence') {
      if (!STAT_NAMES.includes(statName)) {
        return NextResponse.json({ error: 'Invalid stat name' }, { status: 400 });
      }
      const limit = parseInt(searchParams.get('limit') || '50');
      const evidence = getSkillEvidence(statName, limit);
      return NextResponse.json({ evidence, count: evidence.length });
    }

    // Get proficiency history
    if (statName && action === 'history') {
      if (!STAT_NAMES.includes(statName)) {
        return NextResponse.json({ error: 'Invalid stat name' }, { status: 400 });
      }
      const days = parseInt(searchParams.get('days') || '30');
      const history = getProficiencyHistory(statName, days);
      return NextResponse.json({ history, count: history.length });
    }

    // Get benchmark comparison
    if (action === 'benchmark') {
      if (statName) {
        if (!STAT_NAMES.includes(statName)) {
          return NextResponse.json({ error: 'Invalid stat name' }, { status: 400 });
        }
        const comparison = compareToBenchmark(statName);
        return NextResponse.json({ comparison });
      }
      const benchmarks = getAllBenchmarks();
      return NextResponse.json({ benchmarks });
    }

    // Get calibration feedback
    if (action === 'calibration') {
      const feedback = getCalibrationFeedback();
      return NextResponse.json({ feedback });
    }

    // Default: get full profile with benchmarks
    const profile = getProficiencyProfile();
    const benchmarks = getAllBenchmarks();
    const calibration = getCalibrationFeedback();

    return NextResponse.json({
      profile,
      benchmarks,
      calibration,
      summary: {
        overall_level: profile.overall_level,
        strongest_skill: profile.strongest_skill,
        growth_skill: profile.growth_skill,
      },
    });
  } catch (error) {
    console.error('Proficiency GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch proficiency data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Record skill evidence
    if (action === 'record-evidence') {
      const { stat_name, source_type, source_id, performance_score, difficulty_level, time_pressure, topic_tags } = body;
      if (!stat_name || !source_type || performance_score === undefined) {
        return NextResponse.json({ error: 'stat_name, source_type, and performance_score are required' }, { status: 400 });
      }

      if (!STAT_NAMES.includes(stat_name)) {
        return NextResponse.json({ error: 'Invalid stat name' }, { status: 400 });
      }

      const evidence = recordSkillEvidence({
        stat_name, source_type, source_id, performance_score,
        difficulty_level, time_pressure, topic_tags,
      });

      return NextResponse.json({ evidence, message: 'Evidence recorded' });
    }

    // Save proficiency snapshot
    if (action === 'snapshot') {
      const { stat_name } = body;
      if (!stat_name) {
        return NextResponse.json({ error: 'stat_name is required' }, { status: 400 });
      }

      if (!STAT_NAMES.includes(stat_name)) {
        return NextResponse.json({ error: 'Invalid stat name' }, { status: 400 });
      }

      const snapshot = saveProficiencySnapshot(stat_name);
      return NextResponse.json({ snapshot, message: 'Snapshot saved' });
    }

    // Save all snapshots
    if (action === 'snapshot-all') {
      const snapshots = STAT_NAMES.map(stat => saveProficiencySnapshot(stat));
      return NextResponse.json({ snapshots, message: `Saved ${snapshots.length} snapshots` });
    }

    // Predict performance
    if (action === 'predict') {
      const { stat_name, difficulty } = body;
      if (!stat_name || difficulty === undefined) {
        return NextResponse.json({ error: 'stat_name and difficulty are required' }, { status: 400 });
      }

      if (!STAT_NAMES.includes(stat_name)) {
        return NextResponse.json({ error: 'Invalid stat name' }, { status: 400 });
      }

      const prediction = predictPerformance(stat_name, difficulty);
      return NextResponse.json({
        prediction,
        message: `Predicted: ${prediction.predicted_score} (${Math.round(prediction.confidence * 100)}% confident)`,
      });
    }

    // Record prediction for calibration
    if (action === 'record-prediction') {
      const { stat_name, predicted_score, confidence, activity_type, activity_id } = body;
      if (!stat_name || predicted_score === undefined || !activity_type || !activity_id) {
        return NextResponse.json({
          error: 'stat_name, predicted_score, activity_type, and activity_id are required',
        }, { status: 400 });
      }

      const record = recordPrediction({
        stat_name, predicted_score, confidence: confidence || 0.5, activity_type, activity_id,
      });

      return NextResponse.json({ record, message: 'Prediction recorded for calibration' });
    }

    // Record outcome
    if (action === 'record-outcome') {
      const { calibration_id, actual_score } = body;
      if (!calibration_id || actual_score === undefined) {
        return NextResponse.json({ error: 'calibration_id and actual_score are required' }, { status: 400 });
      }

      const record = recordOutcome(calibration_id, actual_score);
      return NextResponse.json({ record, message: 'Outcome recorded' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Proficiency POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process proficiency action' },
      { status: 500 }
    );
  }
}
