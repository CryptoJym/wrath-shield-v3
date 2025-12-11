/**
 * Logger Utility Tests
 */

import {
  createLogger,
  Logger,
  configureLogger,
  getRecentLogs,
  getLogsByModule,
  getLogsByLevel,
  clearLogBuffer,
  loggers,
} from '@/lib/logger';

describe('Logger', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleDebug: typeof console.debug;
  let capturedLogs: { method: string; args: unknown[] }[] = [];

  beforeEach(() => {
    // Clear buffer before each test
    clearLogBuffer();
    capturedLogs = [];

    // Capture console output
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalConsoleDebug = console.debug;

    console.log = (...args) => capturedLogs.push({ method: 'log', args });
    console.error = (...args) => capturedLogs.push({ method: 'error', args });
    console.warn = (...args) => capturedLogs.push({ method: 'warn', args });
    console.debug = (...args) => capturedLogs.push({ method: 'debug', args });
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.debug = originalConsoleDebug;
  });

  describe('createLogger', () => {
    it('should create a logger with specified module name', () => {
      const log = createLogger('TestModule');
      expect(log).toBeInstanceOf(Logger);
    });

    it('should include module name in output', () => {
      const log = createLogger('TestModule');
      log.info('Test message');

      expect(capturedLogs.length).toBeGreaterThan(0);
      expect(capturedLogs[0].args[0]).toContain('[TestModule]');
    });
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      const log = createLogger('Test');
      log.info('Info message');

      expect(capturedLogs[0].method).toBe('log');
      expect(capturedLogs[0].args[0]).toContain('Info message');
    });

    it('should log warn messages', () => {
      const log = createLogger('Test');
      log.warn('Warning message');

      expect(capturedLogs[0].method).toBe('warn');
      expect(capturedLogs[0].args[0]).toContain('Warning message');
    });

    it('should log error messages', () => {
      const log = createLogger('Test');
      log.error('Error message');

      expect(capturedLogs[0].method).toBe('error');
      expect(capturedLogs[0].args[0]).toContain('Error message');
    });

    it('should log debug messages', () => {
      const log = createLogger('Test', { minLevel: 'debug' });
      log.debug('Debug message');

      expect(capturedLogs.length).toBeGreaterThan(0);
      expect(capturedLogs[0].args[0]).toContain('Debug message');
    });
  });

  describe('metadata', () => {
    it('should include metadata in log output', () => {
      const log = createLogger('Test');
      log.info('Message with metadata', { key: 'value', count: 42 });

      expect(capturedLogs[0].args[0]).toContain('key=');
      expect(capturedLogs[0].args[0]).toContain('value');
    });
  });

  describe('correlation ID', () => {
    it('should include correlation ID when set', () => {
      const log = createLogger('Test');
      log.setCorrelationId('req-123');
      log.info('Correlated message');

      expect(capturedLogs[0].args[0]).toContain('req-123');
    });
  });

  describe('child logger', () => {
    it('should create child logger with combined module name', () => {
      const parent = createLogger('Parent');
      const child = parent.child('Child');

      child.info('Child message');
      expect(capturedLogs[0].args[0]).toContain('[Parent:Child]');
    });

    it('should inherit correlation ID from parent', () => {
      const parent = createLogger('Parent');
      parent.setCorrelationId('req-456');
      const child = parent.child('Child');

      child.info('Message');
      expect(capturedLogs[0].args[0]).toContain('req-456');
    });
  });

  describe('log buffer', () => {
    it('should store logs in buffer', () => {
      const log = createLogger('Buffer');
      log.info('Message 1');
      log.info('Message 2');
      log.info('Message 3');

      const logs = getRecentLogs(10);
      expect(logs.length).toBe(3);
      expect(logs[0].message).toBe('Message 1');
      expect(logs[2].message).toBe('Message 3');
    });

    it('should filter by module', () => {
      const log1 = createLogger('ModuleA');
      const log2 = createLogger('ModuleB');

      log1.info('A1');
      log2.info('B1');
      log1.info('A2');

      const logsA = getLogsByModule('ModuleA', 10);
      expect(logsA.length).toBe(2);
      expect(logsA[0].message).toBe('A1');
    });

    it('should filter by level', () => {
      const log = createLogger('Level');
      log.info('Info');
      log.warn('Warn');
      log.error('Error');

      const errors = getLogsByLevel('error', 10);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Error');
    });

    it('should clear buffer', () => {
      const log = createLogger('Clear');
      log.info('Message');
      expect(getRecentLogs().length).toBe(1);

      clearLogBuffer();
      expect(getRecentLogs().length).toBe(0);
    });
  });

  describe('specialized logging methods', () => {
    it('should log API requests', () => {
      const log = createLogger('API');
      log.apiRequest('GET', '/api/health');

      expect(capturedLogs[0].args[0]).toContain('GET /api/health');
    });

    it('should log API responses with appropriate level', () => {
      const log = createLogger('API');

      // Success
      log.apiResponse('GET', '/api/data', 200, 150);
      expect(capturedLogs[0].method).toBe('log');

      // Client error
      log.apiResponse('POST', '/api/data', 400);
      expect(capturedLogs[1].method).toBe('warn');

      // Server error
      log.apiResponse('GET', '/api/error', 500);
      expect(capturedLogs[2].method).toBe('error');
    });

    it('should log cron jobs', () => {
      const log = createLogger('Cron');
      log.cron('whoop-sync', 'started');
      log.cron('whoop-sync', 'completed');
      log.cron('whoop-sync', 'failed');

      expect(capturedLogs[0].method).toBe('log');
      expect(capturedLogs[1].method).toBe('log');
      expect(capturedLogs[2].method).toBe('error');
    });

    it('should log agent events', () => {
      const log = createLogger('Agent');
      log.agent('grok', 'task_completed', { taskId: '123' });

      expect(capturedLogs[0].args[0]).toContain('Agent grok');
      expect(capturedLogs[0].args[0]).toContain('task_completed');
    });
  });

  describe('time helper', () => {
    it('should time async operations', async () => {
      const log = createLogger('Timer');
      const result = await log.time('operation', async () => {
        return 'result';
      });

      expect(result).toBe('result');
      expect(capturedLogs[0].args[0]).toContain('operation completed');
      expect(capturedLogs[0].args[0]).toContain('durationMs');
    });

    it('should log errors from timed operations', async () => {
      const log = createLogger('Timer');

      await expect(
        log.time('failing', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(capturedLogs[0].method).toBe('error');
      expect(capturedLogs[0].args[0]).toContain('failing failed');
    });
  });

  describe('pre-configured loggers', () => {
    it('should have pre-configured loggers for common modules', () => {
      expect(loggers.whoop).toBeInstanceOf(Logger);
      expect(loggers.plaid).toBeInstanceOf(Logger);
      expect(loggers.limitless).toBeInstanceOf(Logger);
      expect(loggers.legal).toBeInstanceOf(Logger);
      expect(loggers.finance).toBeInstanceOf(Logger);
      expect(loggers.memory).toBeInstanceOf(Logger);
      expect(loggers.cron).toBeInstanceOf(Logger);
      expect(loggers.api).toBeInstanceOf(Logger);
    });
  });
});
