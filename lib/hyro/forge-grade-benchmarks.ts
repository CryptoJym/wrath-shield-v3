/**
 * HYRO FORGE: Multi-Grade Benchmark System
 *
 * Replaces hardcoded Grade 6 benchmarks with a comprehensive
 * grade-indexed benchmark system supporting K-12.
 *
 * Key Features:
 * - Grade-parameterized benchmarks for all 8 stats
 * - Percentile distributions (25th, 50th, 75th)
 * - Student grade profile management
 * - Per-stat grade inference
 * - Grade progression tracking
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { StatName, STAT_NAMES } from './forge-types';

// ============================================================================
// Types
// ============================================================================

export type GradeLevel =
  | 'K' | '1' | '2' | '3' | '4' | '5'
  | '6' | '7' | '8' | '9' | '10' | '11' | '12';

export const GRADE_LEVELS: GradeLevel[] = [
  'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
];

export interface GradeBenchmark {
  grade: GradeLevel;
  stat_name: StatName;
  benchmark_25th: number;  // 25th percentile (struggling)
  benchmark_50th: number;  // 50th percentile (on track)
  benchmark_75th: number;  // 75th percentile (advanced)
  std_dev: number;         // Standard deviation
  source: 'common_core' | 'research' | 'estimated' | 'interpolated';
}

export interface StudentGradeProfile {
  student_id: string;
  enrolled_grade: GradeLevel;
  inferred_grades: Record<StatName, GradeLevel>;
  grade_confidence: Record<StatName, number>;
  created_at: number;
  updated_at: number;
}

export interface GradeInferenceResult {
  stat_name: StatName;
  inferred_grade: GradeLevel;
  confidence: number;
  proficiency_level: number;
  closest_benchmark: number;
  reasoning: string;
}

// ============================================================================
// Grade Benchmark Data
// ============================================================================

/**
 * Multi-grade benchmark data based on:
 * - Common Core State Standards alignment
 * - Educational research on grade-level expectations
 * - Interpolation for stats without direct standards
 *
 * Values represent proficiency levels (0-100 scale)
 * where 50 = baseline, 100 = complete mastery
 */
