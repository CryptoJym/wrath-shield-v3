// @ts-nocheck
/**
 * Tests for Decision Framework Types
 *
 * Tests type definitions for decision science education including:
 * - Pre-mortem analysis (Gary Klein)
 * - Choice Architecture / Nudge design (Thaler & Sunstein)
 * - Probabilistic Thinking (Annie Duke)
 * - Strategic Thinking dimensions
 * - Decision Science standards
 * - Decision journaling
 */

import { jest, describe, it, expect } from '@jest/globals';

import type {
  PreMortemAnalysis,
  PreMortemSession,
  NudgeType,
  NudgeDesign,
  ChoiceArchitectureQuestion,
  DecisionBet,
  ResultingAnalysis,
  StrategicThinking,
  DSStandardId,
  DSStandard,
  DecisionJournalEntry,
  DecisionJournalAnalytics,
  DecisionExercise,
  DecisionExerciseSubmission,
} from '../../../lib/hyro/decision-framework-types';

describe('Decision Framework Types', () => {
  // ==========================================================================
  // Pre-Mortem Tests
  // ==========================================================================

  describe('PreMortemAnalysis', () => {
    it('should create valid pre-mortem analysis', () => {
      const analysis: PreMortemAnalysis = {
        id: 'pm-123',
        decisionId: 'dec-456',
        decision: 'Launch new curriculum next semester',
        stakeholders: ['Teachers', 'Students', 'Parents', 'Administrators'],
        timeframe: '6 months',
        createdAt: new Date(),
        failureScenario: {
          dateOfFailure: '6 months from now',
          description: 'The new curriculum failed because student engagement dropped significantly',
          severity: 'severe',
        },
        failureCauses: [
          {
            id: 'cause-1',
            cause: 'Teachers not adequately trained',
            likelihood: 60,
            impact: 80,
            riskScore: 48,
            category: 'execution',
            detectionDifficulty: 'moderate',
          },
          {
            id: 'cause-2',
            cause: 'Materials not ready on time',
            likelihood: 40,
            impact: 70,
            riskScore: 28,
            category: 'internal',
            detectionDifficulty: 'easy',
          },
        ],
        mitigations: [
          {
            id: 'mit-1',
            failureCauseId: 'cause-1',
            action: 'Schedule training workshops 2 months before launch',
            owner: 'Curriculum Director',
            deadline: '4 months from now',
            status: 'planned',
            effectiveness: null,
          },
        ],
        tripwires: [
          {
            id: 'tw-1',
            failureCauseId: 'cause-1',
            condition: 'Less than 80% of teachers complete training by deadline',
            action: 'Delay launch by one month',
            checkFrequency: 'weekly',
            lastChecked: null,
            triggered: false,
            triggeredAt: null,
          },
        ],
        postMortemLink: undefined,
      };

      expect(analysis.id).toBe('pm-123');
      expect(analysis.failureCauses).toHaveLength(2);
      expect(analysis.mitigations).toHaveLength(1);
      expect(analysis.tripwires).toHaveLength(1);
    });

    it('should accept all severity levels', () => {
      const severities: PreMortemAnalysis['failureScenario']['severity'][] = [
        'minor', 'moderate', 'severe', 'catastrophic'
      ];
      expect(severities).toHaveLength(4);
    });

    it('should accept all failure cause categories', () => {
      const categories: PreMortemAnalysis['failureCauses'][0]['category'][] = [
        'internal', 'external', 'execution', 'assumption', 'unknown'
      ];
      expect(categories).toHaveLength(5);
    });

    it('should accept all detection difficulty levels', () => {
      const difficulties: PreMortemAnalysis['failureCauses'][0]['detectionDifficulty'][] = [
        'easy', 'moderate', 'hard', 'very_hard'
      ];
      expect(difficulties).toHaveLength(4);
    });

    it('should accept all mitigation statuses', () => {
      const statuses: PreMortemAnalysis['mitigations'][0]['status'][] = [
        'planned', 'in_progress', 'completed', 'abandoned'
      ];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('PreMortemSession', () => {
    it('should create valid pre-mortem session', () => {
      const session: PreMortemSession = {
        id: 'session-123',
        learnerId: 'learner-456',
        decision: 'Whether to adopt new testing software',
        phase: 'brainstorm',
        brainstormStartTime: new Date(),
        brainstormDuration: 10,
        contributions: [
          {
            participantId: 'learner-456',
            failureCause: 'Software compatibility issues',
            timestamp: new Date(),
          },
        ],
        analysis: null,
        metrics: {
          causesGenerated: 5,
          uniqueCategories: 3,
          mitigationsPlanned: 2,
          tripwiresSet: 1,
          qualityScore: 75,
        },
      };

      expect(session.phase).toBe('brainstorm');
      expect(session.contributions).toHaveLength(1);
      expect(session.metrics.causesGenerated).toBe(5);
    });

    it('should accept all session phases', () => {
      const phases: PreMortemSession['phase'][] = [
        'setup', 'imagine_failure', 'brainstorm', 'prioritize', 'mitigate', 'review'
      ];
      expect(phases).toHaveLength(6);
    });
  });

  // ==========================================================================
  // Choice Architecture / Nudge Tests
  // ==========================================================================

  describe('NudgeType', () => {
    it('should define all 12 nudge types', () => {
      const nudges: NudgeType[] = [
        'default_option',
        'feedback_loop',
        'simplification',
        'social_proof',
        'salience',
        'commitment_device',
        'implementation_intention',
        'cooling_off_period',
        'structured_choice',
        'mapping',
        'error_expected',
        'incentive_alignment',
      ];

      expect(nudges).toHaveLength(12);
    });
  });

  describe('NudgeDesign', () => {
    it('should create valid nudge design', () => {
      const nudge: NudgeDesign = {
        id: 'nudge-001',
        name: 'Default Healthy Options',
        nudgeType: 'default_option',
        targetBehavior: 'Students choose healthy lunch options',
        currentBehavior: 'Students often choose less healthy options',
        behaviorGap: 'Unhealthy options are more prominently displayed',
        intervention: 'Place healthy options at the front of the line as defaults',
        mechanism: 'Status quo bias and reduced cognitive effort favor defaults',
        ethicalConsiderations: 'Transparent - students still free to choose any option',
        implementation: {
          difficulty: 'easy',
          cost: 'low',
          reversibility: 'easily_reversible',
          timeline: '1 week',
        },
        expectedOutcome: {
          effectSize: 25,
          confidence: 70,
          timeToEffect: 'immediate',
        },
        evaluationPlan: {
          metrics: ['Healthy option selection rate', 'Student satisfaction'],
          controlGroup: true,
          sampleSize: 200,
          duration: '4 weeks',
        },
      };

      expect(nudge.nudgeType).toBe('default_option');
      expect(nudge.implementation.difficulty).toBe('easy');
      expect(nudge.expectedOutcome.effectSize).toBe(25);
    });

    it('should accept all implementation difficulty levels', () => {
      const difficulties: NudgeDesign['implementation']['difficulty'][] = ['easy', 'moderate', 'hard'];
      expect(difficulties).toHaveLength(3);
    });

    it('should accept all cost levels', () => {
      const costs: NudgeDesign['implementation']['cost'][] = ['low', 'medium', 'high'];
      expect(costs).toHaveLength(3);
    });

    it('should accept all reversibility levels', () => {
      const reversibilities: NudgeDesign['implementation']['reversibility'][] = [
        'easily_reversible', 'reversible', 'hard_to_reverse'
      ];
      expect(reversibilities).toHaveLength(3);
    });
  });

  describe('ChoiceArchitectureQuestion', () => {
    it('should create valid choice architecture question', () => {
      const question: ChoiceArchitectureQuestion = {
        id: 'caq-001',
        scenario: 'A school cafeteria wants to increase vegetable consumption...',
        currentDesign: 'Vegetables are placed at the end of the line',
        targetBehavior: 'Students choose more vegetables',
        question: 'Which nudge type would be most effective here?',
        questionType: 'identify_nudge',
        options: [
          { id: 'a', option: 'Default option', isCorrect: false, explanation: 'Not applicable here' },
          { id: 'b', option: 'Salience', isCorrect: true, explanation: 'Making vegetables more visible increases selection' },
          { id: 'c', option: 'Cooling off period', isCorrect: false, explanation: 'Not relevant for food choices' },
        ],
        difficulty: 0.5,
        standardsAddressed: ['DS-2.1', 'DS-2.2'],
      };

      expect(question.questionType).toBe('identify_nudge');
      expect(question.options).toHaveLength(3);
      expect(question.options?.find(o => o.isCorrect)?.id).toBe('b');
    });

    it('should accept all question types', () => {
      const types: ChoiceArchitectureQuestion['questionType'][] = [
        'identify_nudge', 'design_nudge', 'evaluate_nudge', 'improve_design'
      ];
      expect(types).toHaveLength(4);
    });
  });

  // ==========================================================================
  // Probabilistic Thinking Tests
  // ==========================================================================

  describe('DecisionBet', () => {
    it('should create valid decision bet', () => {
      const bet: DecisionBet = {
        id: 'bet-001',
        learnerId: 'learner-123',
        decision: 'Should we use online vs. in-person tutoring?',
        alternatives: ['Online tutoring', 'In-person tutoring', 'Hybrid approach'],
        chosenAlternative: 'Hybrid approach',
        outcomeEstimates: [
          {
            outcome: 'High engagement, improved scores',
            probability: 50,
            confidence: 70,
            value: 80,
            reasoning: 'Best of both worlds, flexibility',
          },
          {
            outcome: 'Moderate engagement, slight improvement',
            probability: 35,
            confidence: 60,
            value: 40,
            reasoning: 'May face coordination challenges',
          },
          {
            outcome: 'Low engagement, no improvement',
            probability: 15,
            confidence: 50,
            value: -30,
            reasoning: 'Could fall between two stools',
          },
        ],
        expectedValue: 52.5,
        riskProfile: {
          worstCase: { outcome: 'Complete failure', probability: 5, impact: -100 },
          bestCase: { outcome: 'Exceeds expectations', probability: 10, impact: 100 },
          mostLikely: { outcome: 'Moderate success', probability: 50, impact: 40 },
        },
        processQuality: {
          widenedOptions: true,
          realityTested: true,
          attainedDistance: false,
          preparedForWrong: true,
          overallScore: 75,
        },
        createdAt: new Date(),
        decidedAt: new Date(),
        actualOutcome: {
          outcome: 'High engagement achieved',
          assessedAt: new Date(),
          matchedPrediction: true,
          luckFactor: 'mostly_skill',
          lessonsLearned: 'Hybrid works when well-coordinated',
        },
      };

      expect(bet.alternatives).toHaveLength(3);
      expect(bet.outcomeEstimates).toHaveLength(3);
      expect(bet.expectedValue).toBeGreaterThan(0);
    });

    it('should accept all luck factor values', () => {
      const factors: NonNullable<DecisionBet['actualOutcome']>['luckFactor'][] = [
        'mostly_skill', 'mixed', 'mostly_luck'
      ];
      expect(factors).toHaveLength(3);
    });
  });

  describe('ResultingAnalysis', () => {
    it('should create valid resulting analysis', () => {
      const analysis: ResultingAnalysis = {
        decisionId: 'dec-001',
        decisionQuality: 'good',
        outcomeQuality: 'good',
        classification: 'deserved_success',
        skillVsLuckRatio: 0.7,
        baseRateComparison: 'Outperformed base rate of 60% success',
        counterfactualAnalysis: 'If chosen in-person only, likely 70% success but higher cost',
        keyLessons: ['Hybrid approach works when commitment is strong'],
        processImprovements: ['Document decisions more thoroughly'],
      };

      expect(analysis.classification).toBe('deserved_success');
      expect(analysis.skillVsLuckRatio).toBeGreaterThan(0);
    });

    it('should accept all classification values', () => {
      const classifications: ResultingAnalysis['classification'][] = [
        'deserved_success', 'bad_luck', 'dumb_luck', 'deserved_failure'
      ];
      expect(classifications).toHaveLength(4);
    });

    it('should handle all 2x2 matrix combinations', () => {
      const goodGood: ResultingAnalysis = {
        decisionId: '1', decisionQuality: 'good', outcomeQuality: 'good',
        classification: 'deserved_success', skillVsLuckRatio: 0.8,
        baseRateComparison: '', counterfactualAnalysis: '', keyLessons: [], processImprovements: [],
      };

      const goodBad: ResultingAnalysis = {
        decisionId: '2', decisionQuality: 'good', outcomeQuality: 'bad',
        classification: 'bad_luck', skillVsLuckRatio: 0.2,
        baseRateComparison: '', counterfactualAnalysis: '', keyLessons: [], processImprovements: [],
      };

      const badGood: ResultingAnalysis = {
        decisionId: '3', decisionQuality: 'bad', outcomeQuality: 'good',
        classification: 'dumb_luck', skillVsLuckRatio: -0.5,
        baseRateComparison: '', counterfactualAnalysis: '', keyLessons: [], processImprovements: [],
      };

      const badBad: ResultingAnalysis = {
        decisionId: '4', decisionQuality: 'bad', outcomeQuality: 'bad',
        classification: 'deserved_failure', skillVsLuckRatio: -0.8,
        baseRateComparison: '', counterfactualAnalysis: '', keyLessons: [], processImprovements: [],
      };

      expect(goodGood.classification).toBe('deserved_success');
      expect(goodBad.classification).toBe('bad_luck');
      expect(badGood.classification).toBe('dumb_luck');
      expect(badBad.classification).toBe('deserved_failure');
    });
  });

  // ==========================================================================
  // Strategic Thinking Tests
  // ==========================================================================

  describe('StrategicThinking', () => {
    it('should create valid strategic thinking profile', () => {
      const strategic: StrategicThinking = {
        overallScore: 68,
        optionGeneration: {
          score: 72,
          fluency: 8,
          diversity: 75,
          quality: 70,
          trend: 'improving',
        },
        consequenceMapping: {
          score: 65,
          depth: 3,
          breadth: 4,
          accuracy: 60,
          trend: 'stable',
        },
        uncertaintyHandling: {
          score: 62,
          calibration: 55,
          rangeEstimation: 60,
          scenarioPlanning: 70,
          trend: 'improving',
        },
        adaptability: {
          score: 73,
          pivotSpeed: 75,
          sunkCostResistance: 70,
          openMindedness: 74,
          trend: 'stable',
        },
        history: [
          {
            timestamp: new Date(),
            decisionId: 'dec-001',
            scores: {
              optionGeneration: 70,
              consequenceMapping: 65,
              uncertaintyHandling: 60,
              adaptability: 72,
            },
          },
        ],
      };

      expect(strategic.overallScore).toBe(68);
      expect(strategic.optionGeneration.fluency).toBe(8);
      expect(strategic.history).toHaveLength(1);
    });

    it('should accept all trend values', () => {
      const trends: StrategicThinking['optionGeneration']['trend'][] = [
        'improving', 'stable', 'declining'
      ];
      expect(trends).toHaveLength(3);
    });
  });

  // ==========================================================================
  // DS Standards Tests
  // ==========================================================================

  describe('DSStandardId', () => {
    it('should define all decision science standards', () => {
      const standards: DSStandardId[] = [
        // DS-1: Pre-mortem
        'DS-1.1', 'DS-1.2', 'DS-1.3', 'DS-1.4',
        // DS-2: Choice Architecture
        'DS-2.1', 'DS-2.2', 'DS-2.3', 'DS-2.4',
        // DS-3: Probabilistic Thinking
        'DS-3.1', 'DS-3.2', 'DS-3.3', 'DS-3.4',
        // DS-4: Integration
        'DS-4.1', 'DS-4.2', 'DS-4.3', 'DS-4.4',
      ];

      expect(standards).toHaveLength(16);
    });
  });

  describe('DSStandard', () => {
    it('should create valid DS standard', () => {
      const standard: DSStandard = {
        id: 'DS-1.1',
        category: 'premortem',
        title: 'Conduct Basic Pre-mortem Analysis',
        description: 'Students can facilitate a basic pre-mortem session',
        performanceIndicators: [
          'Can set up failure scenario',
          'Can brainstorm failure causes',
          'Can prioritize by risk',
        ],
        prerequisites: [],
        assessmentTypes: ['scenario', 'design', 'application'],
        difficultyLevels: {
          recognition: 'Understands pre-mortem purpose',
          understanding: 'Can explain why it works',
          application: 'Can conduct own pre-mortem',
          transfer: 'Can apply to novel domains',
          creation: 'Can design variations',
        },
        manifoldDimensions: {
          coherence: 0.4,
          entropy: 0.3,
          generativity: 0.5,
          strategicThinking: 0.8,
        },
      };

      expect(standard.category).toBe('premortem');
      expect(standard.manifoldDimensions.strategicThinking).toBe(0.8);
    });

    it('should accept all category values', () => {
      const categories: DSStandard['category'][] = [
        'premortem', 'choice_architecture', 'probabilistic', 'integration'
      ];
      expect(categories).toHaveLength(4);
    });
  });

  // ==========================================================================
  // Decision Journal Tests
  // ==========================================================================

  describe('DecisionJournalEntry', () => {
    it('should create valid journal entry', () => {
      const entry: DecisionJournalEntry = {
        id: 'entry-001',
        learnerId: 'learner-123',
        priorRecord: {
          timestamp: new Date(),
          decision: 'Whether to take advanced math',
          context: 'Choosing next semester courses',
          options: ['Regular math', 'Advanced math', 'Statistics'],
          chosenOption: 'Advanced math',
          reasoning: 'Want to challenge myself and prepare for college',
          keyAssumptions: ['I can handle the workload', 'Teacher is supportive'],
          predictions: [
            { prediction: 'Get A or B', probability: 70, confidence: 65 },
            { prediction: 'Find it too hard', probability: 20, confidence: 50 },
          ],
          emotionalState: {
            stress: 40,
            time_pressure: 30,
            confidence: 65,
          },
          processApplied: {
            wrapScore: 75,
            premortemDone: true,
            probabilitiesEstimated: true,
          },
        },
        outcomeRecord: {
          timestamp: new Date(),
          actualOutcome: 'Got B+, learned a lot',
          surprises: ['Teacher changed mid-semester'],
          assumptionsViolated: ['Original teacher was supportive'],
          predictionAccuracy: 80,
          resultingClassification: 'deserved_success',
          processEvaluation: 85,
          lessonsLearned: ['Build margin for uncertainty'],
          processImprovements: ['Consider contingencies for external changes'],
        },
        metaAnalysis: {
          hindsightBiasCheck: true,
          skillVsLuck: 0.6,
          wouldDecideAgain: true,
          integrationWithOtherDecisions: ['College prep decisions'],
        },
      };

      expect(entry.priorRecord.predictions).toHaveLength(2);
      expect(entry.outcomeRecord?.resultingClassification).toBe('deserved_success');
    });
  });

  describe('DecisionJournalAnalytics', () => {
    it('should create valid journal analytics', () => {
      const analytics: DecisionJournalAnalytics = {
        learnerId: 'learner-123',
        totalDecisions: 20,
        decisionsWithOutcomes: 15,
        processQualityTrend: [
          { month: '2025-01', averageWrapScore: 60, premortemRate: 0.3, probabilityEstimationRate: 0.5 },
          { month: '2025-02', averageWrapScore: 68, premortemRate: 0.5, probabilityEstimationRate: 0.7 },
        ],
        calibration: {
          overall: 55,
          byConfidenceLevel: {
            70: { predicted: 70, actual: 65, n: 10 },
            80: { predicted: 80, actual: 78, n: 8 },
          },
          trend: 'improving',
        },
        resultingDistribution: {
          deservedSuccess: 8,
          badLuck: 2,
          dumbLuck: 1,
          deservedFailure: 4,
        },
        patterns: {
          commonAssumptionFailures: ['Underestimated time needed'],
          blindSpots: ['External dependencies'],
          strengths: ['Option generation', 'Reality testing'],
          improvementAreas: ['Distance before deciding'],
        },
      };

      expect(analytics.totalDecisions).toBe(20);
      expect(analytics.resultingDistribution.deservedSuccess).toBe(8);
      expect(analytics.calibration.trend).toBe('improving');
    });
  });

  // ==========================================================================
  // Exercise Types Tests
  // ==========================================================================

  describe('DecisionExercise', () => {
    it('should create valid exercise', () => {
      const exercise: DecisionExercise = {
        id: 'ex-001',
        exerciseType: 'premortem',
        scenario: 'Your school is considering switching to year-round scheduling...',
        context: 'School administration decision',
        stakeholders: ['Students', 'Teachers', 'Parents', 'Staff'],
        constraints: ['Budget-neutral', 'Union agreement required'],
        hints: ['Consider summer learning loss', 'Think about teacher burnout'],
        scaffolding: [
          { step: 1, prompt: 'Define the decision clearly', example: 'Switch to year-round scheduling by Fall 2026' },
          { step: 2, prompt: 'Imagine it failed. What happened?' },
        ],
        rubric: {
          criteria: [
            { name: 'Failure causes', description: 'Generated diverse failure modes', maxPoints: 30 },
            { name: 'Mitigations', description: 'Created actionable mitigations', maxPoints: 40 },
            { name: 'Tripwires', description: 'Set measurable tripwires', maxPoints: 30 },
          ],
          totalPoints: 100,
          passingScore: 70,
        },
        difficulty: 1.0,
        estimatedMinutes: 30,
        standardsAddressed: ['DS-1.1', 'DS-1.2', 'DS-1.3'],
        prerequisiteExercises: [],
      };

      expect(exercise.exerciseType).toBe('premortem');
      expect(exercise.rubric.totalPoints).toBe(100);
      expect(exercise.standardsAddressed).toContain('DS-1.1');
    });

    it('should accept all exercise types', () => {
      const types: DecisionExercise['exerciseType'][] = [
        'premortem', 'nudge_design', 'bet_framing', 'resulting_analysis', 'journal_review'
      ];
      expect(types).toHaveLength(5);
    });
  });

  describe('DecisionExerciseSubmission', () => {
    it('should create valid submission', () => {
      const submission: DecisionExerciseSubmission = {
        id: 'sub-001',
        exerciseId: 'ex-001',
        learnerId: 'learner-123',
        submission: {
          failureCauses: ['Budget overrun', 'Teacher resistance'],
          mitigations: ['Phase implementation', 'Pilot program'],
          tripwires: ['Budget exceeds 110%', 'Teacher satisfaction drops below 60%'],
        },
        submittedAt: new Date(),
        timeSpentMinutes: 25,
        evaluation: {
          scores: {
            'Failure causes': 25,
            'Mitigations': 35,
            'Tripwires': 28,
          },
          totalScore: 88,
          passed: true,
          feedback: 'Strong analysis with diverse failure modes',
          strengthsIdentified: ['Creative failure modes', 'Measurable tripwires'],
          areasForImprovement: ['Consider more stakeholder perspectives'],
          suggestedNextExercises: ['ex-002', 'ex-003'],
        },
        manifoldUpdates: {
          strategicThinkingDelta: 2.5,
          coherenceDelta: 1.0,
          entropyDelta: -0.5,
          generativityDelta: 1.5,
        },
      };

      expect(submission.evaluation.passed).toBe(true);
      expect(submission.evaluation.totalScore).toBe(88);
      expect(submission.manifoldUpdates.strategicThinkingDelta).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty pre-mortem analysis', () => {
      const emptyAnalysis: PreMortemAnalysis = {
        id: 'pm-empty',
        decisionId: 'dec-empty',
        decision: 'Test decision',
        stakeholders: [],
        timeframe: '',
        createdAt: new Date(),
        failureScenario: {
          dateOfFailure: '',
          description: '',
          severity: 'minor',
        },
        failureCauses: [],
        mitigations: [],
        tripwires: [],
      };

      expect(emptyAnalysis.failureCauses).toHaveLength(0);
      expect(emptyAnalysis.mitigations).toHaveLength(0);
    });

    it('should handle extreme difficulty values', () => {
      const easyExercise: DecisionExercise = {
        id: 'easy',
        exerciseType: 'bet_framing',
        scenario: '',
        context: '',
        stakeholders: [],
        constraints: [],
        rubric: { criteria: [], totalPoints: 100, passingScore: 70 },
        difficulty: -3, // Minimum
        estimatedMinutes: 10,
        standardsAddressed: [],
        prerequisiteExercises: [],
      };

      const hardExercise: DecisionExercise = {
        id: 'hard',
        exerciseType: 'resulting_analysis',
        scenario: '',
        context: '',
        stakeholders: [],
        constraints: [],
        rubric: { criteria: [], totalPoints: 100, passingScore: 70 },
        difficulty: 3, // Maximum
        estimatedMinutes: 60,
        standardsAddressed: [],
        prerequisiteExercises: [],
      };

      expect(easyExercise.difficulty).toBe(-3);
      expect(hardExercise.difficulty).toBe(3);
    });

    it('should handle skillVsLuckRatio extremes', () => {
      const allSkill: ResultingAnalysis = {
        decisionId: 'skill',
        decisionQuality: 'good',
        outcomeQuality: 'good',
        classification: 'deserved_success',
        skillVsLuckRatio: 1, // All skill
        baseRateComparison: '',
        counterfactualAnalysis: '',
        keyLessons: [],
        processImprovements: [],
      };

      const allLuck: ResultingAnalysis = {
        decisionId: 'luck',
        decisionQuality: 'bad',
        outcomeQuality: 'good',
        classification: 'dumb_luck',
        skillVsLuckRatio: -1, // All luck
        baseRateComparison: '',
        counterfactualAnalysis: '',
        keyLessons: [],
        processImprovements: [],
      };

      expect(allSkill.skillVsLuckRatio).toBe(1);
      expect(allLuck.skillVsLuckRatio).toBe(-1);
    });

    it('should handle journal entry without outcome', () => {
      const pendingEntry: DecisionJournalEntry = {
        id: 'pending',
        learnerId: 'learner-123',
        priorRecord: {
          timestamp: new Date(),
          decision: 'Pending decision',
          context: '',
          options: [],
          chosenOption: '',
          reasoning: '',
          keyAssumptions: [],
          predictions: [],
          emotionalState: { stress: 0, time_pressure: 0, confidence: 50 },
          processApplied: { wrapScore: 0, premortemDone: false, probabilitiesEstimated: false },
        },
        outcomeRecord: undefined, // Not yet resolved
        metaAnalysis: undefined,
      };

      expect(pendingEntry.outcomeRecord).toBeUndefined();
      expect(pendingEntry.metaAnalysis).toBeUndefined();
    });
  });
});
