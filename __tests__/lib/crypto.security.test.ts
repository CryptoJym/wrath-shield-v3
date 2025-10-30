/** Security tests for lib/crypto.ts (AES-256-GCM HKDF) */
import { encrypt as encryptData, decrypt as decryptData } from '@/lib/crypto';
import { resetConfigCache } from '@/lib/config';
const OLD_ENV = process.env as NodeJS.ProcessEnv;
describe('lib/crypto security', () => {
  beforeEach(() => {
    jest.resetModules(); process.env = { ...OLD_ENV };
    process.env.WHOOP_CLIENT_ID='id'; process.env.WHOOP_CLIENT_SECRET='secret'; process.env.WHOOP_REDIRECT_URI='http://localhost/cb'; process.env.OPENROUTER_API_KEY='key';
    process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('x'.repeat(32)).toString('base64'); resetConfigCache();
  });
  afterAll(() => { process.env = OLD_ENV; });
  it('round-trips arbitrary plaintexts (non-empty)', () => {
    const samples=['hello','🚀 unicode','long '.repeat(500)];
    for(const s of samples){ const enc=encryptData(s); const dec=decryptData(enc); expect(dec).toBe(s); }
  });
  it('fails to decrypt when payload is tampered', () => {
    const enc=encryptData('secret'); const bad={ ...enc, ciphertext: enc.ciphertext.slice(0,-2)+'AA' } as any; expect(()=>decryptData(bad)).toThrow();
  });
  it('fails to decrypt when key changes', () => {
    const enc=encryptData('secret'); process.env.DATABASE_ENCRYPTION_KEY = Buffer.from('y'.repeat(32)).toString('base64'); resetConfigCache(); expect(()=>decryptData(enc)).toThrow();
  });
});
