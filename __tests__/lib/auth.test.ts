/**
 * Wrath Shield v3 - Authentication System Tests
 *
 * Comprehensive tests for Clerk authentication integration and bypass logic.
 *
 * Tests cover:
 * 1. USER_ID bypass mechanism (dev mode)
 * 2. currentUserOrThrow behavior in different scenarios
 * 3. currentUserOptional behavior
 * 4. API route protection
 * 5. Clerk session handling
 * 6. User record upserts
 */

import { currentUserOrThrow, currentUserOptional } from '@/lib/auth/user';
import { upsertUser, getUser } from '@/lib/db/users';
import path from 'path';
import fs from 'fs';

// Mock Clerk auth module
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
  clerkMiddleware: jest.fn((handler) => handler),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => null,
  SignIn: () => null,
  SignUp: () => null,
}));

const { auth } = require('@clerk/nextjs/server');

describe('Authentication System', () => {
  const testDbPath = path.resolve(process.cwd(), '.data', 'users.db');

  beforeEach(() => {
    // Clean up test database before each test
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Clear all environment variables
    delete process.env.USER_ID;
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.DISABLE_AUTH;

    jest.clearAllMocks();
  });

  afterAll(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('USER_ID Bypass Mechanism', () => {
    it('should use USER_ID when set, bypassing Clerk completely', () => {
      process.env.USER_ID = 'test@example.com';

      const result = currentUserOrThrow();

      expect(result.userId).toBe('test@example.com');
      expect(result.record.user_id).toBe('test@example.com');
      expect(auth).not.toHaveBeenCalled();
    });

    it('should trim whitespace from USER_ID', () => {
      process.env.USER_ID = '  test@example.com  ';

      const result = currentUserOrThrow();

      expect(result.userId).toBe('test@example.com');
    });

    it('should upsert user record when using USER_ID', () => {
      process.env.USER_ID = 'test@example.com';

      currentUserOrThrow();

      const user = getUser('test@example.com');
      expect(user).not.toBeNull();
      expect(user?.user_id).toBe('test@example.com');
    });

    it('should ignore Clerk session when USER_ID is set', () => {
      process.env.USER_ID = 'override@example.com';
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      // Mock Clerk returning a different user
      auth.mockReturnValue({
        userId: 'clerk-user-123',
        sessionClaims: {
          email: 'clerk@example.com',
        },
      });

      const result = currentUserOrThrow();

      // Should use USER_ID override, not Clerk
      expect(result.userId).toBe('override@example.com');
      expect(auth).not.toHaveBeenCalled();
    });
  });

  describe('DISABLE_AUTH Bypass', () => {
    it('should use default user when DISABLE_AUTH=1', () => {
      process.env.DISABLE_AUTH = '1';
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      const result = currentUserOrThrow();

      expect(result.userId).toBe('default');
      expect(auth).not.toHaveBeenCalled();
    });

    it('should use USER_ID over default when both DISABLE_AUTH and USER_ID set', () => {
      process.env.DISABLE_AUTH = '1';
      process.env.USER_ID = 'custom@example.com';

      const result = currentUserOrThrow();

      expect(result.userId).toBe('custom@example.com');
    });
  });

  describe('Clerk Integration', () => {
    beforeEach(() => {
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';
    });

    it('should use Clerk session when available', () => {
      auth.mockReturnValue({
        userId: 'clerk_user_abc',
        sessionClaims: {
          email: 'user@example.com',
          username: 'testuser',
        },
      });

      const result = currentUserOrThrow();

      expect(result.userId).toBe('user@example.com');
      expect(result.record.primary_email).toBe('user@example.com');
      expect(result.record.username).toBe('testuser');
      expect(auth).toHaveBeenCalled();
    });

    it('should extract primary email from various claim fields', () => {
      // Test email field
      auth.mockReturnValueOnce({
        userId: 'clerk_user_1',
        sessionClaims: {
          email: 'test1@example.com',
        },
      });

      let result = currentUserOrThrow();
      expect(result.userId).toBe('test1@example.com');

      // Test primary_email field
      auth.mockReturnValueOnce({
        userId: 'clerk_user_2',
        sessionClaims: {
          primary_email: 'test2@example.com',
        },
      });

      result = currentUserOrThrow();
      expect(result.userId).toBe('test2@example.com');

      // Test email_address field
      auth.mockReturnValueOnce({
        userId: 'clerk_user_3',
        sessionClaims: {
          email_address: 'test3@example.com',
        },
      });

      result = currentUserOrThrow();
      expect(result.userId).toBe('test3@example.com');
    });

    it('should use Clerk userId when no email is available', () => {
      auth.mockReturnValue({
        userId: 'clerk_user_xyz',
        sessionClaims: {},
      });

      const result = currentUserOrThrow();

      expect(result.userId).toBe('clerk_user_xyz');
    });

    it('should collect email aliases from sessionClaims', () => {
      auth.mockReturnValue({
        userId: 'clerk_user_abc',
        sessionClaims: {
          email: 'Primary@Example.com',
          email_addresses: ['Secondary@Example.com', 'Tertiary@Example.com'],
        },
      });

      const result = currentUserOrThrow();

      expect(result.record.aliases).toContain('primary@example.com');
      expect(result.record.aliases).toContain('secondary@example.com');
      expect(result.record.aliases).toContain('tertiary@example.com');
    });

    it('should normalize email addresses to lowercase', () => {
      auth.mockReturnValue({
        userId: 'clerk_user_abc',
        sessionClaims: {
          email: 'Test@EXAMPLE.COM',
        },
      });

      const result = currentUserOrThrow();

      expect(result.userId).toBe('test@example.com');
      expect(result.record.primary_email).toBe('Test@EXAMPLE.COM');
      expect(result.record.aliases).toContain('test@example.com');
    });

    it('should throw unauthorized error when no Clerk session and no bypass', () => {
      auth.mockReturnValue({
        userId: null,
        sessionClaims: null,
      });

      expect(() => currentUserOrThrow()).toThrow('unauthorized');
    });

    it('should fallback to USER_ID when Clerk session missing', () => {
      process.env.USER_ID = 'fallback@example.com';

      auth.mockReturnValue({
        userId: null,
        sessionClaims: null,
      });

      const result = currentUserOrThrow();

      expect(result.userId).toBe('fallback@example.com');
    });

    it('should upsert user record with Clerk data', () => {
      auth.mockReturnValue({
        userId: 'clerk_user_abc',
        sessionClaims: {
          email: 'clerk@example.com',
          username: 'clerkuser',
        },
      });

      currentUserOrThrow();

      const user = getUser('clerk@example.com');
      expect(user).not.toBeNull();
      expect(user?.user_id).toBe('clerk@example.com');
      expect(user?.username).toBe('clerkuser');
      expect(user?.primary_email).toBe('clerk@example.com');
    });
  });

  describe('currentUserOptional', () => {
    it('should return user when USER_ID is set', () => {
      process.env.USER_ID = 'optional@example.com';

      const result = currentUserOptional();

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('optional@example.com');
    });

    it('should return null when no session and no bypass', () => {
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      auth.mockReturnValue({
        userId: null,
        sessionClaims: null,
      });

      const result = currentUserOptional();

      expect(result).toBeNull();
    });

    it('should return user from Clerk session', () => {
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      auth.mockReturnValue({
        userId: 'clerk_user_xyz',
        sessionClaims: {
          email: 'optional@example.com',
        },
      });

      const result = currentUserOptional();

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('optional@example.com');
    });

    it('should return default when no Clerk keys', () => {
      const result = currentUserOptional();

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('default');
    });
  });

  describe('No Clerk Keys (Local Dev)', () => {
    it('should use USER_ID when no CLERK_PUBLISHABLE_KEY', () => {
      process.env.USER_ID = 'localdev@example.com';

      const result = currentUserOrThrow();

      expect(result.userId).toBe('localdev@example.com');
      expect(auth).not.toHaveBeenCalled();
    });

    it('should use default when no USER_ID and no Clerk keys', () => {
      const result = currentUserOrThrow();

      expect(result.userId).toBe('default');
      expect(auth).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty USER_ID string', () => {
      process.env.USER_ID = '';
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      auth.mockReturnValue({
        userId: null,
        sessionClaims: null,
      });

      expect(() => currentUserOrThrow()).toThrow('unauthorized');
    });

    it('should handle whitespace-only USER_ID with Clerk', () => {
      process.env.USER_ID = '   ';
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      // Whitespace-only doesn't pass the trim check, so falls through to Clerk
      auth.mockReturnValue({
        userId: 'clerk_user_123',
        sessionClaims: {
          email: 'clerk@example.com',
        },
      });

      const result = currentUserOrThrow();
      expect(result.userId).toBe('clerk@example.com');
    });

    it('should handle missing username in Clerk claims', () => {
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      auth.mockReturnValue({
        userId: 'clerk_user_abc',
        sessionClaims: {
          email: 'nouser@example.com',
        },
      });

      const result = currentUserOrThrow();

      expect(result.record.username).toBe('nouser@example.com');
    });

    it('should prefer username over email for username field', () => {
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      auth.mockReturnValue({
        userId: 'clerk_user_abc',
        sessionClaims: {
          email: 'user@example.com',
          username: 'cooluser',
        },
      });

      const result = currentUserOrThrow();

      expect(result.record.username).toBe('cooluser');
    });

    it('should handle duplicate emails in aliases', () => {
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      auth.mockReturnValue({
        userId: 'clerk_user_abc',
        sessionClaims: {
          email: 'user@example.com',
          email_addresses: ['user@example.com', 'User@Example.com'],
        },
      });

      const result = currentUserOrThrow();

      // Should only contain unique lowercase emails
      const uniqueEmails = Array.from(new Set(result.record.aliases));
      expect(result.record.aliases?.length).toBe(uniqueEmails.length);
    });
  });

  describe('User Database Integration', () => {
    it('should persist user across multiple calls', () => {
      process.env.USER_ID = 'persist@example.com';

      // First call
      const result1 = currentUserOrThrow();
      expect(result1.userId).toBe('persist@example.com');

      // Second call
      const result2 = currentUserOrThrow();
      expect(result2.userId).toBe('persist@example.com');

      // Verify only one record in database
      const user = getUser('persist@example.com');
      expect(user).not.toBeNull();
    });

    it('should update user record when details change', () => {
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      // First call with initial data
      auth.mockReturnValueOnce({
        userId: 'clerk_user_abc',
        sessionClaims: {
          email: 'user@example.com',
          username: 'oldusername',
        },
      });

      currentUserOrThrow();

      let user = getUser('user@example.com');
      expect(user?.username).toBe('oldusername');

      // Second call with updated username
      auth.mockReturnValueOnce({
        userId: 'clerk_user_abc',
        sessionClaims: {
          email: 'user@example.com',
          username: 'newusername',
        },
      });

      currentUserOrThrow();

      user = getUser('user@example.com');
      expect(user?.username).toBe('newusername');
    });
  });

  describe('Priority Order', () => {
    it('should prioritize USER_ID over everything', () => {
      process.env.USER_ID = 'priority@example.com';
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.DISABLE_AUTH = '1';

      auth.mockReturnValue({
        userId: 'clerk_user_xyz',
        sessionClaims: {
          email: 'clerk@example.com',
        },
      });

      const result = currentUserOrThrow();

      expect(result.userId).toBe('priority@example.com');
      expect(auth).not.toHaveBeenCalled();
    });

    it('should check DISABLE_AUTH before Clerk when no USER_ID', () => {
      process.env.DISABLE_AUTH = '1';
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      auth.mockReturnValue({
        userId: 'clerk_user_xyz',
        sessionClaims: {
          email: 'clerk@example.com',
        },
      });

      const result = currentUserOrThrow();

      expect(result.userId).toBe('default');
      expect(auth).not.toHaveBeenCalled();
    });
  });

  describe('Production Scenarios', () => {
    it('should require Clerk session in production (no bypass)', () => {
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      auth.mockReturnValue({
        userId: null,
        sessionClaims: null,
      });

      expect(() => currentUserOrThrow()).toThrow('unauthorized');
    });

    it('should work with valid Clerk session in production', () => {
      process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_123';

      auth.mockReturnValue({
        userId: 'prod_user_123',
        sessionClaims: {
          email: 'prod@example.com',
          username: 'produser',
        },
      });

      const result = currentUserOrThrow();

      expect(result.userId).toBe('prod@example.com');
      expect(result.record.username).toBe('produser');
    });
  });
});
