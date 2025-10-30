/**
 * macOS Keychain Integration
 *
 * Provides secure storage and retrieval of encryption keys using macOS Keychain.
 * Uses the native `security` command-line tool for Keychain access.
 *
 * Security:
 * - Keys stored in macOS Keychain (encrypted at rest by the OS)
 * - Access restricted to current user
 * - No plaintext keys in environment variables or config files
 * - Server-only enforcement prevents client-side access
 */

import { execSync } from 'child_process';
import { ensureServerOnly } from './server-only-guard';

// Enforce server-side execution
ensureServerOnly();

/**
 * Keychain service and account identifiers
 */
const SERVICE_NAME = 'com.wrathshield.encryption';
const ACCOUNT_NAME = 'database_encryption_key';

/**
 * Store a key in macOS Keychain
 *
 * @param key - The encryption key to store (base64-encoded string)
 * @throws Error if key storage fails
 */
export function storeKeyInKeychain(key: string): void {
  try {
    // Delete existing key if present (update behavior)
    try {
      deleteKeyFromKeychain();
    } catch {
      // Key doesn't exist yet, which is fine
    }

    // Add new key to Keychain
    // -a: account name
    // -s: service name
    // -w: password (the key)
    // -U: update if exists
    execSync(
      `security add-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" -w "${key}" -U`,
      { stdio: 'pipe' }
    );
  } catch (error) {
    throw new Error(
      `Failed to store key in macOS Keychain: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Retrieve a key from macOS Keychain
 *
 * @returns The encryption key (base64-encoded string)
 * @throws Error if key retrieval fails or key not found
 */
export function getKeyFromKeychain(): string {
  try {
    // Find and retrieve password from Keychain
    // -a: account name
    // -s: service name
    // -w: print password only (not all metadata)
    const output = execSync(
      `security find-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" -w`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );

    const key = output.trim();

    if (!key) {
      throw new Error('Retrieved key is empty');
    }

    return key;
  } catch (error) {
    if (error instanceof Error && error.message.includes('could not be found')) {
      throw new Error(
        'Encryption key not found in macOS Keychain. Run the setup script to initialize: npm run setup:keychain'
      );
    }

    throw new Error(
      `Failed to retrieve key from macOS Keychain: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a key from macOS Keychain
 *
 * @throws Error if key deletion fails
 */
export function deleteKeyFromKeychain(): void {
  try {
    execSync(
      `security delete-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}"`,
      { stdio: 'pipe' }
    );
  } catch (error) {
    throw new Error(
      `Failed to delete key from macOS Keychain: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if a key exists in macOS Keychain
 *
 * @returns true if key exists, false otherwise
 */
export function hasKeyInKeychain(): boolean {
  try {
    execSync(
      `security find-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}"`,
      { stdio: 'pipe' }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a new encryption key and store in Keychain
 *
 * @returns The generated key (base64-encoded 32 bytes)
 */
export function generateAndStoreKey(): string {
  // Generate 32 random bytes (256 bits)
  const crypto = require('crypto');
  const keyBuffer = crypto.randomBytes(32);
  const key = keyBuffer.toString('base64');

  // Store in Keychain
  storeKeyInKeychain(key);

  return key;
}
