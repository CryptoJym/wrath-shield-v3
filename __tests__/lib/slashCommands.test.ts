import { SlashCommandRegistry, defaultRegistry } from '../../lib/slashCommands';

describe('slash command registry', () => {
  test('registers and lists commands', () => {
    const reg = new SlashCommandRegistry();
    reg.register({ name: 'echo', handler: (args) => args.join(' ') });
    reg.register({ name: 'upper', handler: (args) => args.join(' ').toUpperCase() });
    const names = reg.list().map((c) => c.name).sort();
    expect(names).toEqual(['echo', 'upper']);
  });

  test('runs default help', async () => {
    const reg = defaultRegistry();
    const out = await reg.run('/help');
    expect(out).toContain('/help');
  });

  test('runs a custom command with args', async () => {
    const reg = new SlashCommandRegistry();
    reg.register({ name: 'sum', handler: (args) => String(args.map(Number).reduce((a, b) => a + b, 0)) });
    const out = await reg.run('/sum 2 3 5');
    expect(out).toBe('10');
  });

  test('unknown command returns message', async () => {
    const reg = new SlashCommandRegistry();
    const out = await reg.run('/nope');
    expect(out).toBe('Unknown command: /nope');
  });

  test('input without leading slash is a no-op', async () => {
    const reg = new SlashCommandRegistry();
    const out = await reg.run('hello world');
    expect(out).toBeUndefined();
  });
});
