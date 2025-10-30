#!/usr/bin/env tsx
/**
 * Setup Script: Initialize macOS Keychain with Database Encryption Key
 *
 * This script generates a new 256-bit encryption key and stores it securely
 * in macOS Keychain. Run once during initial setup.
 *
 * Usage:
 *   npm run setup:keychain
 */

import { generateAndStoreKey, hasKeyInKeychain, getKeyFromKeychain } from '../lib/keychain';

async function setupKeychain(): Promise<void> {
  console.log('🔐 Wrath Shield v3 - macOS Keychain Setup\n');

  try {
    // Check if key already exists
    if (hasKeyInKeychain()) {
      console.log('⚠️  Warning: An encryption key already exists in macOS Keychain.');
      console.log('');
      console.log('If you continue, the existing key will be replaced.');
      console.log('This will make existing encrypted data unrecoverable.');
      console.log('');
      console.log('To proceed with replacement, set FORCE_REPLACE=true:');
      console.log('  FORCE_REPLACE=true npm run setup:keychain');
      console.log('');

      if (process.env.FORCE_REPLACE !== 'true') {
        console.log('✅ Setup cancelled. Existing key preserved.');
        process.exit(0);
      }

      console.log('⚠️  Replacing existing key (FORCE_REPLACE=true)...');
    }

    // Generate and store new key
    console.log('Generating 256-bit encryption key...');
    const key = generateAndStoreKey();

    // Verify storage
    console.log('Verifying key storage...');
    const retrieved = getKeyFromKeychain();

    if (retrieved !== key) {
      throw new Error('Key verification failed: retrieved key does not match generated key');
    }

    console.log('');
    console.log('✅ Success! Encryption key stored in macOS Keychain.');
    console.log('');
    console.log('Security Information:');
    console.log('  - Key stored in: macOS Keychain');
    console.log('  - Service: com.wrathshield.encryption');
    console.log('  - Account: database_encryption_key');
    console.log('  - Key length: 256 bits (32 bytes)');
    console.log('  - Access: Restricted to current user');
    console.log('');
    console.log('The encryption key is now securely stored.');
    console.log('You can safely remove DATABASE_ENCRYPTION_KEY from .env.local if present.');
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Start the development server: npm run dev');
    console.log('  2. The app will automatically use the Keychain-stored key');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Setup failed:');
    console.error('');

    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error('   Unknown error occurred');
    }

    console.error('');
    console.error('Troubleshooting:');
    console.error('  - Ensure you are running on macOS');
    console.error('  - Check that you have Keychain Access permissions');
    console.error('  - Try running with elevated permissions if needed');
    console.error('');

    process.exit(1);
  }
}

// Run setup
setupKeychain().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
