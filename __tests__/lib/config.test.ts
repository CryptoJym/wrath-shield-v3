/**
 * Wrath Shield v3 - Configuration Tests
 */

import { getConfig, resetConfigCache } from '../../lib/config';

describe('Configuration Loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    resetConfigCache();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Required Variables Validation', () => {
    it('should throw error when WHOOP_CLIENT_ID is missing', () => {
      delete process.env.WHOOP_CLIENT_ID;
      process.env.WHOOP_CLIENT_SECRET = 'test-secret';
      process.env.WHOOP_REDIRECT_URI = 'http://localhost:3000/callback';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');

      expect(() => getConfig()).toThrow('WHOOP_CLIENT_ID');
    });

    it('should throw error when WHOOP_CLIENT_SECRET is missing', () => {
      process.env.WHOOP_CLIENT_ID = 'test-id';
      delete process.env.WHOOP_CLIENT_SECRET;
      process.env.WHOOP_REDIRECT_URI = 'http://localhost:3000/callback';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');

      expect(() => getConfig()).toThrow('WHOOP_CLIENT_SECRET');
    });

    it('should throw error when OPENROUTER_API_KEY is missing', () => {
      process.env.WHOOP_CLIENT_ID = 'test-id';
      process.env.WHOOP_CLIENT_SECRET = 'test-secret';
      process.env.WHOOP_REDIRECT_URI = 'http://localhost:3000/callback';
      delete process.env.OPENROUTER_API_KEY;
      process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');

      expect(() => getConfig()).toThrow('OPENROUTER_API_KEY');
    });

    it('should throw error when DATABASE_ENCRYPTION_KEY is missing', () => {
      process.env.WHOOP_CLIENT_ID = 'test-id';
      process.env.WHOOP_CLIENT_SECRET = 'test-secret';
      process.env.WHOOP_REDIRECT_URI = 'http://localhost:3000/callback';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      delete process.env.DATABASE_ENCRYPTION_KEY;

      expect(() => getConfig()).toThrow('DATABASE_ENCRYPTION_KEY');
    });
  });

  describe('DATABASE_ENCRYPTION_KEY Validation', () => {
    it('should reject non-base64 encryption key', () => {
      process.env.WHOOP_CLIENT_ID = 'test-id';
      process.env.WHOOP_CLIENT_SECRET = 'test-secret';
      process.env.WHOOP_REDIRECT_URI = 'http://localhost:3000/callback';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      // String that decodes as base64 but to wrong byte length (12 bytes instead of 32)
      process.env.DATABASE_ENCRYPTION_KEY = 'not-valid-base64!!!';

      expect(() => getConfig()).toThrow('must be exactly 32 bytes');
    });

    it('should reject encryption key with wrong byte length', () => {
      process.env.WHOOP_CLIENT_ID = 'test-id';
      process.env.WHOOP_CLIENT_SECRET = 'test-secret';
      process.env.WHOOP_REDIRECT_URI = 'http://localhost:3000/callback';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      // Only 16 bytes instead of 32
      process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('a'.repeat(16)).toString('base64');

      expect(() => getConfig()).toThrow('must be exactly 32 bytes');
    });

    it('should accept valid 32-byte base64 encryption key', () => {
      process.env.WHOOP_CLIENT_ID = 'test-id';
      process.env.WHOOP_CLIENT_SECRET = 'test-secret';
      process.env.WHOOP_REDIRECT_URI = 'http://localhost:3000/callback';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');

      const config = getConfig();
      expect(config.crypto.databaseEncryptionKey).toBeInstanceOf(Buffer);
      expect(config.crypto.databaseEncryptionKey.length).toBe(32);
    });
  });

  describe('Optional Variables', () => {
    beforeEach(() => {
      // Set all required variables
      process.env.WHOOP_CLIENT_ID = 'test-id';
      process.env.WHOOP_CLIENT_SECRET = 'test-secret';
      process.env.WHOOP_REDIRECT_URI = 'http://localhost:3000/callback';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');
    });

    it('should return undefined for missing optional LIMITLESS_API_KEY', () => {
      delete process.env.LIMITLESS_API_KEY;
      const config = getConfig();
      expect(config.limitless.apiKey).toBeUndefined();
    });

    it('should return LIMITLESS_API_KEY when present', () => {
      process.env.LIMITLESS_API_KEY = 'test-limitless-key';
      const config = getConfig();
      expect(config.limitless.apiKey).toBe('test-limitless-key');
    });

    it('should use default Qdrant values when not specified', () => {
      delete process.env.QDRANT_HOST;
      delete process.env.QDRANT_PORT;
      const config = getConfig();
      expect(config.qdrant.host).toBe('localhost');
      expect(config.qdrant.port).toBe(6333);
    });

    it('should use custom Qdrant values when specified', () => {
      process.env.QDRANT_HOST = 'custom-host';
      process.env.QDRANT_PORT = '9999';
      const config = getConfig();
      expect(config.qdrant.host).toBe('custom-host');
      expect(config.qdrant.port).toBe(9999);
    });
  });

  describe('Configuration Caching', () => {
    beforeEach(() => {
      process.env.WHOOP_CLIENT_ID = 'test-id';
      process.env.WHOOP_CLIENT_SECRET = 'test-secret';
      process.env.WHOOP_REDIRECT_URI = 'http://localhost:3000/callback';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');
    });

    it('should cache configuration after first load', () => {
      const { cfg } = require('../../lib/config');

      const config1 = cfg();
      const config2 = cfg();

      // Should return the same instance
      expect(config1).toBe(config2);
    });
  });
});
