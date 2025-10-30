/** Security & Negative tests for lib/config.ts */
import { cfg, resetConfigCache } from '@/lib/config';
const OLD_ENV = process.env as NodeJS.ProcessEnv;
describe('lib/config security & validation', () => {
  beforeEach(() => { jest.resetModules(); process.env = { ...OLD_ENV }; resetConfigCache(); });
  afterAll(() => { process.env = OLD_ENV; });
  it('throws aggregate error when required envs are missing', () => {
    delete process.env.WHOOP_CLIENT_ID; delete process.env.WHOOP_CLIENT_SECRET; delete process.env.WHOOP_REDIRECT_URI; delete process.env.OPENROUTER_API_KEY; delete process.env.DATABASE_ENCRYPTION_KEY;
    expect(() => cfg()).toThrow();
  });
  it('rejects DATABASE_ENCRYPTION_KEY that is not base64 32-bytes', () => {
    process.env.WHOOP_CLIENT_ID='id'; process.env.WHOOP_CLIENT_SECRET='secret'; process.env.WHOOP_REDIRECT_URI='http://localhost/cb'; process.env.OPENROUTER_API_KEY='key';
    process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
    expect(() => cfg()).toThrow();
  });
it('accepts optional LIMITLESS when present (OPENAI optional)', () => {
    process.env.WHOOP_CLIENT_ID='id'; process.env.WHOOP_CLIENT_SECRET='secret'; process.env.WHOOP_REDIRECT_URI='http://localhost/cb'; process.env.OPENROUTER_API_KEY='key';
    process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('x'.repeat(32)).toString('base64');
  process.env.LIMITLESS_API_KEY='lim';
  const c = cfg();
  expect(c.limitless.apiKey).toBe('lim');
  // OPENAI is optional and may not be exposed in cfg(); do not assert
});
});
