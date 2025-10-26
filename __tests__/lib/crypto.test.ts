/**
 * Wrath Shield v3 - Cryptography Tests
 */

import {
  encrypt,
  decrypt,
  encryptToJSON,
  decryptFromJSON,
  constantTimeEquals,
  EncryptedPayload,
} from '../../lib/crypto';

// Mock the config module
jest.mock('../../lib/config', () => ({
  cfg: () => ({
    crypto: {
      databaseEncryptionKey: Buffer.from('a'.repeat(32)),
    },
  }),
}));

// Disable server-only guard for testing
jest.mock('../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('Cryptographic Utilities', () => {
  describe('Encryption and Decryption', () => {
    it('should successfully encrypt and decrypt plaintext', () => {
      const plaintext = 'This is a test message';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error on empty plaintext', () => {
      expect(() => encrypt('')).toThrow('Cannot encrypt empty plaintext');
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'Same message';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // IVs should be different
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      // Ciphertexts should be different (due to different IVs)
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      // But both should decrypt to same plaintext
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should include all required fields in encrypted payload', () => {
      const plaintext = 'Test';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('version');
      expect(encrypted.version).toBe(1);
    });

    it('should throw error on tampered ciphertext', () => {
      const plaintext = 'Secret data';
      const encrypted = encrypt(plaintext);

      // Tamper with ciphertext
      const tampered: EncryptedPayload = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -2) + 'XX',
      };

      expect(() => decrypt(tampered)).toThrow('authentication tag invalid');
    });

    it('should throw error on tampered IV', () => {
      const plaintext = 'Secret data';
      const encrypted = encrypt(plaintext);

      // Tamper with IV
      const tampered: EncryptedPayload = {
        ...encrypted,
        iv: Buffer.from('tampered-iv-1234').toString('base64'),
      };

      expect(() => decrypt(tampered)).toThrow('authentication tag invalid');
    });

    it('should throw error on tampered authentication tag', () => {
      const plaintext = 'Secret data';
      const encrypted = encrypt(plaintext);

      // Tamper with tag
      const tagBuffer = Buffer.from(encrypted.tag, 'base64');
      tagBuffer[0] ^= 0x01; // Flip one bit
      const tampered: EncryptedPayload = {
        ...encrypted,
        tag: tagBuffer.toString('base64'),
      };

      expect(() => decrypt(tampered)).toThrow('authentication tag invalid');
    });
  });

  describe('Round-Trip Property Tests', () => {
    // Property test: encryption then decryption should return original plaintext
    it('should successfully round-trip 100 random plaintexts', () => {
      const testCases = 100;
      const failures: string[] = [];

      for (let i = 0; i < testCases; i++) {
        // Generate random plaintext
        const length = Math.floor(Math.random() * 1000) + 1;
        const plaintext = Array.from({ length }, () =>
          String.fromCharCode(Math.floor(Math.random() * 95) + 32)
        ).join('');

        try {
          const encrypted = encrypt(plaintext);
          const decrypted = decrypt(encrypted);

          if (decrypted !== plaintext) {
            failures.push(`Test ${i}: Decrypted text doesn't match original`);
          }
        } catch (error) {
          failures.push(`Test ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  describe('JSON Serialization', () => {
    it('should successfully encrypt to JSON and decrypt from JSON', () => {
      const plaintext = 'Test message for JSON';
      const json = encryptToJSON(plaintext);
      const decrypted = decryptFromJSON(json);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce valid JSON', () => {
      const plaintext = 'Test';
      const json = encryptToJSON(plaintext);

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('tag');
      expect(parsed).toHaveProperty('ciphertext');
    });

    it('should throw error on invalid JSON', () => {
      const invalidJSON = 'not-valid-json';
      expect(() => decryptFromJSON(invalidJSON)).toThrow('malformed JSON');
    });
  });

  describe('Payload Validation', () => {
    it('should throw error on payload with missing IV', () => {
      const encrypted = encrypt('test');
      const invalid = { ...encrypted, iv: '' };
      expect(() => decrypt(invalid as EncryptedPayload)).toThrow('missing required fields');
    });

    it('should throw error on payload with missing salt', () => {
      const encrypted = encrypt('test');
      const invalid = { ...encrypted, salt: '' };
      expect(() => decrypt(invalid as EncryptedPayload)).toThrow('missing required fields');
    });

    it('should throw error on payload with missing tag', () => {
      const encrypted = encrypt('test');
      const invalid = { ...encrypted, tag: '' };
      expect(() => decrypt(invalid as EncryptedPayload)).toThrow('missing required fields');
    });

    it('should throw error on payload with missing ciphertext', () => {
      const encrypted = encrypt('test');
      const invalid = { ...encrypted, ciphertext: '' };
      expect(() => decrypt(invalid as EncryptedPayload)).toThrow('missing required fields');
    });

    it('should throw error on unsupported crypto version', () => {
      const encrypted = encrypt('test');
      const invalid = { ...encrypted, version: 999 };
      expect(() => decrypt(invalid)).toThrow('Unsupported crypto version: 999');
    });
  });

  describe('Constant-Time Comparison', () => {
    it('should return true for equal buffers', () => {
      const buf1 = Buffer.from('test-data');
      const buf2 = Buffer.from('test-data');
      expect(constantTimeEquals(buf1, buf2)).toBe(true);
    });

    it('should return false for different buffers of same length', () => {
      const buf1 = Buffer.from('test-data');
      const buf2 = Buffer.from('test-DATA');
      expect(constantTimeEquals(buf1, buf2)).toBe(false);
    });

    it('should return false for buffers of different lengths', () => {
      const buf1 = Buffer.from('short');
      const buf2 = Buffer.from('longer-data');
      expect(constantTimeEquals(buf1, buf2)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle Unicode characters', () => {
      const plaintext = '🔒 Secure 日本語 émojis';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long plaintexts', () => {
      const plaintext = 'A'.repeat(100000); // 100KB
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./`~';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle newlines and whitespace', () => {
      const plaintext = 'Line 1\nLine 2\r\nLine 3\t\tTabbed';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });
});
