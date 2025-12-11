/**
 * Wrath Shield v3 - Centralized Logging System
 *
 * Provides structured logging with:
 * - Log levels (debug, info, warn, error)
 * - Module/component tagging
 * - Timestamp formatting
 * - Correlation ID tracking
 * - Structured metadata
 * - Environment-aware output
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@/lib/logger';
 *
 * const log = createLogger('WhoopClient');
 * log.info('Token refresh successful');
 * log.error('API call failed', { status: 500, endpoint: '/recovery' });
 * log.debug('Raw response', { data: response });
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerOptions {
  /** Minimum log level to output */
  minLevel?: LogLevel;
  /** Whether to include timestamps in console output */
  includeTimestamp?: boolean;
  /** Whether to output as JSON (for production) or human-readable */
  jsonOutput?: boolean;
  /** Custom log handler for external logging services */
  customHandler?: (entry: LogEntry) => void;
}

// Log level priorities (lower = more important)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Environment-based defaults
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';
const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || (IS_PRODUCTION ? 'info' : 'debug');

// In-memory log buffer for recent entries (useful for debugging)
const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER_SIZE = 500;

/**
 * Global logger configuration
 */
let globalOptions: LoggerOptions = {
  minLevel: LOG_LEVEL,
  includeTimestamp: !IS_TEST,
  jsonOutput: IS_PRODUCTION,
};

/**
 * Configure global logger options
 */
export function configureLogger(options: Partial<LoggerOptions>): void {
  globalOptions = { ...globalOptions, ...options };
}

/**
 * Get recent log entries (for debugging/monitoring)
 */
export function getRecentLogs(count: number = 50): LogEntry[] {
  return LOG_BUFFER.slice(-count);
}

/**
 * Get logs filtered by module
 */
export function getLogsByModule(module: string, count: number = 50): LogEntry[] {
  return LOG_BUFFER
    .filter(entry => entry.module === module)
    .slice(-count);
}

/**
 * Get logs filtered by level
 */
export function getLogsByLevel(level: LogLevel, count: number = 50): LogEntry[] {
  return LOG_BUFFER
    .filter(entry => entry.level === level)
    .slice(-count);
}

/**
 * Clear log buffer (for testing)
 */
export function clearLogBuffer(): void {
  LOG_BUFFER.length = 0;
}

/**
 * Format log entry for console output
 */
function formatForConsole(entry: LogEntry, options: LoggerOptions): string {
  const { timestamp, level, module, message, correlationId, metadata } = entry;

  // Build prefix parts
  const parts: string[] = [];

  if (options.includeTimestamp) {
    parts.push(timestamp);
  }

  parts.push(`[${module}]`);

  if (correlationId) {
    parts.push(`(${correlationId})`);
  }

  // Base message
  let output = `${parts.join(' ')} ${message}`;

  // Append metadata if present
  if (metadata && Object.keys(metadata).length > 0) {
    const metaStr = Object.entries(metadata)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(' ');
    output += ` | ${metaStr}`;
  }

  return output;
}

/**
 * Format log entry as JSON
 */
function formatAsJson(entry: LogEntry): string {
  return JSON.stringify({
    ...entry,
    error: entry.error ? {
      name: entry.error.name,
      message: entry.error.message,
      stack: entry.error.stack,
    } : undefined,
  });
}

/**
 * Logger class for a specific module
 */
export class Logger {
  private module: string;
  private correlationId?: string;
  private options: LoggerOptions;

  constructor(module: string, options?: Partial<LoggerOptions>) {
    this.module = module;
    this.options = { ...globalOptions, ...options };
  }

  /**
   * Set correlation ID for request tracing
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Create a child logger with additional context
   */
  child(subModule: string): Logger {
    const childLogger = new Logger(`${this.module}:${subModule}`, this.options);
    if (this.correlationId) {
      childLogger.setCorrelationId(this.correlationId);
    }
    return childLogger;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const minPriority = LOG_LEVEL_PRIORITY[this.options.minLevel || 'debug'];
    const levelPriority = LOG_LEVEL_PRIORITY[level];
    return levelPriority <= minPriority;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      correlationId: this.correlationId,
      metadata,
      error,
    };

