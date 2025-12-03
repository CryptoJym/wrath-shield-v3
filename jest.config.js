/** @type {import('jest').Config} */

// Shared settings for all projects
const sharedConfig = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};

const config = {
  ...sharedConfig,
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    // E2E tests require running server - run separately with --testPathPattern=e2e
    '/__tests__/e2e/',
    // React component tests require jsdom - run with jest.config.react.js
    '/__tests__/components/',
    '/__tests__/integration/',
  ],
  collectCoverageFrom: [
    'lib/hyro/**/*.ts',
    'lib/agents/**/*.ts',
    'lib/memory/**/*.ts',
    'app/api/orchestrator/**/*.ts',
    '!**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },
  verbose: true,
  testTimeout: 30000,
};

module.exports = config;
