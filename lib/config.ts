/**
 * Wrath Shield v3 - Server-Side Configuration Loader
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 * Never import in client components or expose via client-accessible APIs.
 */

import { ensureServerOnly } from './server-only-guard';

// Prevent client-side imports
ensureServerOnly('lib/config');

type ConfigError = {
  field: string;
  message: string;
};

/**
 * Get required environment variable or throw
 */
function mustEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`REQUIRED environment variable ${key} is not set`);
  }
  return value.trim();
}

/**
 * Get optional environment variable
 */
function optEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * Validate and decode base64-encoded key with specific byte length
 */
function mustBase64(key: string, expectedBytes: number): Buffer {
  const value = mustEnv(key);

  try {
    const decoded = Buffer.from(value, 'base64');

    if (decoded.length !== expectedBytes) {
      throw new Error(
        `${key} must be exactly ${expectedBytes} bytes when base64-decoded (got ${decoded.length} bytes)`
      );
    }

    return decoded;
  } catch (error) {
    if (error instanceof Error && error.message.includes('must be exactly')) {
      throw error;
    }
    throw new Error(`${key} is not valid base64-encoded data`);
  }
}

/**
 * Typed configuration object
 */
export type AppConfig = {
  whoop: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  limitless: {
    apiKey: string | undefined;
  };
  openrouter: {
    apiKey: string;
  };
  openai: {
    apiKey: string | undefined;
  };
  crypto: {
    databaseEncryptionKey: Buffer;
  };
  qdrant: {
    host: string;
    port: number;
  };
};

/**
 * Load and validate application configuration
 *
 * @throws {Error} If required environment variables are missing or invalid
 * @returns {AppConfig} Validated configuration object
 */
export function getConfig(): AppConfig {
  const errors: ConfigError[] = [];

  // Validate WHOOP configuration
  let whoopConfig;
  try {
    whoopConfig = {
      clientId: mustEnv('WHOOP_CLIENT_ID'),
      clientSecret: mustEnv('WHOOP_CLIENT_SECRET'),
      redirectUri: mustEnv('WHOOP_REDIRECT_URI'),
    };
  } catch (error) {
    if (error instanceof Error) {
      errors.push({ field: 'WHOOP', message: error.message });
    }
  }

  // Validate OpenRouter configuration
  let openrouterConfig;
  try {
    openrouterConfig = {
      apiKey: mustEnv('OPENROUTER_API_KEY'),
    };
  } catch (error) {
    if (error instanceof Error) {
      errors.push({ field: 'OpenRouter', message: error.message });
    }
  }

  // Validate database encryption key
  let cryptoConfig;
  try {
    cryptoConfig = {
      databaseEncryptionKey: mustBase64('DATABASE_ENCRYPTION_KEY', 32),
    };
  } catch (error) {
    if (error instanceof Error) {
      errors.push({ field: 'Encryption', message: error.message });
    }
  }

  // Optional configurations
  const limitlessConfig = {
    apiKey: optEnv('LIMITLESS_API_KEY'),
  };

  const openaiConfig = {
    apiKey: optEnv('OPENAI_API_KEY'),
  };

  const qdrantConfig = {
    host: process.env.QDRANT_HOST ?? 'localhost',
    port: parseInt(process.env.QDRANT_PORT ?? '6333', 10),
  };

  // If there are any validation errors, throw with all details
  if (errors.length > 0) {
    const errorMessages = errors.map(e => `  - ${e.field}: ${e.message}`).join('\n');
    throw new Error(
      `Configuration validation failed:\n${errorMessages}\n\n` +
      `Please check your .env.local file or environment variables.`
    );
  }

  // TypeScript knows these are defined because we checked for errors
  return {
    whoop: whoopConfig!,
    limitless: limitlessConfig,
    openrouter: openrouterConfig!,
    openai: openaiConfig,
    crypto: cryptoConfig!,
    qdrant: qdrantConfig,
  };
}

/**
 * Cached configuration instance
 * Loaded once on server startup
 */
let cachedConfig: AppConfig | null = null;

/**
 * Get cached configuration or load if not cached
 *
 * @returns {AppConfig} Application configuration
 */
export function cfg(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = getConfig();
  }
  return cachedConfig;
}

/**
 * Reset cached configuration (primarily for testing)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}
