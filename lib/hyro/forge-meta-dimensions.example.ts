/**
 * HYRO FORGE: Meta-Dimensions Integration Examples
 *
 * This file demonstrates how to use the meta-dimensions system
 * with the existing HYRO Forge components.
 */

import {
  getStudentMetaDimensions,
  initializeMetaDimensions,
  applySubjectToMetaDimensions,
  calculateManifoldModifier,
  calculateMetaScore,
  getMetaDimensionRecommendations,
  ExtendedSubject,
} from './forge-meta-dimensions';

import {
  LearnerState,
  TrajectoryEffect,
  applyTrajectoryEffect,
} from './forge-learner-state';

// ============================================================================
// EXAMPLE 1: Initialize meta-dimensions for a new student
// ============================================================================

export function setupNewStudent(studentId: string) {
  console.log('Setting up meta-dimensions for new student:', studentId);

  const dimensions = initializeMetaDimensions(studentId);

  console.log('Initialized dimensions:', dimensions);
  // All dimensions start at 0.5 (neutral)

  return dimensions;
}

// ============================================================================
// EXAMPLE 2: Update meta-dimensions after a learning session
// ============================================================================

export function recordLearningSession(
  studentId: string,
  subject: ExtendedSubject,
  performanceScore: number,
  durationMinutes: number
) {
  console.log(`Recording ${subject} session:`, {
    student: studentId,
    performance: performanceScore,
    duration: durationMinutes,
  });

  // Apply the subject learning to meta-dimensions
  const updatedDimensions = applySubjectToMetaDimensions(
    studentId,
    subject,
    performanceScore,
    durationMinutes
  );

  console.log('Updated meta-dimensions:', updatedDimensions);

  // Calculate overall meta score
  const metaScore = calculateMetaScore(updatedDimensions);
  console.log('Overall meta score:', metaScore);

  return { updatedDimensions, metaScore };
}

// ============================================================================
// EXAMPLE 3: Modify C/E/G movement based on meta-dimensions
// ============================================================================

export function applyMetaModifiedMovement(
  studentId: string,
  currentState: LearnerState,
  intendedMovement: TrajectoryEffect
) {
  // Get student's meta-dimensions
  const metaDimensions = getStudentMetaDimensions(studentId);

  // Calculate modifier based on meta-dimensions
  const modifier = calculateManifoldModifier(
    metaDimensions,
    {
      coherence: intendedMovement.delta_C,
      entropy: intendedMovement.delta_E,
      generativity: intendedMovement.delta_G,
    }
  );

  // Create modified trajectory effect
  const modifiedEffect: TrajectoryEffect = {
    delta_C: modifier.coherence,
    delta_E: modifier.entropy,
    delta_G: modifier.generativity,
    confidence: intendedMovement.confidence * (1 + (metaDimensions.gradient_awareness - 0.5) * 0.2),
  };

  // Apply the modified effect to the learner state
  const newState = applyTrajectoryEffect(currentState, modifiedEffect);

  console.log('Meta-modified state transition:', {
    from: { C: currentState.C, E: currentState.E, G: currentState.G },
    to: { C: newState.C, E: newState.E, G: newState.G },
    metaScore: calculateMetaScore(metaDimensions),
  });

  return newState;
}

// ============================================================================
// EXAMPLE 4: Art class boosts multiple meta-dimensions
// ============================================================================

export function recordArtClass(studentId: string) {
  console.log('Recording art class session...');

  // Art is particularly powerful for meta-dimension development
  // It contributes to:
  // - manifold_fluidity (0.4)
  // - cooperative_generativity (0.4)
  // - identity_elasticity (0.3)
  // - entropy_intuition (0.2)

  const beforeDimensions = getStudentMetaDimensions(studentId);

  // Simulate a 60-minute art session with good performance
  const afterDimensions = applySubjectToMetaDimensions(
    studentId,
    'art',
    85,  // 85% performance
    60   // 60 minutes
  );

  console.log('Art class impact:');
  console.log('  Manifold fluidity:',
    beforeDimensions.manifold_fluidity.toFixed(2), '→',
    afterDimensions.manifold_fluidity.toFixed(2)
  );
  console.log('  Cooperative generativity:',
    beforeDimensions.cooperative_generativity.toFixed(2), '→',
    afterDimensions.cooperative_generativity.toFixed(2)
  );
  console.log('  Identity elasticity:',
    beforeDimensions.identity_elasticity.toFixed(2), '→',
    afterDimensions.identity_elasticity.toFixed(2)
  );

  return afterDimensions;
}

// ============================================================================
// EXAMPLE 5: Get personalized recommendations
// ============================================================================

export function getPersonalizedGuidance(studentId: string) {
  console.log('Generating personalized guidance for:', studentId);

  const recommendations = getMetaDimensionRecommendations(studentId);

  if (recommendations.length === 0) {
    console.log('All meta-dimensions are healthy! 🎉');
    return null;
  }

  console.log(`Found ${recommendations.length} areas for improvement:`);

  recommendations.forEach((rec, index) => {
    console.log(`\n${index + 1}. ${rec.dimension} (current: ${rec.current.toFixed(2)})`);
    console.log('   Recommended activities:');
    rec.recommended_activities.forEach(activity => {
      console.log(`   - ${activity}`);
    });
  });

  return recommendations;
}

// ============================================================================
// EXAMPLE 6: Complete integration workflow
// ============================================================================

export function completeWorkflowExample(studentId: string) {
  console.log('='.repeat(60));
  console.log('COMPLETE META-DIMENSIONS WORKFLOW');
  console.log('='.repeat(60));

  // 1. Initialize if needed
  let dimensions = getStudentMetaDimensions(studentId);
  const metaScore = calculateMetaScore(dimensions);

  if (metaScore === 0.5) {
    console.log('\n[Step 1] Initializing new student...');
    dimensions = initializeMetaDimensions(studentId);
  } else {
    console.log('\n[Step 1] Loading existing student...');
  }

  // 2. Record various learning activities
  console.log('\n[Step 2] Recording learning activities...');

  // Math session - boosts gradient_awareness and multi_model_coherence
  applySubjectToMetaDimensions(studentId, 'math', 78, 45);

  // Art session - boosts manifold_fluidity, cooperative_generativity, identity_elasticity
  applySubjectToMetaDimensions(studentId, 'art', 92, 60);

  // Physical Education - boosts gradient_awareness, identity_elasticity, manifold_fluidity
  applySubjectToMetaDimensions(studentId, 'physical_education', 88, 50);

  // 3. Check updated dimensions
  console.log('\n[Step 3] Updated meta-dimensions:');
  const updatedDimensions = getStudentMetaDimensions(studentId);
  Object.entries(updatedDimensions).forEach(([key, value]) => {
    console.log(`  ${key}: ${value.toFixed(3)}`);
  });

  // 4. Calculate overall meta score
  const finalScore = calculateMetaScore(updatedDimensions);
  console.log('\n[Step 4] Overall meta score:', finalScore.toFixed(3));

  // 5. Get recommendations
  console.log('\n[Step 5] Personalized recommendations:');
  const recs = getMetaDimensionRecommendations(studentId);
  if (recs.length > 0) {
    console.log(`  ${recs.length} dimensions need attention`);
    console.log(`  Focus on: ${recs[0].dimension}`);
  } else {
    console.log('  All dimensions above threshold!');
  }

  console.log('\n' + '='.repeat(60));
  console.log('WORKFLOW COMPLETE');
  console.log('='.repeat(60));

  return {
    dimensions: updatedDimensions,
    metaScore: finalScore,
    recommendations: recs,
  };
}
