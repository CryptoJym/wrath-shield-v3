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

