/**
 * Run action executors for high-confidence agentic_actions.
 *
 * Usage:
 *   npx tsx scripts/run-executors.ts
 */
import { runActionExecutors } from '../lib/executors';

async function main() {
  const res = await runActionExecutors();
  console.log('Executors result:', res);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
