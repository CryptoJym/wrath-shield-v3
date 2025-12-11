/**
 * Test Data Fixtures
 *
 * Reusable test data for E2E tests
 */

export const testUsers = {
  standard: {
    email: 'test@example.com',
    name: 'Test User',
  },
  admin: {
    email: 'admin@example.com',
    name: 'Admin User',
  },
};

export const testMessages = {
  simple: 'Hello, this is a test message.',
  long: 'This is a longer test message that contains multiple sentences. It should test how the system handles larger inputs. The goal is to ensure proper display and processing.',
  withCode: 'Here is some code: `console.log("hello")`',
  withMarkdown: '# Heading\n\n- Item 1\n- Item 2\n\n**Bold text**',
};

export const testTasks = [
  {
    title: 'Review weekly report',
    priority: 'high',
    domain: 'finance',
  },
  {
    title: 'Schedule team meeting',
    priority: 'medium',
    domain: 'general',
  },
  {
    title: 'Update documentation',
    priority: 'low',
    domain: 'engineering',
  },
];

export const testDomains = [
  'finance',
  'legal',
  'health',
  'engineering',
  'general',
];

export const testPriorities = ['critical', 'high', 'medium', 'low'];

/**
 * Generate a random test item
 */
export function generateRandomTask() {
  const titles = [
    'Process invoice',
    'Review contract',
    'Schedule appointment',
    'Update records',
    'Send report',
  ];

  return {
    title: titles[Math.floor(Math.random() * titles.length)],
    priority: testPriorities[Math.floor(Math.random() * testPriorities.length)],
    domain: testDomains[Math.floor(Math.random() * testDomains.length)],
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
}
