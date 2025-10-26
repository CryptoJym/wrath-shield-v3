/**
 * Wrath Shield v3 - Cryptographic Utilities
 *
 * Provides AES-256-GCM encryption/decryption with HKDF key derivation
 * for at-rest encryption of sensitive tokens and API keys.
 *
 * SECURITY NOTES:
 * - Uses AES-256-GCM for authenticated encryption
 * - Derives unique keys per encryption operation using HKDF
 * - Generates cryptographically secure random IVs
 * - Validates authentication tags on decryption
 * - Implements constant-time comparison for tag validation
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { cfg } from './config';
import { ensureServerOnly } from './server-only-guard';

// Prevent client-side imports
ensureServerOnly('lib/crypto');

/**
 * Encrypted payload structure
 */
export type EncryptedPayload = {
  iv: string;          // Initialization Vector (base64)
  salt: string;        // HKDF salt (base64)
  tag: string;         // Authentication Tag (base64)
  ciphertext: string;  // Encrypted data (base64)
  version: number;     // Crypto version for future compatibility
};

/**
 * Current crypto version (for future algorithm migrations)
 */
const CRYPTO_VERSION = 1;

/**
 * Derive encryption key using HKDF-HMAC-SHA256
 *
 * @param masterKey - Master key from DATABASE_ENCRYPTION_KEY
 * @param salt - Salt for key derivation
 * @param info - Context information string
 * @returns Derived 32-byte key
 */
function deriveKey(masterKey: Buffer, salt: Buffer, info: string): Buffer {
  // HKDF Extract: HMAC(salt, masterKey)
  const prk = createHmac('sha256', salt).update(masterKey).digest();

  // HKDF Expand: HMAC(prk, info || 0x01)
  const infoBuffer = Buffer.from(info, 'utf8');
  const hmac = createHmac('sha256', prk);
  hmac.update(infoBuffer);
  hmac.update(Buffer.from([0x01])); // Counter byte
  return hmac.digest(); // 32 bytes for AES-256
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - Data to encrypt (string)
 * @returns Encrypted payload with IV, tag, and ciphertext
 * @throws {Error} If encryption fails
 */
export function encrypt(plaintext: string): EncryptedPayload {
  if (!plaintext || plaintext.length === 0) {
    throw new Error('Cannot encrypt empty plaintext');
  }

  const config = cfg();
  const masterKey = config.crypto.databaseEncryptionKey;

  // Generate cryptographically secure random values
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const salt = randomBytes(32); // 256-bit salt for HKDF

  // Derive unique encryption key using HKDF
  const derivedKey = deriveKey(masterKey, salt, 'wrath-shield-v3-encryption');

  // Encrypt with AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  // Get authentication tag
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext,
    version: CRYPTO_VERSION,
  };
}

/**
 * Decrypt encrypted payload using AES-256-GCM
 *
 * @param payload - Encrypted payload from encrypt()
 * @returns Decrypted plaintext
 * @throws {Error} If decryption fails or authentication tag is invalid
 */
export function decrypt(payload: EncryptedPayload): string {
  if (!payload || !payload.iv || !payload.salt || !payload.tag || !payload.ciphertext) {
    throw new Error('Invalid encrypted payload: missing required fields');
  }

  if (payload.version !== CRYPTO_VERSION) {
    throw new Error(
      `Unsupported crypto version: ${payload.version} (current: ${CRYPTO_VERSION})`
    );
  }

  const config = cfg();
  const masterKey = config.crypto.databaseEncryptionKey;

  // Decode base64 values
  const iv = Buffer.from(payload.iv, 'base64');
  const salt = Buffer.from(payload.salt, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');

  // Derive the same encryption key using stored salt
  const derivedKey = deriveKey(masterKey, salt, 'wrath-shield-v3-encryption');

  // Decrypt with AES-256-GCM
  const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(tag);

  try {
    let plaintext = decipher.update(payload.ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch (error) {
    throw new Error('Decryption failed: authentication tag invalid or data corrupted');
  }
}

/**
 * Encrypt and return as JSON string (for database storage)
 *
 * @param plaintext - Data to encrypt
 * @returns JSON string of encrypted payload
 */
export function encryptToJSON(plaintext: string): string {
  const payload = encrypt(plaintext);
  return JSON.stringify(payload);
}

/**
 * Decrypt from JSON string (from database)
 *
 * @param json - JSON string of encrypted payload
 * @returns Decrypted plaintext
 * @throws {Error} If JSON is invalid or decryption fails
 */
export function decryptFromJSON(json: string): string {
  try {
    const payload = JSON.parse(json) as EncryptedPayload;
    return decrypt(payload);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid encrypted payload: malformed JSON');
    }
    throw error;
  }
}

/**
 * Constant-time string comparison (for testing authentication tags)
 * Note: Node's timingSafeEqual is already constant-time, this is a wrapper
 *
 * @param a - First buffer
 * @param b - Second buffer
 * @returns true if buffers are equal
 */
export function constantTimeEquals(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