const GRADE_BENCHMARK_DATA: Record<GradeLevel, Record<StatName, Omit<GradeBenchmark, 'grade' | 'stat_name'>>> = {
  'K': {
    math:             { benchmark_25th: 10, benchmark_50th: 15, benchmark_75th: 22, std_dev: 8, source: 'common_core' },
    reading:          { benchmark_25th: 8,  benchmark_50th: 12, benchmark_75th: 18, std_dev: 7, source: 'common_core' },
    writing:          { benchmark_25th: 6,  benchmark_50th: 10, benchmark_75th: 16, std_dev: 7, source: 'common_core' },
    science:          { benchmark_25th: 8,  benchmark_50th: 12, benchmark_75th: 18, std_dev: 7, source: 'estimated' },
    social_studies:   { benchmark_25th: 6,  benchmark_50th: 10, benchmark_75th: 16, std_dev: 6, source: 'estimated' },
    financial_literacy:{ benchmark_25th: 4, benchmark_50th: 7,  benchmark_75th: 11, std_dev: 5, source: 'estimated' },
    coding:           { benchmark_25th: 5,  benchmark_50th: 8,  benchmark_75th: 12, std_dev: 5, source: 'estimated' },
    study_skills:     { benchmark_25th: 8,  benchmark_50th: 12, benchmark_75th: 18, std_dev: 6, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 6,  benchmark_50th: 10, benchmark_75th: 15, std_dev: 6, source: 'estimated' },
    technology:       { benchmark_25th: 5,  benchmark_50th: 8,  benchmark_75th: 12, std_dev: 5, source: 'estimated' },
    problem_solving:  { benchmark_25th: 8,  benchmark_50th: 12, benchmark_75th: 18, std_dev: 6, source: 'estimated' },
  },
  '1': {
    math:             { benchmark_25th: 18, benchmark_50th: 25, benchmark_75th: 33, std_dev: 10, source: 'common_core' },
    reading:          { benchmark_25th: 15, benchmark_50th: 22, benchmark_75th: 30, std_dev: 9, source: 'common_core' },
    writing:          { benchmark_25th: 12, benchmark_50th: 18, benchmark_75th: 26, std_dev: 8, source: 'common_core' },
    science:          { benchmark_25th: 14, benchmark_50th: 20, benchmark_75th: 28, std_dev: 9, source: 'estimated' },
    social_studies:   { benchmark_25th: 12, benchmark_50th: 18, benchmark_75th: 26, std_dev: 8, source: 'estimated' },
    financial_literacy:{ benchmark_25th: 8, benchmark_50th: 12, benchmark_75th: 18, std_dev: 6, source: 'estimated' },
    coding:           { benchmark_25th: 10, benchmark_50th: 15, benchmark_75th: 22, std_dev: 7, source: 'estimated' },
    study_skills:     { benchmark_25th: 15, benchmark_50th: 22, benchmark_75th: 30, std_dev: 8, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 12, benchmark_50th: 18, benchmark_75th: 25, std_dev: 8, source: 'estimated' },
    technology:       { benchmark_25th: 10, benchmark_50th: 15, benchmark_75th: 22, std_dev: 7, source: 'estimated' },
    problem_solving:  { benchmark_25th: 14, benchmark_50th: 20, benchmark_75th: 28, std_dev: 8, source: 'estimated' },
  },
  '2': {
    math:             { benchmark_25th: 26, benchmark_50th: 35, benchmark_75th: 44, std_dev: 11, source: 'common_core' },
    reading:          { benchmark_25th: 24, benchmark_50th: 32, benchmark_75th: 42, std_dev: 11, source: 'common_core' },
    writing:          { benchmark_25th: 20, benchmark_50th: 28, benchmark_75th: 38, std_dev: 10, source: 'common_core' },
    science:          { benchmark_25th: 22, benchmark_50th: 30, benchmark_75th: 40, std_dev: 10, source: 'estimated' },
    social_studies:   { benchmark_25th: 18, benchmark_50th: 26, benchmark_75th: 36, std_dev: 10, source: 'estimated' },
    financial_literacy:{ benchmark_25th: 14, benchmark_50th: 20, benchmark_75th: 28, std_dev: 8, source: 'estimated' },
    coding:           { benchmark_25th: 16, benchmark_50th: 23, benchmark_75th: 32, std_dev: 9, source: 'estimated' },
    study_skills:     { benchmark_25th: 22, benchmark_50th: 30, benchmark_75th: 40, std_dev: 10, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 20, benchmark_50th: 28, benchmark_75th: 37, std_dev: 10, source: 'estimated' },
    technology:       { benchmark_25th: 16, benchmark_50th: 23, benchmark_75th: 32, std_dev: 9, source: 'estimated' },
    problem_solving:  { benchmark_25th: 22, benchmark_50th: 30, benchmark_75th: 40, std_dev: 10, source: 'estimated' },
  },
  '3': {
    math:             { benchmark_25th: 34, benchmark_50th: 45, benchmark_75th: 55, std_dev: 12, source: 'common_core' },
    reading:          { benchmark_25th: 33, benchmark_50th: 43, benchmark_75th: 54, std_dev: 12, source: 'common_core' },
    writing:          { benchmark_25th: 28, benchmark_50th: 38, benchmark_75th: 50, std_dev: 11, source: 'common_core' },
    science:          { benchmark_25th: 30, benchmark_50th: 40, benchmark_75th: 51, std_dev: 12, source: 'estimated' },
    social_studies:   { benchmark_25th: 26, benchmark_50th: 36, benchmark_75th: 48, std_dev: 11, source: 'estimated' },
    financial_literacy:{ benchmark_25th: 20, benchmark_50th: 28, benchmark_75th: 38, std_dev: 10, source: 'estimated' },
    coding:           { benchmark_25th: 24, benchmark_50th: 33, benchmark_75th: 43, std_dev: 11, source: 'estimated' },
    study_skills:     { benchmark_25th: 30, benchmark_50th: 40, benchmark_75th: 51, std_dev: 12, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 28, benchmark_50th: 38, benchmark_75th: 49, std_dev: 12, source: 'estimated' },
    technology:       { benchmark_25th: 24, benchmark_50th: 33, benchmark_75th: 43, std_dev: 11, source: 'estimated' },
    problem_solving:  { benchmark_25th: 30, benchmark_50th: 40, benchmark_75th: 51, std_dev: 12, source: 'estimated' },
  },
  '4': {
    math:             { benchmark_25th: 42, benchmark_50th: 55, benchmark_75th: 66, std_dev: 13, source: 'common_core' },
    reading:          { benchmark_25th: 42, benchmark_50th: 54, benchmark_75th: 66, std_dev: 13, source: 'common_core' },
    writing:          { benchmark_25th: 36, benchmark_50th: 48, benchmark_75th: 60, std_dev: 12, source: 'common_core' },
    science:          { benchmark_25th: 38, benchmark_50th: 50, benchmark_75th: 62, std_dev: 13, source: 'estimated' },
    social_studies:   { benchmark_25th: 34, benchmark_50th: 46, benchmark_75th: 58, std_dev: 12, source: 'estimated' },
    financial_literacy:{ benchmark_25th: 28, benchmark_50th: 38, benchmark_75th: 50, std_dev: 11, source: 'estimated' },
    coding:           { benchmark_25th: 32, benchmark_50th: 43, benchmark_75th: 54, std_dev: 12, source: 'estimated' },
    study_skills:     { benchmark_25th: 38, benchmark_50th: 50, benchmark_75th: 62, std_dev: 13, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 36, benchmark_50th: 48, benchmark_75th: 60, std_dev: 13, source: 'estimated' },
    technology:       { benchmark_25th: 32, benchmark_50th: 43, benchmark_75th: 54, std_dev: 12, source: 'estimated' },
    problem_solving:  { benchmark_25th: 38, benchmark_50th: 50, benchmark_75th: 62, std_dev: 13, source: 'estimated' },
  },
  '5': {
    math:             { benchmark_25th: 50, benchmark_50th: 62, benchmark_75th: 74, std_dev: 14, source: 'common_core' },
    reading:          { benchmark_25th: 50, benchmark_50th: 62, benchmark_75th: 74, std_dev: 14, source: 'common_core' },
    writing:          { benchmark_25th: 44, benchmark_50th: 56, benchmark_75th: 68, std_dev: 13, source: 'common_core' },
    science:          { benchmark_25th: 46, benchmark_50th: 58, benchmark_75th: 70, std_dev: 14, source: 'estimated' },
    social_studies:   { benchmark_25th: 42, benchmark_50th: 54, benchmark_75th: 66, std_dev: 13, source: 'estimated' },
    financial_literacy:{ benchmark_25th: 36, benchmark_50th: 48, benchmark_75th: 60, std_dev: 12, source: 'estimated' },
    coding:           { benchmark_25th: 40, benchmark_50th: 52, benchmark_75th: 64, std_dev: 13, source: 'estimated' },
    study_skills:     { benchmark_25th: 46, benchmark_50th: 58, benchmark_75th: 70, std_dev: 13, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 44, benchmark_50th: 56, benchmark_75th: 68, std_dev: 13, source: 'estimated' },
    technology:       { benchmark_25th: 40, benchmark_50th: 52, benchmark_75th: 64, std_dev: 13, source: 'estimated' },
    problem_solving:  { benchmark_25th: 46, benchmark_50th: 58, benchmark_75th: 70, std_dev: 13, source: 'estimated' },
  },
  '6': {
    // This matches the original GRADE_6_BENCHMARKS for backward compatibility
    math:             { benchmark_25th: 55, benchmark_50th: 65, benchmark_75th: 78, std_dev: 15, source: 'common_core' },
    reading:          { benchmark_25th: 55, benchmark_50th: 65, benchmark_75th: 78, std_dev: 15, source: 'common_core' },
    writing:          { benchmark_25th: 50, benchmark_50th: 60, benchmark_75th: 72, std_dev: 14, source: 'common_core' },
    science:          { benchmark_25th: 50, benchmark_50th: 60, benchmark_75th: 73, std_dev: 15, source: 'common_core' },
    social_studies:   { benchmark_25th: 48, benchmark_50th: 58, benchmark_75th: 70, std_dev: 14, source: 'common_core' },
    financial_literacy:{ benchmark_25th: 42, benchmark_50th: 52, benchmark_75th: 64, std_dev: 13, source: 'estimated' },
    coding:           { benchmark_25th: 42, benchmark_50th: 50, benchmark_75th: 62, std_dev: 14, source: 'estimated' },
    study_skills:     { benchmark_25th: 48, benchmark_50th: 55, benchmark_75th: 68, std_dev: 14, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 48, benchmark_50th: 55, benchmark_75th: 68, std_dev: 14, source: 'common_core' },
    technology:       { benchmark_25th: 42, benchmark_50th: 50, benchmark_75th: 62, std_dev: 14, source: 'estimated' },
    problem_solving:  { benchmark_25th: 48, benchmark_50th: 55, benchmark_75th: 68, std_dev: 14, source: 'estimated' },
  },
  '7': {
    math:             { benchmark_25th: 58, benchmark_50th: 70, benchmark_75th: 82, std_dev: 15, source: 'common_core' },
    reading:          { benchmark_25th: 58, benchmark_50th: 70, benchmark_75th: 82, std_dev: 15, source: 'common_core' },
    writing:          { benchmark_25th: 54, benchmark_50th: 66, benchmark_75th: 78, std_dev: 14, source: 'common_core' },
    science:          { benchmark_25th: 54, benchmark_50th: 65, benchmark_75th: 78, std_dev: 15, source: 'estimated' },
    social_studies:   { benchmark_25th: 52, benchmark_50th: 64, benchmark_75th: 76, std_dev: 14, source: 'common_core' },
    financial_literacy:{ benchmark_25th: 48, benchmark_50th: 58, benchmark_75th: 70, std_dev: 13, source: 'estimated' },
    coding:           { benchmark_25th: 48, benchmark_50th: 58, benchmark_75th: 70, std_dev: 14, source: 'estimated' },
    study_skills:     { benchmark_25th: 52, benchmark_50th: 62, benchmark_75th: 74, std_dev: 14, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 52, benchmark_50th: 62, benchmark_75th: 74, std_dev: 14, source: 'estimated' },
    technology:       { benchmark_25th: 48, benchmark_50th: 58, benchmark_75th: 70, std_dev: 14, source: 'estimated' },
    problem_solving:  { benchmark_25th: 52, benchmark_50th: 62, benchmark_75th: 74, std_dev: 14, source: 'estimated' },
  },
  '8': {
    math:             { benchmark_25th: 62, benchmark_50th: 75, benchmark_75th: 86, std_dev: 15, source: 'common_core' },
    reading:          { benchmark_25th: 62, benchmark_50th: 75, benchmark_75th: 86, std_dev: 15, source: 'common_core' },
    writing:          { benchmark_25th: 58, benchmark_50th: 70, benchmark_75th: 82, std_dev: 14, source: 'common_core' },
    science:          { benchmark_25th: 58, benchmark_50th: 70, benchmark_75th: 82, std_dev: 15, source: 'common_core' },
    social_studies:   { benchmark_25th: 56, benchmark_50th: 68, benchmark_75th: 80, std_dev: 14, source: 'common_core' },
    financial_literacy:{ benchmark_25th: 52, benchmark_50th: 64, benchmark_75th: 76, std_dev: 13, source: 'estimated' },
    coding:           { benchmark_25th: 54, benchmark_50th: 65, benchmark_75th: 76, std_dev: 14, source: 'estimated' },
    study_skills:     { benchmark_25th: 56, benchmark_50th: 67, benchmark_75th: 78, std_dev: 14, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 56, benchmark_50th: 67, benchmark_75th: 78, std_dev: 14, source: 'estimated' },
    technology:       { benchmark_25th: 54, benchmark_50th: 65, benchmark_75th: 76, std_dev: 14, source: 'estimated' },
    problem_solving:  { benchmark_25th: 56, benchmark_50th: 67, benchmark_75th: 78, std_dev: 14, source: 'estimated' },
  },
  '9': {
    math:             { benchmark_25th: 65, benchmark_50th: 78, benchmark_75th: 88, std_dev: 14, source: 'common_core' },
    reading:          { benchmark_25th: 65, benchmark_50th: 78, benchmark_75th: 88, std_dev: 14, source: 'common_core' },
    writing:          { benchmark_25th: 62, benchmark_50th: 74, benchmark_75th: 85, std_dev: 14, source: 'common_core' },
    science:          { benchmark_25th: 62, benchmark_50th: 74, benchmark_75th: 85, std_dev: 14, source: 'estimated' },
    social_studies:   { benchmark_25th: 60, benchmark_50th: 72, benchmark_75th: 83, std_dev: 14, source: 'common_core' },
    financial_literacy:{ benchmark_25th: 56, benchmark_50th: 68, benchmark_75th: 80, std_dev: 13, source: 'estimated' },
    coding:           { benchmark_25th: 58, benchmark_50th: 70, benchmark_75th: 81, std_dev: 14, source: 'estimated' },
    study_skills:     { benchmark_25th: 60, benchmark_50th: 72, benchmark_75th: 83, std_dev: 14, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 60, benchmark_50th: 72, benchmark_75th: 83, std_dev: 14, source: 'estimated' },
    technology:       { benchmark_25th: 58, benchmark_50th: 70, benchmark_75th: 81, std_dev: 14, source: 'estimated' },
    problem_solving:  { benchmark_25th: 60, benchmark_50th: 72, benchmark_75th: 83, std_dev: 14, source: 'estimated' },
  },
  '10': {
    math:             { benchmark_25th: 68, benchmark_50th: 80, benchmark_75th: 90, std_dev: 13, source: 'common_core' },
    reading:          { benchmark_25th: 68, benchmark_50th: 80, benchmark_75th: 90, std_dev: 13, source: 'common_core' },
    writing:          { benchmark_25th: 65, benchmark_50th: 77, benchmark_75th: 87, std_dev: 13, source: 'common_core' },
    science:          { benchmark_25th: 65, benchmark_50th: 77, benchmark_75th: 87, std_dev: 13, source: 'estimated' },
    social_studies:   { benchmark_25th: 64, benchmark_50th: 76, benchmark_75th: 86, std_dev: 13, source: 'common_core' },
    financial_literacy:{ benchmark_25th: 60, benchmark_50th: 72, benchmark_75th: 83, std_dev: 13, source: 'estimated' },
    coding:           { benchmark_25th: 62, benchmark_50th: 74, benchmark_75th: 84, std_dev: 13, source: 'estimated' },
    study_skills:     { benchmark_25th: 64, benchmark_50th: 76, benchmark_75th: 86, std_dev: 13, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 64, benchmark_50th: 76, benchmark_75th: 86, std_dev: 13, source: 'estimated' },
    technology:       { benchmark_25th: 62, benchmark_50th: 74, benchmark_75th: 84, std_dev: 13, source: 'estimated' },
    problem_solving:  { benchmark_25th: 64, benchmark_50th: 76, benchmark_75th: 86, std_dev: 13, source: 'estimated' },
  },
  '11': {
    math:             { benchmark_25th: 70, benchmark_50th: 82, benchmark_75th: 92, std_dev: 12, source: 'common_core' },
    reading:          { benchmark_25th: 70, benchmark_50th: 82, benchmark_75th: 92, std_dev: 12, source: 'common_core' },
    writing:          { benchmark_25th: 68, benchmark_50th: 80, benchmark_75th: 90, std_dev: 12, source: 'common_core' },
    science:          { benchmark_25th: 68, benchmark_50th: 80, benchmark_75th: 90, std_dev: 12, source: 'estimated' },
    social_studies:   { benchmark_25th: 68, benchmark_50th: 80, benchmark_75th: 90, std_dev: 12, source: 'common_core' },
    financial_literacy:{ benchmark_25th: 64, benchmark_50th: 76, benchmark_75th: 86, std_dev: 12, source: 'estimated' },
    coding:           { benchmark_25th: 66, benchmark_50th: 78, benchmark_75th: 88, std_dev: 12, source: 'estimated' },
    study_skills:     { benchmark_25th: 68, benchmark_50th: 80, benchmark_75th: 90, std_dev: 12, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 68, benchmark_50th: 80, benchmark_75th: 90, std_dev: 12, source: 'estimated' },
    technology:       { benchmark_25th: 66, benchmark_50th: 78, benchmark_75th: 88, std_dev: 12, source: 'estimated' },
    problem_solving:  { benchmark_25th: 68, benchmark_50th: 80, benchmark_75th: 90, std_dev: 12, source: 'estimated' },
  },
  '12': {
    math:             { benchmark_25th: 72, benchmark_50th: 85, benchmark_75th: 95, std_dev: 12, source: 'common_core' },
    reading:          { benchmark_25th: 72, benchmark_50th: 85, benchmark_75th: 95, std_dev: 12, source: 'common_core' },
    writing:          { benchmark_25th: 70, benchmark_50th: 83, benchmark_75th: 93, std_dev: 12, source: 'common_core' },
    science:          { benchmark_25th: 70, benchmark_50th: 83, benchmark_75th: 93, std_dev: 12, source: 'estimated' },
    social_studies:   { benchmark_25th: 70, benchmark_50th: 83, benchmark_75th: 93, std_dev: 12, source: 'common_core' },
    financial_literacy:{ benchmark_25th: 68, benchmark_50th: 80, benchmark_75th: 90, std_dev: 12, source: 'estimated' },
    coding:           { benchmark_25th: 70, benchmark_50th: 82, benchmark_75th: 92, std_dev: 12, source: 'estimated' },
    study_skills:     { benchmark_25th: 72, benchmark_50th: 84, benchmark_75th: 94, std_dev: 12, source: 'estimated' },
    critical_thinking:{ benchmark_25th: 72, benchmark_50th: 84, benchmark_75th: 94, std_dev: 12, source: 'estimated' },
    technology:       { benchmark_25th: 70, benchmark_50th: 82, benchmark_75th: 92, std_dev: 12, source: 'estimated' },
    problem_solving:  { benchmark_25th: 72, benchmark_50th: 84, benchmark_75th: 94, std_dev: 12, source: 'estimated' },
  },
};

