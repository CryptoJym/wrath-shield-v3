import fs from 'fs';
import path from 'path';

export type VendorRule = {
  vendor: string; // lowercase key
  bucket?: string;
  reimbursable?: boolean;
  project?: string;
  note?: string;
  rationale?: string;
  hits?: number;
};

const RULE_PATH = process.env.VENDOR_RULES_PATH || path.resolve('.data', 'vendor-rules.json');

function loadRules(): VendorRule[] {
  if (!fs.existsSync(RULE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(RULE_PATH, 'utf8')) as VendorRule[];
  } catch (_e) {
    return [];
  }
}

function saveRules(rules: VendorRule[]) {
  fs.mkdirSync(path.dirname(RULE_PATH), { recursive: true });
  fs.writeFileSync(RULE_PATH, JSON.stringify(rules, null, 2), 'utf8');
}

export function getRule(vendor?: string): VendorRule | null {
  if (!vendor) return null;
  const v = vendor.toLowerCase();
  const rules = loadRules();
  return rules.find((r) => r.vendor === v) || null;
}

export function upsertRule(rule: VendorRule) {
  const rules = loadRules();
  const v = rule.vendor.toLowerCase();
  const idx = rules.findIndex((r) => r.vendor === v);
  if (idx >= 0) {
    rules[idx] = { ...rules[idx], ...rule, vendor: v, hits: (rules[idx].hits || 0) + 1 };
  } else {
    rules.push({ ...rule, vendor: v, hits: 1 });
  }
  saveRules(rules);
}

export function applyRule(vendor?: string) {
  const rule = getRule(vendor);
  if (!rule) return null;
  return {
    bucket: rule.bucket,
    reimbursable: rule.reimbursable,
    project: rule.project,
    note: rule.note,
    rationale: rule.rationale,
    confidenceBoost: 0.15, // bump confidence if rule matches
  };
}
