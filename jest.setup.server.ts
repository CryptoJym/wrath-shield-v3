/**
 * Jest setup for server-side (Node) tests
 * - Mocks server-only guard to avoid import-time errors in unit tests
 * - Ensures consistent console behavior
 */

// Mock the server-only guard globally so server modules can import safely in tests
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: () => undefined,
}));

// Keep console noise manageable during tests
global.console = {
  ...console,
  error: console.error, // keep errors visible
  warn: console.warn,
  log: console.log,
};

// Node 18+ provides fetch/Request/Response natively; ensure they exist for clarity
// (If running on older Node, uncomment undici polyfill)
// const { fetch, Request, Response, Headers } = require('undici');
// // @ts-ignore
// if (!global.fetch) global.fetch = fetch;
// // @ts-ignore
// if (!global.Request) global.Request = Request;
// // @ts-ignore
// if (!global.Response) global.Response = Response;
// // @ts-ignore
// if (!global.Headers) global.Headers = Headers;

// Provide sane defaults for required env vars in tests; individual tests can override/delete.
process.env.WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID ?? 'test-whoop-id';
process.env.WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET ?? 'test-whoop-secret';
process.env.WHOOP_REDIRECT_URI = process.env.WHOOP_REDIRECT_URI ?? 'http://localhost:4242/callback';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? 'test-openrouter-key';
process.env.DATABASE_ENCRYPTION_KEY =
  process.env.DATABASE_ENCRYPTION_KEY ?? Buffer.from('a'.repeat(32)).toString('base64');
process.env.QDRANT_HOST = process.env.QDRANT_HOST ?? 'localhost';
process.env.QDRANT_PORT = process.env.QDRANT_PORT ?? '6333';
