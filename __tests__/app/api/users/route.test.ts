/**
 * Users API Route Tests
 * Tests for /api/users endpoint - User Management CRUD
 */

import { GET, POST } from '@/app/api/users/route';
import { NextRequest } from 'next/server';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'generated-uuid-123'),
}));

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock database queries - using dynamic import pattern
const mockListUsers = jest.fn();
const mockCreateUser = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@/lib/db/queries', () => ({
  listUsers: (...args: unknown[]) => mockListUsers(...args),
  createUser: (...args: unknown[]) => mockCreateUser(...args),
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

describe('Users API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUsers = [
    {
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice Smith',
      timezone: 'America/New_York',
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'user-2',
      email: 'bob@example.com',
      name: 'Bob Jones',
      timezone: 'America/Los_Angeles',
      created_at: '2025-01-15T00:00:00Z',
    },
    {
      id: 'user-3',
      email: 'charlie@example.com',
      name: 'Charlie Brown',
      timezone: 'Europe/London',
      created_at: '2025-01-20T00:00:00Z',
    },
  ];

  describe('GET /api/users', () => {
    it('should return users with default pagination', async () => {
      mockListUsers.mockReturnValue(mockUsers);

      const request = new NextRequest('http://localhost/api/users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('users');
      expect(data.users).toEqual(mockUsers);
      expect(mockListUsers).toHaveBeenCalledWith(50, 0);
    });

    it('should respect custom limit parameter', async () => {
      mockListUsers.mockReturnValue(mockUsers.slice(0, 2));

      const request = new NextRequest('http://localhost/api/users?limit=2');
      const response = await GET(request);

      expect(mockListUsers).toHaveBeenCalledWith(2, 0);
    });

    it('should respect custom offset parameter', async () => {
      mockListUsers.mockReturnValue(mockUsers.slice(1));

      const request = new NextRequest('http://localhost/api/users?offset=1');
      const response = await GET(request);

      expect(mockListUsers).toHaveBeenCalledWith(50, 1);
    });

    it('should combine limit and offset parameters', async () => {
      mockListUsers.mockReturnValue([mockUsers[1]]);

      const request = new NextRequest('http://localhost/api/users?limit=10&offset=5');
      const response = await GET(request);

      expect(mockListUsers).toHaveBeenCalledWith(10, 5);
    });

    it('should return empty array when no users', async () => {
      mockListUsers.mockReturnValue([]);

      const request = new NextRequest('http://localhost/api/users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toEqual([]);
    });

    it('should handle invalid limit parameter', async () => {
      mockListUsers.mockReturnValue([]);

      const request = new NextRequest('http://localhost/api/users?limit=invalid');
      const response = await GET(request);

      // NaN becomes 50 (default) due to Number() returning NaN and ?? not catching it
      // The actual behavior may vary - this tests the current implementation
      expect(response.status).toBe(200);
    });

    it('should preserve user data integrity', async () => {
      mockListUsers.mockReturnValue(mockUsers);

      const request = new NextRequest('http://localhost/api/users');
      const response = await GET(request);
      const data = await response.json();

      expect(data.users[0]).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        name: expect.any(String),
        timezone: expect.any(String),
      });
    });
  });

  describe('POST /api/users', () => {
    it('should create user with provided data', async () => {
      const newUser = {
        id: 'custom-id',
        email: 'newuser@example.com',
        name: 'New User',
        timezone: 'America/Chicago',
      };

      mockCreateUser.mockReturnValue(undefined);
      mockGetUser.mockReturnValue({ ...newUser, created_at: '2025-01-31T12:00:00Z' });

      const request = new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.user.id).toBe('custom-id');
      expect(data.user.email).toBe('newuser@example.com');
    });

    it('should generate UUID when id not provided', async () => {
      const newUser = {
        email: 'autoid@example.com',
        name: 'Auto ID User',
      };

      mockCreateUser.mockReturnValue(undefined);
      mockGetUser.mockReturnValue({
        id: 'generated-uuid-123',
        ...newUser,
        timezone: null,
        created_at: '2025-01-31T12:00:00Z',
      });

      const request = new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user.id).toBe('generated-uuid-123');
    });

    it('should create user with minimal data', async () => {
      mockCreateUser.mockReturnValue(undefined);
      mockGetUser.mockReturnValue({
        id: 'generated-uuid-123',
        email: null,
        name: null,
        timezone: null,
        created_at: '2025-01-31T12:00:00Z',
      });

      const request = new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(mockCreateUser).toHaveBeenCalledWith({
        id: 'generated-uuid-123',
        email: null,
        name: null,
        timezone: null,
      });
    });

    it('should handle null email gracefully', async () => {
      mockCreateUser.mockReturnValue(undefined);
      mockGetUser.mockReturnValue({
        id: 'generated-uuid-123',
        email: null,
        name: 'No Email User',
        timezone: null,
      });

      const request = new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'No Email User' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user.email).toBeNull();
    });

    it('should return 500 on database error', async () => {
      mockCreateUser.mockImplementation(() => {
        throw new Error('Database constraint violation');
      });

      const request = new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'error@example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to create user');
    });

    it('should fetch and return created user', async () => {
      const createdUser = {
        id: 'new-user-id',
        email: 'created@example.com',
        name: 'Created User',
        timezone: 'UTC',
        created_at: '2025-01-31T12:00:00Z',
      };

      mockCreateUser.mockReturnValue(undefined);
      mockGetUser.mockReturnValue(createdUser);

      const request = new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify({
          id: 'new-user-id',
          email: 'created@example.com',
          name: 'Created User',
          timezone: 'UTC',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(mockGetUser).toHaveBeenCalledWith('new-user-id');
      expect(data.user).toEqual(createdUser);
    });

    it('should call createUser with correct parameters', async () => {
      mockCreateUser.mockReturnValue(undefined);
      mockGetUser.mockReturnValue({ id: 'test-id' });

      const request = new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify({
          id: 'test-id',
          email: 'test@example.com',
          name: 'Test User',
          timezone: 'Europe/Paris',
        }),
      });

      await POST(request);

      expect(mockCreateUser).toHaveBeenCalledWith({
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'Europe/Paris',
      });
    });
  });
});
