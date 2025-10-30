const nextJest = require('next/jest');

// Load Next.js config and env files
const createJestConfig = nextJest({ dir: './' });

// Shared settings
const shared = {
  roots: ['<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^uuid$': require.resolve('uuid'),
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  testEnvironmentOptions: { customExportConditions: [''] },
  collectCoverageFrom: [
    'lib/**/*.ts',
    'components/**/*.{ts,tsx}',
    '!lib/**/*.d.ts',
    '!lib/**/*.test.ts',
    '!**/*.test.{ts,tsx}',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};

// Client (React) project: jsdom
const clientProject = {
  ...shared,
  displayName: 'client-jsdom',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/components/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.react.ts'],
};

// Server project: Node env for API routes and server libs
const serverProject = {
  ...shared,
  displayName: 'server-node',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/app/api/**/*.test.ts',
    '**/__tests__/integration/**/*.test.ts',
    '**/__tests__/lib/**/*.test.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.server.ts'],
};

module.exports = async () => {
  const server = await createJestConfig(serverProject)();
  const client = await createJestConfig(clientProject)();
  return { projects: [server, client] };
};
