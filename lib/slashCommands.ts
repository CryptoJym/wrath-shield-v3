export type CommandHandler = (args: string[]) => Promise<string | void> | string | void;

export interface CommandSpec {
  name: string; // e.g. "help"
  description?: string;
  handler: CommandHandler;
}

export class SlashCommandRegistry {
  private commands: Map<string, CommandSpec> = new Map();

  register(spec: CommandSpec) {
    const key = spec.name.trim().toLowerCase();
    if (!key) throw new Error('Command name required');
    if (this.commands.has(key)) throw new Error(`Command already registered: ${key}`);
    this.commands.set(key, spec);
  }

  list(): CommandSpec[] {
    return Array.from(this.commands.values());
  }

  async run(input: string): Promise<string | void> {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return undefined;
    const parts = trimmed.slice(1).split(/\s+/);
    const name = (parts.shift() || '').toLowerCase();
    const cmd = this.commands.get(name);
    if (!cmd) return `Unknown command: /${name}`;
    const result = await cmd.handler(parts);
    if (typeof result === 'string') return result;
    return undefined;
  }
}

export function defaultRegistry(): SlashCommandRegistry {
  const reg = new SlashCommandRegistry();
  reg.register({
    name: 'help',
    description: 'List available commands',
    handler: () =>
      reg
        .list()
        .map((c) => `/${c.name}${c.description ? ' — ' + c.description : ''}`)
        .join('\n'),
  });
  // Project commands (stubs, safe default behavior)
  reg.register({ name: 'prime', description: 'Prime ritual (stub)', handler: () => 'PRIME ritual started (stub)' });
  reg.register({ name: 'lock', description: 'Lock ritual (stub)', handler: () => 'LOCK ritual engaged (stub)' });
  reg.register({ name: 'stomp', description: 'Stomp a flag (stub)', handler: (args) => `Stomped ${args.join(' ') || 'flag'} (stub)` });
  reg.register({ name: 'deck', description: 'Show deck (stub)', handler: () => 'Deck: 0 tasks (stub)' });
  reg.register({ name: 'status', description: 'System status (stub)', handler: () => 'Status: ok (stub)' });
  return reg;
}