// ============================================================================
// Benchmark Functions
// ============================================================================

/**
 * Get benchmark for a specific grade and stat
 */
export function getBenchmark(grade: GradeLevel, stat: StatName): GradeBenchmark {
  const data = GRADE_BENCHMARK_DATA[grade][stat];
  return {
    grade,
    stat_name: stat,
    ...data,
  };
}

/**
 * Get all benchmarks for a grade
 */
export function getGradeBenchmarks(grade: GradeLevel): Record<StatName, GradeBenchmark> {
  const result: Partial<Record<StatName, GradeBenchmark>> = {};
  for (const stat of STAT_NAMES) {
    result[stat] = getBenchmark(grade, stat);
  }
  return result as Record<StatName, GradeBenchmark>;
}

/**
 * Get 50th percentile benchmark for backward compatibility
 * This replaces the old GRADE_6_BENCHMARKS constant
 */
export function get50thPercentileBenchmarks(grade: GradeLevel = '6'): Record<StatName, number> {
  const result: Partial<Record<StatName, number>> = {};
  for (const stat of STAT_NAMES) {
    result[stat] = GRADE_BENCHMARK_DATA[grade][stat].benchmark_50th;
  }
  return result as Record<StatName, number>;
}

/**
 * Get the 50th percentile benchmark for a single stat
 * Direct replacement for GRADE_6_BENCHMARK constant
 */
