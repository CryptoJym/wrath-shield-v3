// @ts-nocheck
/**
 * Tests for Behavioral Economics Types
 *
 * Tests type definitions for behavioral economics education including:
 * - Cognitive biases taxonomy
 * - WRAP decision framework
 * - Manifold extensions (Epistemic Calibration, Bias Awareness)
 * - Metacognition tracking
 * - Learning techniques
 * - Behavioral Economics standards
 */

import { jest, describe, it, expect } from '@jest/globals';

import type {
  BiasType,
  BiasCurriculumEntry,
  WRAPStage,
  WRAPTechnique,
  WRAPFramework,
  EpistemicCalibration,
  BiasAwareness,
  DecisionQuality,
  MetacognitionPhase,
  EnhancedMetacognition,
  LearningTechnique,
  TechniqueProfile,
  LearnerTechniqueProfile,
  BEStandardId,
  BEStandard,
  ExtendedManifoldState,
  BEQuestionType,
  BEQuestion,
  BEEvent,
  BEModuleConfig,
} from '../../../lib/hyro/behavioral-economics-types';

describe('Behavioral Economics Types', () => {
  // ==========================================================================
  // Cognitive Biases Tests
  // ==========================================================================

  describe('BiasType', () => {
    it('should define all 15 cognitive biases', () => {
      const biases: BiasType[] = [
        'confirmation_bias',
        'availability_heuristic',
        'anchoring_effect',
        'loss_aversion',
        'sunk_cost_fallacy',
        'fundamental_attribution_error',
        'hindsight_bias',
        'overconfidence_bias',
        'status_quo_bias',
        'dunning_kruger_effect',
        'bandwagon_effect',
        'framing_effect',
        'halo_effect',
        'self_serving_bias',
        'negativity_bias',
      ];

      expect(biases).toHaveLength(15);
      biases.forEach(bias => expect(typeof bias).toBe('string'));
    });
  });

  describe('BiasCurriculumEntry', () => {
    it('should create valid curriculum entry', () => {
      const entry: BiasCurriculumEntry = {
        id: 'confirmation_bias',
        name: 'Confirmation Bias',
        definition: 'The tendency to search for information that confirms existing beliefs',
        shortDescription: 'Seeking confirmatory evidence',
        evolutionaryReason: 'Reduces cognitive load when making decisions',
        psychologicalMechanism: 'Selective attention and memory',
        adaptiveContexts: ['Quick decisions in familiar environments'],
        maladaptiveContexts: ['Scientific inquiry', 'Important decisions'],
        selfRecognitionCues: ['Feeling certain too quickly', 'Dismissing contrary evidence'],
        externalIndicators: ['Only citing agreeing sources', 'Ignoring counterarguments'],
        debiasingStrategies: ['Actively seek disconfirming evidence', 'Consider opposite'],
        practiceScenarios: ['Evaluate a product you already like', 'Research a topic you have strong opinions on'],
        relatedBiases: ['availability_heuristic', 'anchoring_effect'],
        system1vs2: 'system1',
        prerequisiteKnowledge: ['Basic understanding of cognition'],
        difficultyLevel: 'foundational',
        commonMisunderstandings: ['Thinking it only affects others'],
      };

      expect(entry.id).toBe('confirmation_bias');
      expect(entry.adaptiveContexts.length).toBeGreaterThan(0);
      expect(entry.debiasingStrategies.length).toBeGreaterThan(0);
      expect(entry.system1vs2).toBe('system1');
    });

    it('should accept all system types', () => {
      const systems: BiasCurriculumEntry['system1vs2'][] = ['system1', 'system2', 'both'];
      expect(systems).toHaveLength(3);
    });

    it('should accept all difficulty levels', () => {
      const levels: BiasCurriculumEntry['difficultyLevel'][] = ['foundational', 'intermediate', 'advanced'];
      expect(levels).toHaveLength(3);
    });
  });

  // ==========================================================================
  // WRAP Framework Tests
  // ==========================================================================

  describe('WRAPStage', () => {
    it('should define all four WRAP stages', () => {
      const stages: WRAPStage[] = ['widen', 'reality_test', 'attain_distance', 'prepare_wrong'];
      expect(stages).toHaveLength(4);
    });
  });

  describe('WRAPTechnique', () => {
    it('should create valid technique', () => {
      const technique: WRAPTechnique = {
        id: 'consider-opposite',
        stage: 'widen',
        name: 'Consider the Opposite',
        description: 'Deliberately generate alternatives to your initial idea',
        howToApply: ['Ask "What if we did the opposite?"', 'List 3 alternatives'],
        examplePrompts: ['What would I do if this option didn\'t exist?'],
        commonMistakes: ['Generating weak alternatives just to dismiss them'],
      };

      expect(technique.stage).toBe('widen');
      expect(technique.howToApply.length).toBeGreaterThan(0);
    });
  });

  describe('WRAPFramework', () => {
    it('should create complete WRAP framework', () => {
      const framework: WRAPFramework = {
        stages: {
          widen: {
            description: 'Widen your options',
            keyQuestion: 'What are my alternatives?',
            techniques: [],
          },
          reality_test: {
            description: 'Reality-test your assumptions',
            keyQuestion: 'What information would change my mind?',
            techniques: [],
          },
          attain_distance: {
            description: 'Attain distance before deciding',
            keyQuestion: 'What would I tell my best friend to do?',
            techniques: [],
          },
          prepare_wrong: {
            description: 'Prepare to be wrong',
            keyQuestion: 'What could make this fail?',
            techniques: [],
          },
        },
      };

      expect(Object.keys(framework.stages)).toHaveLength(4);
      expect(framework.stages.widen.keyQuestion).toContain('alternatives');
    });
  });

  // ==========================================================================
  // Manifold Extensions Tests
  // ==========================================================================

  describe('EpistemicCalibration', () => {
    it('should create valid calibration object', () => {
      const calibration: EpistemicCalibration = {
        calibrationScore: 52, // Slightly underconfident
        brierScore: 0.15,
        domainCalibration: {
          math: { score: 55, sampleSize: 100, lastUpdated: new Date() },
          reading: { score: 48, sampleSize: 75, lastUpdated: new Date() },
        },
        calibrationHistory: [
          {
            timestamp: new Date(),
            predictedConfidence: 80,
            actualAccuracy: 75,
            domain: 'math',
            questionId: 'q-123',
          },
        ],
        calibrationCurve: [
          { confidenceBucket: 70, predictedAccuracy: 70, actualAccuracy: 65, sampleSize: 20 },
          { confidenceBucket: 80, predictedAccuracy: 80, actualAccuracy: 78, sampleSize: 15 },
        ],
      };

      expect(calibration.calibrationScore).toBe(52);
      expect(calibration.brierScore).toBeLessThan(1);
      expect(Object.keys(calibration.domainCalibration)).toHaveLength(2);
    });
  });

  describe('BiasAwareness', () => {
    it('should create valid bias awareness object', () => {
      const awareness: BiasAwareness = {
        overallScore: 65,
        biasRecognition: {
          confirmation_bias: {
            score: 75,
            assessmentCount: 10,
            lastAssessed: new Date(),
            trend: 'improving',
          },
          anchoring_effect: {
            score: 60,
            assessmentCount: 5,
            lastAssessed: new Date(),
            trend: 'stable',
          },
        },
        biasMitigation: {
          confirmation_bias: {
            score: 70,
            attemptCount: 15,
            successRate: 0.7,
            lastAttempt: new Date(),
          },
        },
        situationalAwareness: {
          score: 55,
          highRiskSituations: ['Time pressure', 'Emotional decisions'],
          personalTriggers: ['Strong initial opinions'],
        },
        transferAbility: {
          score: 50,
          successfulTransfers: 8,
          totalTransferAttempts: 15,
        },
      };

      expect(awareness.overallScore).toBe(65);
      expect(awareness.situationalAwareness.highRiskSituations.length).toBeGreaterThan(0);
    });

    it('should accept all trend values', () => {
      const trends: BiasAwareness['biasRecognition'][BiasType]['trend'][] = [
        'improving', 'stable', 'declining'
      ];
      expect(trends).toHaveLength(3);
    });
  });

  describe('DecisionQuality', () => {
    it('should create valid decision quality object', () => {
      const quality: DecisionQuality = {
        processMetrics: {
          optionsGenerated: 75,
          evidenceSought: 80,
          distanceAttained: 65,
          preparationLevel: 70,
          overallProcessScore: 72.5,
        },
        decisionHistory: [
          {
            decisionId: 'dec-123',
            timestamp: new Date(),
            context: 'Choosing a new curriculum',
            stakes: 'medium',
            processScores: {
              widen: 80,
              realityTest: 75,
              distance: 70,
              prepare: 65,
            },
            outcome: {
              assessedAt: new Date(),
              outcomeQuality: 85,
              wasLuckFactor: false,
              reflection: 'Process worked well',
            },
          },
        ],
        correlation: {
          processOutcomeCorrelation: 0.65,
          sampleSize: 25,
          confidenceInterval: [0.45, 0.85],
        },
      };

      expect(quality.processMetrics.overallProcessScore).toBe(72.5);
      expect(quality.decisionHistory[0].stakes).toBe('medium');
    });

    it('should accept all stakes levels', () => {
      const stakes: DecisionQuality['decisionHistory'][0]['stakes'][] = ['low', 'medium', 'high'];
      expect(stakes).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Metacognition Tests
  // ==========================================================================

  describe('MetacognitionPhase', () => {
    it('should define all four phases', () => {
      const phases: MetacognitionPhase[] = ['prediction', 'monitoring', 'evaluation', 'regulation'];
      expect(phases).toHaveLength(4);
    });
  });

  describe('EnhancedMetacognition', () => {
    it('should create valid metacognition object', () => {
      const meta: EnhancedMetacognition = {
        phaseScores: {
          prediction: { score: 70, assessmentCount: 20, lastAssessed: new Date() },
          monitoring: { score: 65, assessmentCount: 18, lastAssessed: new Date() },
          evaluation: { score: 75, assessmentCount: 15, lastAssessed: new Date() },
          regulation: { score: 60, assessmentCount: 12, lastAssessed: new Date() },
        },
        whyUnderstanding: {
          curriculumAwareness: 70,
          schemaIntegration: 65,
          transferRecognition: 60,
          applicationGeneration: 55,
        },
        understandingIndicators: {
          paraphrasingAbility: 75,
          exampleGeneration: 70,
          boundaryRecognition: 65,
          farTransfer: 55,
          conceptualStability: 80,
        },
        illusionOfKnowledgeIndex: 25, // Lower is better
      };

      expect(Object.keys(meta.phaseScores)).toHaveLength(4);
      expect(meta.illusionOfKnowledgeIndex).toBeLessThan(50);
    });
  });

  // ==========================================================================
  // Learning Techniques Tests
  // ==========================================================================

  describe('LearningTechnique', () => {
    it('should define all learning techniques', () => {
      const techniques: LearningTechnique[] = [
        'retrieval_practice',
        'spaced_repetition',
        'interleaving',
        'elaborative_interrogation',
        'concrete_examples',
        'dual_coding',
        'self_explanation',
        'deliberate_practice',
      ];

      expect(techniques).toHaveLength(8);
    });
  });

  describe('TechniqueProfile', () => {
    it('should create valid technique profile', () => {
      const profile: TechniqueProfile = {
        techniqueId: 'spaced_repetition',
        measuredEffectSize: 0.82,
        predictedEffectSize: 0.75,
        confidenceInterval: [0.65, 0.95],
        sampleSize: 50,
        lastUpdated: new Date(),
        effectTrend: 'increasing',
      };

      expect(profile.measuredEffectSize).toBeGreaterThan(0);
      expect(profile.confidenceInterval[0]).toBeLessThan(profile.confidenceInterval[1]);
    });

    it('should accept all trend values', () => {
      const trends: TechniqueProfile['effectTrend'][] = ['increasing', 'stable', 'decreasing'];
      expect(trends).toHaveLength(3);
    });
  });

  describe('LearnerTechniqueProfile', () => {
    it('should create valid learner profile', () => {
      const profile: LearnerTechniqueProfile = {
        learnerId: 'learner-123',
        techniqueEffectiveness: {} as any,
        techniqueSynergies: [
          {
            techniques: ['retrieval_practice', 'spaced_repetition'],
            combinedEffect: 1.2,
            sampleSize: 25,
          },
        ],
        techniqueInterference: [
          {
            techniques: ['interleaving', 'deliberate_practice'],
            negativeEffect: -0.1,
            sampleSize: 10,
          },
        ],
        domainPreferences: {
          math: {
            preferredTechniques: ['retrieval_practice', 'deliberate_practice'],
            avoidTechniques: ['dual_coding'],
          },
        },
      };

      expect(profile.learnerId).toBe('learner-123');
      expect(profile.techniqueSynergies[0].combinedEffect).toBeGreaterThan(1);
    });
  });

  // ==========================================================================
  // BE Standards Tests
  // ==========================================================================

  describe('BEStandardId', () => {
    it('should define all behavioral economics standards', () => {
      const standards: BEStandardId[] = [
        // BE-1: Cognitive Biases
        'BE-1.1', 'BE-1.2', 'BE-1.3', 'BE-1.4', 'BE-1.5',
        // BE-2: Decision Frameworks
        'BE-2.1', 'BE-2.2', 'BE-2.3', 'BE-2.4',
        // BE-3: Calibration
        'BE-3.1', 'BE-3.2', 'BE-3.3', 'BE-3.4',
        // BE-4: Metacognition
        'BE-4.1', 'BE-4.2', 'BE-4.3', 'BE-4.4',
      ];

      expect(standards).toHaveLength(17);
    });
  });

  describe('BEStandard', () => {
    it('should create valid BE standard', () => {
      const standard: BEStandard = {
        id: 'BE-1.1',
        category: 'biases',
        title: 'Identify Confirmation Bias',
        description: 'Students can recognize when confirmation bias is at play',
        performanceIndicators: [
          'Identifies confirmation bias in scenarios',
          'Explains why it occurs',
          'Proposes mitigation strategies',
        ],
        prerequisites: [],
        assessmentTypes: ['scenario', 'reflection', 'application'],
        difficultyLevels: {
          recognition: 'Can spot obvious examples',
          understanding: 'Can explain the mechanism',
          application: 'Can catch it in self',
          transfer: 'Can identify in novel domains',
          creation: 'Can design assessments for others',
        },
        manifoldDimensions: {
          coherence: 0.3,
          entropy: 0.5,
          generativity: 0.4,
        },
      };

      expect(standard.category).toBe('biases');
      expect(standard.performanceIndicators.length).toBeGreaterThan(0);
    });

    it('should accept all category values', () => {
      const categories: BEStandard['category'][] = ['biases', 'frameworks', 'calibration', 'metacognition'];
      expect(categories).toHaveLength(4);
    });
  });

  // ==========================================================================
  // Extended Manifold Tests
  // ==========================================================================

  describe('ExtendedManifoldState', () => {
    it('should create valid extended manifold state', () => {
      const state: ExtendedManifoldState = {
        coherence: 70,
        entropy: 45,
        generativity: 60,
        epistemicCalibration: {
          calibrationScore: 50,
          brierScore: 0.2,
          domainCalibration: {},
          calibrationHistory: [],
          calibrationCurve: [],
        },
        biasAwareness: {
          overallScore: 65,
          biasRecognition: {},
          biasMitigation: {},
          situationalAwareness: { score: 60, highRiskSituations: [], personalTriggers: [] },
          transferAbility: { score: 55, successfulTransfers: 5, totalTransferAttempts: 10 },
        },
        decisionQuality: {
          processMetrics: {
            optionsGenerated: 70,
            evidenceSought: 75,
            distanceAttained: 65,
            preparationLevel: 60,
            overallProcessScore: 67.5,
          },
          decisionHistory: [],
          correlation: { processOutcomeCorrelation: 0.5, sampleSize: 20, confidenceInterval: [0.3, 0.7] },
        },
        enhancedMetacognition: {
          phaseScores: {} as any,
          whyUnderstanding: { curriculumAwareness: 60, schemaIntegration: 55, transferRecognition: 50, applicationGeneration: 45 },
          understandingIndicators: { paraphrasingAbility: 70, exampleGeneration: 65, boundaryRecognition: 60, farTransfer: 50, conceptualStability: 75 },
          illusionOfKnowledgeIndex: 30,
        },
        techniqueProfile: {
          learnerId: 'test-learner',
          techniqueEffectiveness: {} as any,
          techniqueSynergies: [],
          techniqueInterference: [],
          domainPreferences: {},
        },
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      expect(state.coherence).toBe(70);
      expect(state.epistemicCalibration.calibrationScore).toBe(50);
      expect(state.version).toBe('1.0.0');
    });
  });

  // ==========================================================================
  // Question Types Tests
  // ==========================================================================

  describe('BEQuestionType', () => {
    it('should define all question types', () => {
      const types: BEQuestionType[] = [
        'bias_recognition',
        'bias_explanation',
        'debiasing_selection',
        'scenario_analysis',
        'wrap_application',
        'probability_estimate',
        'metacognitive_prompt',
        'transfer_challenge',
      ];

      expect(types).toHaveLength(8);
    });
  });

  describe('BEQuestion', () => {
    it('should create valid BE question', () => {
      const question: BEQuestion = {
        id: 'q-be-001',
        type: 'bias_recognition',
        standardsAddressed: ['BE-1.1', 'BE-1.2'],
        scenario: 'A manager only reviews positive feedback about their strategy...',
        question: 'Which cognitive bias is the manager exhibiting?',
        options: ['Confirmation bias', 'Anchoring effect', 'Loss aversion', 'Hindsight bias'],
        correctAnswer: 'Confirmation bias',
        explanation: {
          why: 'The manager is selectively seeking information that confirms their existing belief',
          common_errors: ['Confusing with hindsight bias'],
          deeper_understanding: 'This relates to motivated reasoning...',
        },
        difficulty: 0.5,
        discrimination: 1.2,
        targetManifold: {
          minCoherence: 40,
          targetBiasAwareness: ['confirmation_bias'],
        },
      };

      expect(question.type).toBe('bias_recognition');
      expect(question.standardsAddressed).toContain('BE-1.1');
      expect(question.difficulty).toBeGreaterThanOrEqual(-3);
      expect(question.difficulty).toBeLessThanOrEqual(3);
    });
  });

  // ==========================================================================
  // Utility Types Tests
  // ==========================================================================

  describe('BEEvent', () => {
    it('should create valid BE event', () => {
      const event: BEEvent<{ questionId: string; correct: boolean }> = {
        timestamp: new Date(),
        eventType: 'question_answered',
        learnerId: 'learner-123',
        data: { questionId: 'q-001', correct: true },
        manifoldSnapshot: { c: 70, e: 45, g: 60 },
      };

      expect(event.eventType).toBe('question_answered');
      expect(event.data.correct).toBe(true);
      expect(event.manifoldSnapshot.c).toBe(70);
    });
  });

  describe('BEModuleConfig', () => {
    it('should create valid module config', () => {
      const config: BEModuleConfig = {
        enabledBiases: ['confirmation_bias', 'anchoring_effect', 'loss_aversion'],
        enabledWRAPStages: ['widen', 'reality_test', 'prepare_wrong'],
        metacognitionLevel: 'intermediate',
        calibrationFrequency: 'every_session',
        journalingRequired: true,
        crossCurriculumIntegration: true,
      };

      expect(config.enabledBiases).toHaveLength(3);
      expect(config.metacognitionLevel).toBe('intermediate');
    });

    it('should accept all metacognition levels', () => {
      const levels: BEModuleConfig['metacognitionLevel'][] = ['basic', 'intermediate', 'advanced'];
      expect(levels).toHaveLength(3);
    });

    it('should accept all calibration frequencies', () => {
      const frequencies: BEModuleConfig['calibrationFrequency'][] = ['every_session', 'weekly', 'on_demand'];
      expect(frequencies).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty calibration history', () => {
      const calibration: EpistemicCalibration = {
        calibrationScore: 50,
        brierScore: 0,
        domainCalibration: {},
        calibrationHistory: [],
        calibrationCurve: [],
      };

      expect(calibration.calibrationHistory).toHaveLength(0);
    });

    it('should handle perfect calibration score', () => {
      const calibration: EpistemicCalibration = {
        calibrationScore: 50, // Perfect calibration
        brierScore: 0,
        domainCalibration: {},
        calibrationHistory: [],
        calibrationCurve: [],
      };

      expect(calibration.calibrationScore).toBe(50);
    });

    it('should handle zero illusion of knowledge', () => {
      const meta: EnhancedMetacognition = {
        phaseScores: {} as any,
        whyUnderstanding: { curriculumAwareness: 100, schemaIntegration: 100, transferRecognition: 100, applicationGeneration: 100 },
        understandingIndicators: { paraphrasingAbility: 100, exampleGeneration: 100, boundaryRecognition: 100, farTransfer: 100, conceptualStability: 100 },
        illusionOfKnowledgeIndex: 0, // No illusion
      };

      expect(meta.illusionOfKnowledgeIndex).toBe(0);
    });

    it('should handle extreme difficulty values', () => {
      const easyQuestion: BEQuestion = {
        id: 'easy',
        type: 'bias_recognition',
        standardsAddressed: ['BE-1.1'],
        scenario: 'Simple scenario',
        question: 'Easy question',
        correctAnswer: 'Answer',
        explanation: { why: '', common_errors: [], deeper_understanding: '' },
        difficulty: -3, // Minimum
        discrimination: 0.5,
        targetManifold: {},
      };

      const hardQuestion: BEQuestion = {
        id: 'hard',
        type: 'transfer_challenge',
        standardsAddressed: ['BE-4.4'],
        scenario: 'Complex scenario',
        question: 'Hard question',
        correctAnswer: 'Answer',
        explanation: { why: '', common_errors: [], deeper_understanding: '' },
        difficulty: 3, // Maximum
        discrimination: 2.0,
        targetManifold: {},
      };

      expect(easyQuestion.difficulty).toBe(-3);
      expect(hardQuestion.difficulty).toBe(3);
    });
  });
});
