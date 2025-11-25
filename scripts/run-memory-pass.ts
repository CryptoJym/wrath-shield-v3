/**
 * Compacts Mem0 memories to keep the set small and salient.
 *
 * Usage:
 *   npx tsx scripts/run-memory-pass.ts
 */

import { compactMemories } from '../lib/memory/MemoryCompactor';
import { initializeMemory } from '../lib/MemoryWrapper';

async function main() {
  await initializeMemory();
  const keepRecent = parseInt(process.env.MEMORY_KEEP_RECENT || '50', 10);
  const userId = process.env.MEMORY_USER_ID || 'default';
  const res = await compactMemories(userId, keepRecent);
  console.log(`Memory compaction finished: summarized=${res.summarized}, deleted=${res.deleted}, kept_recent=${keepRecent}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
