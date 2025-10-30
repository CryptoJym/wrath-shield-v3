import { defaultRegistry } from '../../lib/slashCommands';

describe('slash commands extended', () => {
  test('includes project commands', async () => {
    const reg = defaultRegistry();
    const out = await reg.run('/status');
    expect(typeof out).toBe('string');
    expect(out).toContain('Status');
  });
});