export function getStatBenchmark(stat: StatName, grade: GradeLevel = '6'): number {
  return GRADE_BENCHMARK_DATA[grade][stat].benchmark_50th;
}

// ============================================================================
// Grade Inference
// ============================================================================

/**
 * Infer the grade level for a stat based on proficiency
 */
export function inferGradeLevel(stat: StatName, proficiency: number): GradeInferenceResult {
  let closestGrade: GradeLevel = 'K';
  let closestDistance = Infinity;
  let closestBenchmark = 0;

  // Find the grade whose 50th percentile is closest to the proficiency
  for (const grade of GRADE_LEVELS) {
    const benchmark = GRADE_BENCHMARK_DATA[grade][stat].benchmark_50th;
    const distance = Math.abs(benchmark - proficiency);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestGrade = grade;
      closestBenchmark = benchmark;
    }
  }

  // Calculate confidence based on how close we are to the benchmark
  const stdDev = GRADE_BENCHMARK_DATA[closestGrade][stat].std_dev;
  const zScore = Math.abs(proficiency - closestBenchmark) / stdDev;
  const confidence = Math.max(0.3, 1 - zScore * 0.2);

  // Determine reasoning
  let reasoning: string;
  if (closestDistance < 3) {
    reasoning = `Proficiency ${proficiency} closely matches ${closestGrade} benchmark (${closestBenchmark})`;
  } else if (proficiency > closestBenchmark) {
    reasoning = `Proficiency ${proficiency} is above ${closestGrade} benchmark (${closestBenchmark})`;
  } else {
    reasoning = `Proficiency ${proficiency} is below ${closestGrade} benchmark (${closestBenchmark})`;
  }

  return {
    stat_name: stat,
    inferred_grade: closestGrade,
    confidence,
    proficiency_level: proficiency,
    closest_benchmark: closestBenchmark,
    reasoning,
  };
}

