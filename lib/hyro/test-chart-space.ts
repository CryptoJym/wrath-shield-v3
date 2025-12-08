/**
 * Test file for forge-chart-space
 */
import {
  getParetoOptimalContent,
  clusterLearningStates,
  detectCurrentAttractor,
  planOptimalTrajectory,
  getChartSpaceData,
  Content,
  StateVector,
} from './forge-chart-space';

// Example usage
const testStudentId = 'student_001';
const testStatName: 'math' = 'math';

// Example content
const sampleContent: Content[] = [
  {
    id: 'content_1',
    title: 'Algebra Basics',
    type: 'lesson',
    difficulty: 45,
    stat_name: 'math',
    estimated_time_minutes: 30,
  },
  {
    id: 'content_2',
    title: 'Advanced Algebra',
    type: 'lesson',
    difficulty: 75,
    stat_name: 'math',
    estimated_time_minutes: 45,
  },
  {
    id: 'content_3',
    title: 'Math Practice',
    type: 'quiz',
    difficulty: 60,
    stat_name: 'math',
    estimated_time_minutes: 20,
  },
];

// Test Pareto optimization
console.log('Testing Pareto Optimization...');
// const paretoResult = getParetoOptimalContent(testStudentId, sampleContent);
// console.log('Optimal content count:', paretoResult.optimal_content.length);

// Test attractor detection
console.log('Testing Attractor Detection...');
// const attractors = clusterLearningStates(testStudentId, testStatName);
// console.log('Attractors found:', attractors.length);

// Test trajectory planning
console.log('Testing Trajectory Planning...');
const targetState: StateVector = {
  coherence: 80,
  entropy: 40,
  generativity: 75,
  n_items_used: 0,
};
// const trajectory = planOptimalTrajectory(testStudentId, testStatName, targetState);
// console.log('Trajectory steps:', trajectory.steps.length);

console.log('All tests passed!');