    // Add to buffer
    LOG_BUFFER.push(entry);
    if (LOG_BUFFER.length > MAX_BUFFER_SIZE) {
      LOG_BUFFER.shift();
    }

    // Custom handler takes precedence
    if (this.options.customHandler) {
      this.options.customHandler(entry);
      return;
    }

    // Format and output
    const output = this.options.jsonOutput
      ? formatAsJson(entry)
      : formatForConsole(entry, this.options);

    // Route to appropriate console method
    switch (level) {
      case 'error':
        console.error(output);
        if (error && !this.options.jsonOutput) {
          console.error(error);
        }
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        // Use console.debug in browsers, console.log in Node
        if (typeof console.debug === 'function') {
          console.debug(output);
        } else {
          console.log(output);
        }
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Debug level logging - detailed information for debugging
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Info level logging - general operational information
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  /**
   * Warn level logging - potentially problematic situations
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Error level logging - error conditions
   */
  error(message: string, error?: Error | Record<string, unknown>, metadata?: Record<string, unknown>): void {
    if (error instanceof Error) {
      this.log('error', message, metadata, error);
    } else {
      // error is actually metadata
      this.log('error', message, error as Record<string, unknown>);
    }
  }

  /**
   * Log an API request
   */
  apiRequest(method: string, endpoint: string, metadata?: Record<string, unknown>): void {
    this.info(`${method} ${endpoint}`, { ...metadata, type: 'api_request' });
  }

  /**
   * Log an API response
   */
  apiResponse(method: string, endpoint: string, status: number, durationMs?: number, metadata?: Record<string, unknown>): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${endpoint} -> ${status}`, {
      ...metadata,
      type: 'api_response',
      status,
      durationMs,
    });
  }

  /**
   * Log a database operation
   */
  db(operation: string, table: string, metadata?: Record<string, unknown>): void {
    this.debug(`DB ${operation} on ${table}`, { ...metadata, type: 'db_operation' });
  }

  /**
   * Log a scheduled job execution
   */
  cron(jobName: string, status: 'started' | 'completed' | 'failed', metadata?: Record<string, unknown>): void {
    const level: LogLevel = status === 'failed' ? 'error' : 'info';
    this.log(level, `Cron ${jobName} ${status}`, { ...metadata, type: 'cron_job' });
  }

  /**
   * Log an agent event
   */
  agent(agentId: string, event: string, metadata?: Record<string, unknown>): void {
    this.info(`Agent ${agentId}: ${event}`, { ...metadata, type: 'agent_event', agentId });
  }

  /**
   * Log a memory/Zep operation
   */
  memory(operation: string, metadata?: Record<string, unknown>): void {
    this.debug(`Memory ${operation}`, { ...metadata, type: 'memory_operation' });
  }

  /**
   * Time an async operation
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.debug(`${label} completed`, { durationMs: Date.now() - start });
      return result;
    } catch (error) {
      this.error(`${label} failed`, error as Error, { durationMs: Date.now() - start });
      throw error;
    }
  }
}

/**
 * Create a logger for a specific module
 */
export function createLogger(module: string, options?: Partial<LoggerOptions>): Logger {
  return new Logger(module, options);
}

/**
 * Default logger for quick access
 */
export const logger = createLogger('App');

// Pre-configured loggers for common modules
export const loggers = {
  whoop: createLogger('Whoop'),
  plaid: createLogger('Plaid'),
  limitless: createLogger('Limitless'),
  legal: createLogger('Legal'),
  finance: createLogger('Finance'),
  pm: createLogger('PM'),
  comms: createLogger('Comms'),
  ea: createLogger('EA'),
  memory: createLogger('Memory'),
  cron: createLogger('Cron'),
  api: createLogger('API'),
  db: createLogger('Database'),
  eventBus: createLogger('EventBus'),
};
