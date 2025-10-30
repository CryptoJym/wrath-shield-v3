/**
 * Tests for macOS Keychain Integration
 */

import { execSync } from 'child_process';

// Mock child_process before importing keychain module
jest.mock('child_process');

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Must import AFTER mocking
import {
  storeKeyInKeychain,
  getKeyFromKeychain,
  deleteKeyFromKeychain,
  hasKeyInKeychain,
  generateAndStoreKey,
} from '@/lib/keychain';

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('macOS Keychain Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storeKeyInKeychain', () => {
    it('should store a key in macOS Keychain', () => {
      const testKey = 'dGVzdEtleTEyMzQ1Njc4OTBhYmNkZWZnaA=='; // base64 32 bytes

      // Mock successful deletion (key exists)
      mockedExecSync
        .mockReturnValueOnce(Buffer.from('')) // delete existing key
        .mockReturnValueOnce(Buffer.from('')); // add new key

      storeKeyInKeychain(testKey);

      // Should call delete then add
      expect(mockedExecSync).toHaveBeenCalledTimes(2);

      // Check add-generic-password call
      const addCall = mockedExecSync.mock.calls[1][0] as string;
      expect(addCall).toContain('security add-generic-password');
      expect(addCall).toContain('-a "database_encryption_key"');
      expect(addCall).toContain('-s "com.wrathshield.encryption"');
      expect(addCall).toContain(`-w "${testKey}"`);
      expect(addCall).toContain('-U');
    });

    it('should handle first-time key storage (no existing key)', () => {
      const testKey = 'dGVzdEtleTEyMzQ1Njc4OTBhYmNkZWZnaA==';

      // Mock deletion failure (key doesn't exist) then successful add
      mockedExecSync
        .mockImplementationOnce(() => {
          throw new Error('could not be found');
        })
        .mockReturnValueOnce(Buffer.from('')); // add new key

      storeKeyInKeychain(testKey);

      // Should still call add even if delete fails
      expect(mockedExecSync).toHaveBeenCalledTimes(2);
    });

    it('should throw error if add-generic-password fails', () => {
      const testKey = 'dGVzdEtleTEyMzQ1Njc4OTBhYmNkZWZnaA==';

      mockedExecSync
        .mockImplementationOnce(() => {
          throw new Error('could not be found');
        })
        .mockImplementationOnce(() => {
          throw new Error('permission denied');
        });

      expect(() => storeKeyInKeychain(testKey)).toThrow(
        'Failed to store key in macOS Keychain: permission denied'
      );
    });
  });

  describe('getKeyFromKeychain', () => {
    it('should retrieve a key from macOS Keychain', () => {
      const testKey = 'dGVzdEtleTEyMzQ1Njc4OTBhYmNkZWZnaA==';
      mockedExecSync.mockReturnValue(`${testKey}\n` as any);

      const result = getKeyFromKeychain();

      expect(result).toBe(testKey);
      expect(mockedExecSync).toHaveBeenCalledTimes(1);

      const call = mockedExecSync.mock.calls[0][0] as string;
      expect(call).toContain('security find-generic-password');
      expect(call).toContain('-a "database_encryption_key"');
      expect(call).toContain('-s "com.wrathshield.encryption"');
      expect(call).toContain('-w');
    });

    it('should trim whitespace from retrieved key', () => {
      const testKey = 'dGVzdEtleTEyMzQ1Njc4OTBhYmNkZWZnaA==';
      mockedExecSync.mockReturnValue(`  ${testKey}  \n` as any);

      const result = getKeyFromKeychain();

      expect(result).toBe(testKey);
    });

    it('should throw error if key not found', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('could not be found');
      });

      expect(() => getKeyFromKeychain()).toThrow(
        'Encryption key not found in macOS Keychain. Run the setup script to initialize: npm run setup:keychain'
      );
    });

    it('should throw error if retrieved key is empty', () => {
      mockedExecSync.mockReturnValue('  \n' as any);

      expect(() => getKeyFromKeychain()).toThrow('Retrieved key is empty');
    });

    it('should throw error for other failures', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('permission denied');
      });

      expect(() => getKeyFromKeychain()).toThrow(
        'Failed to retrieve key from macOS Keychain: permission denied'
      );
    });
  });

  describe('deleteKeyFromKeychain', () => {
    it('should delete a key from macOS Keychain', () => {
      mockedExecSync.mockReturnValue(Buffer.from(''));

      deleteKeyFromKeychain();

      expect(mockedExecSync).toHaveBeenCalledTimes(1);

      const call = mockedExecSync.mock.calls[0][0] as string;
      expect(call).toContain('security delete-generic-password');
      expect(call).toContain('-a "database_encryption_key"');
      expect(call).toContain('-s "com.wrathshield.encryption"');
    });

    it('should throw error if deletion fails', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('permission denied');
      });

      expect(() => deleteKeyFromKeychain()).toThrow(
        'Failed to delete key from macOS Keychain: permission denied'
      );
    });
  });

  describe('hasKeyInKeychain', () => {
    it('should return true if key exists', () => {
      mockedExecSync.mockReturnValue(Buffer.from('keychain item exists'));

      const result = hasKeyInKeychain();

      expect(result).toBe(true);
      expect(mockedExecSync).toHaveBeenCalledTimes(1);

      const call = mockedExecSync.mock.calls[0][0] as string;
      expect(call).toContain('security find-generic-password');
      expect(call).toContain('-a "database_encryption_key"');
      expect(call).toContain('-s "com.wrathshield.encryption"');
    });

    it('should return false if key does not exist', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('could not be found');
      });

      const result = hasKeyInKeychain();

      expect(result).toBe(false);
    });

    it('should return false for any error', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('permission denied');
      });

      const result = hasKeyInKeychain();

      expect(result).toBe(false);
    });
  });

  describe('generateAndStoreKey', () => {
    it('should generate a 32-byte key and store it', () => {
      // Mock successful deletion and storage
      mockedExecSync
        .mockReturnValueOnce(Buffer.from('')) // delete existing key
        .mockReturnValueOnce(Buffer.from('')); // add new key

      const generatedKey = generateAndStoreKey();

      // Verify key is base64 encoded
      expect(typeof generatedKey).toBe('string');

      // Verify key decodes to 32 bytes
      const decoded = Buffer.from(generatedKey, 'base64');
      expect(decoded.length).toBe(32);

      // Verify storeKeyInKeychain was called (2 calls: delete + add)
      expect(mockedExecSync).toHaveBeenCalledTimes(2);
    });

    it('should generate unique keys each time', () => {
      mockedExecSync.mockReturnValue(Buffer.from(''));

      const key1 = generateAndStoreKey();
      const key2 = generateAndStoreKey();

      expect(key1).not.toBe(key2);
    });

    it('should propagate storage errors', () => {
      mockedExecSync
        .mockImplementationOnce(() => {
          throw new Error('could not be found');
        })
        .mockImplementationOnce(() => {
          throw new Error('permission denied');
        });

      expect(() => generateAndStoreKey()).toThrow(
        'Failed to store key in macOS Keychain: permission denied'
      );
    });
  });

  describe('Security and Error Handling', () => {
    it('should use stdio: pipe to prevent output leakage', () => {
      mockedExecSync.mockReturnValue('test' as any);

      getKeyFromKeychain();

      const options = mockedExecSync.mock.calls[0][1];
      expect(options).toHaveProperty('stdio', 'pipe');
    });

    it('should use encoding: utf-8 for getKeyFromKeychain', () => {
      mockedExecSync.mockReturnValue('test' as any);

      getKeyFromKeychain();

      const options = mockedExecSync.mock.calls[0][1];
      expect(options).toHaveProperty('encoding', 'utf-8');
    });

    it('should handle malformed error objects', () => {
      mockedExecSync.mockImplementation(() => {
        throw { message: undefined };
      });

      expect(() => getKeyFromKeychain()).toThrow(
        'Failed to retrieve key from macOS Keychain: Unknown error'
      );
    });

    it('should handle non-Error thrown values', () => {
      mockedExecSync.mockImplementation(() => {
        throw 'string error';
      });

      expect(() => getKeyFromKeychain()).toThrow(
        'Failed to retrieve key from macOS Keychain: Unknown error'
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should support full lifecycle: generate -> check -> retrieve -> delete', () => {
      // Generate and store
      mockedExecSync
        .mockReturnValueOnce(Buffer.from('')) // delete (doesn't exist)
        .mockReturnValueOnce(Buffer.from('')) // add
        .mockReturnValueOnce(Buffer.from('keychain item exists')) // hasKey check
        .mockReturnValueOnce('generatedKey123==' as any) // retrieve
        .mockReturnValueOnce(Buffer.from('')); // delete

      const key = generateAndStoreKey();

      // Check exists
      expect(hasKeyInKeychain()).toBe(true);

      // Retrieve
      const retrieved = getKeyFromKeychain();
      expect(retrieved).toBe('generatedKey123==');

      // Delete
      expect(() => deleteKeyFromKeychain()).not.toThrow();
    });

    it('should handle update scenario (replace existing key)', () => {
      const oldKey = 'b2xkS2V5MTIzNDU2Nzg5MGFiY2RlZmdoaA==';
      const newKey = 'bmV3S2V5MTIzNDU2Nzg5MGFiY2RlZmdoaA==';

      // Mock successful delete (key exists) then add
      mockedExecSync
        .mockReturnValueOnce(Buffer.from('')) // delete old key
        .mockReturnValueOnce(Buffer.from('')); // add new key

      storeKeyInKeychain(newKey);

      expect(mockedExecSync).toHaveBeenCalledTimes(2);
    });
  });
});
