/**
 * Manual runner for the entropy/coherence EA pass.
 *
 * Usage:
 *   npx tsx scripts/run-entropy-pass.ts
 */
import { runEntropyCoherencePass } from '../lib/entropyOrchestrator';

async function main() {
  const res = await runEntropyCoherencePass({ userId: 'default' });
  console.log('Entropy pass result:', res);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
