import { PodInput, PodOutput } from './types';

/**
 * Finance pod (stub)
 * Focus: AI/tool spend, utilization ratios, 30-day spend logs.
 * (Data pipes to be added: bank/cc exports, SaaS invoices, usage metrics.)
 */
export async function runFinancePod(input: PodInput): Promise<PodOutput> {
  // Placeholder: once spending feeds exist, compute last-30d totals and per-tool ROI.
  const notes = [
    'FinancePod stub',
    'TODO: ingest spend feeds; track AI/tool costs vs utilization; surface 30d rollup; push anomalies to tasks.',
  ];
  return { actions: [], notes, confidence: 0.0 };
}