/**
 * Infer grade levels for all stats
 */
export function inferAllGradeLevels(
  proficiencies: Record<StatName, number>
): Record<StatName, GradeInferenceResult> {
  const result: Partial<Record<StatName, GradeInferenceResult>> = {};
  for (const stat of STAT_NAMES) {
    result[stat] = inferGradeLevel(stat, proficiencies[stat] ?? 50);
  }
  return result as Record<StatName, GradeInferenceResult>;
}

// ============================================================================
// Student Grade Profile
// ============================================================================

/**
 * Get or create student grade profile
 */
export function getStudentGradeProfile(studentId: string): StudentGradeProfile {
  const db = getDatabase();

  // Check if profile exists
  const character = db.prepare(`
    SELECT id, enrolled_grade FROM hyro_character WHERE id = ?
  `).get(studentId) as { id: string; enrolled_grade?: string } | undefined;

  // Get inferred grades
  const inferences = db.prepare(`
    SELECT stat_name, inferred_grade, confidence
    FROM hyro_student_grade_inference
    WHERE student_id = ?
  `).all(studentId) as Array<{ stat_name: string; inferred_grade: string; confidence: number }>;

  // Build profile
  const inferredGrades: Record<string, GradeLevel> = {};
  const gradeConfidence: Record<string, number> = {};

  for (const inf of inferences) {
    inferredGrades[inf.stat_name] = inf.inferred_grade as GradeLevel;
    gradeConfidence[inf.stat_name] = inf.confidence;
  }

  // Fill in missing stats with enrolled grade
  const enrolledGrade = (character?.enrolled_grade as GradeLevel) || '6';
  for (const stat of STAT_NAMES) {
    if (!inferredGrades[stat]) {
      inferredGrades[stat] = enrolledGrade;
      gradeConfidence[stat] = 0.5; // Default confidence
    }
  }

  const now = Math.floor(Date.now() / 1000);

  return {
    student_id: studentId,
    enrolled_grade: enrolledGrade,
    inferred_grades: inferredGrades as Record<StatName, GradeLevel>,
    grade_confidence: gradeConfidence as Record<StatName, number>,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update student's enrolled grade
 */
export function updateEnrolledGrade(studentId: string, grade: GradeLevel): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE hyro_character
    SET enrolled_grade = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(grade, studentId);
}

/**
 * Update inferred grade for a stat
 */
export function updateInferredGrade(
  studentId: string,
  stat: StatName,
  grade: GradeLevel,
  confidence: number,
  evidenceCount: number = 1
): void {
  const db = getDatabase();
  const id = `inf_${studentId}_${stat}`;

  db.prepare(`
    INSERT INTO hyro_student_grade_inference (
      id, student_id, stat_name, inferred_grade, confidence, evidence_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(student_id, stat_name) DO UPDATE SET
      inferred_grade = excluded.inferred_grade,
      confidence = excluded.confidence,
      evidence_count = evidence_count + excluded.evidence_count,
      updated_at = unixepoch()
  `).run(id, studentId, stat, grade, confidence, evidenceCount);
}

/**
 * Get effective grade for a stat (uses inferred if confident, else enrolled)
 */
export function getEffectiveGrade(studentId: string, stat: StatName): GradeLevel {
  const profile = getStudentGradeProfile(studentId);

  // Use inferred grade if confidence is high enough
  if (profile.grade_confidence[stat] >= 0.7) {
    return profile.inferred_grades[stat];
  }

  // Fall back to enrolled grade
  return profile.enrolled_grade;
}

/**
 * Get effective benchmark for a stat (grade-aware)
 */
export function getEffectiveBenchmark(studentId: string, stat: StatName): number {
  const grade = getEffectiveGrade(studentId, stat);
  return getStatBenchmark(stat, grade);
}

// ============================================================================
// Percentile Calculation
// ============================================================================

/**
 * Calculate percentile for a proficiency level within a grade
 */
export function calculatePercentile(
  proficiency: number,
  stat: StatName,
  grade: GradeLevel
): number {
  const benchmark = GRADE_BENCHMARK_DATA[grade][stat];
  const { benchmark_50th, std_dev } = benchmark;

  // Use z-score to estimate percentile
  const zScore = (proficiency - benchmark_50th) / std_dev;

  // Convert z-score to percentile using normal CDF approximation
  const percentile = normalCDF(zScore) * 100;

  return Math.max(1, Math.min(99, Math.round(percentile)));
}

/**
 * Get performance status relative to grade benchmark
 */
export function getPerformanceStatus(
  proficiency: number,
  stat: StatName,
  grade: GradeLevel
): 'far_below' | 'below' | 'approaching' | 'at' | 'above' | 'far_above' {
  const benchmark = GRADE_BENCHMARK_DATA[grade][stat];
  const { benchmark_25th, benchmark_50th, benchmark_75th } = benchmark;

  if (proficiency < benchmark_25th - 10) return 'far_below';
  if (proficiency < benchmark_25th) return 'below';
  if (proficiency < benchmark_50th - 5) return 'approaching';
  if (proficiency <= benchmark_50th + 5) return 'at';
  if (proficiency <= benchmark_75th) return 'above';
  return 'far_above';
}

// ============================================================================
// Database Schema
// ============================================================================

/**
 * Initialize grade inference table
 */
export function initializeGradeInferenceTable(): void {
  const db = getDatabase();

  // Add enrolled_grade column to character if not exists
  try {
    db.exec(`ALTER TABLE hyro_character ADD COLUMN enrolled_grade TEXT DEFAULT '6'`);
  } catch {
    // Column already exists
  }

  // Create grade inference table
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyro_student_grade_inference (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      stat_name TEXT NOT NULL,
      inferred_grade TEXT NOT NULL,
      confidence REAL NOT NULL,
      evidence_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(student_id, stat_name)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grade_inference_student
    ON hyro_student_grade_inference(student_id)
  `);
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normal CDF approximation (Abramowitz and Stegun)
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Get grade level as numeric index (K=0, 1=1, ..., 12=12)
 */
export function gradeToNumeric(grade: GradeLevel): number {
  if (grade === 'K') return 0;
  return parseInt(grade, 10);
}

/**
 * Get grade level from numeric index
 */
export function numericToGrade(num: number): GradeLevel {
  if (num <= 0) return 'K';
  if (num > 12) return '12';
  return num.toString() as GradeLevel;
}

/**
 * Calculate grade difference (positive = ahead, negative = behind)
 */
export function gradeDifference(actual: GradeLevel, expected: GradeLevel): number {
  return gradeToNumeric(actual) - gradeToNumeric(expected);
}
