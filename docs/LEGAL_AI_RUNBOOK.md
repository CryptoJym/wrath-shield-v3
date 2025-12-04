# Legal AI Runbook — Case 164400524 (Brady v. Brady)

Last updated: 2025-12-03

## What we just did
- Curated and reformatted the “Responses to Motion to Enforce” memo (date-stamped 2025-12-03).
- Stored the final files here:
  - Text: `.data/legal/output/Responses_to_Motion_to_Enforce.md`
  - PDF:  `.data/legal/output/Responses_to_Motion_to_Enforce.pdf`
- Pushed the updated memo into Zep memory (session `legal-case-164400524`) using the local `.env.local` keys.
- Left all exhibits unchanged.

## Environment keys (already in `.env.local`)
- `ZEP_API_KEY` (or `ZEP_LEGAL_API_KEY`)  
- `ZEP_API_URL=https://api.getzep.com`
- Session used: `legal-case-164400524`

## How to push the latest memo to Zep
From repo root (`wrath-shield-v3`):
```bash
node - <<'NODE'
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
const ZEP_API_KEY = process.env.ZEP_API_KEY || process.env.ZEP_LEGAL_API_KEY;
if (!ZEP_API_KEY) throw new Error('ZEP_API_KEY missing');
const SESSION_ID = 'legal-case-164400524';
const md = fs.readFileSync('.data/legal/output/Responses_to_Motion_to_Enforce.md','utf8');
const content = `LEGAL DOCUMENT: Responses_to_Motion_to_Enforce.md
Date: 2025-12-03
Category: response
Source: local curated response memo

=== CONTENT ===
${md.slice(0,7000)}`;
await fetch(`https://api.getzep.com/api/v2/sessions/${SESSION_ID}/memory`, {
  method: 'POST',
  headers: { 'Authorization': `Api-Key ${ZEP_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{
      role: 'system',
      role_type: 'system',
      content,
      metadata: {
        type: 'legal_document',
        category: 'response',
        filename: 'Responses_to_Motion_to_Enforce.pdf',
        date: '2025-12-03',
        summary: 'Updated response to Motion to Enforce: June 24 stipulation / July 14 signature, July 4 violation, late drop July 7 (Exh3), accounting noncompliance, counter-motion responses, evidence mapping.'
      }
    }]
  })
});
console.log('Zep upload done');
NODE
```

## Source of truth for this memo
- `.data/legal/output/Responses_to_Motion_to_Enforce.md` (editable canonical text)
- `.data/legal/output/Responses_to_Motion_to_Enforce.pdf` (rendered copy)

## Key factual anchors reflected in the memo
- Order of Modification: stipulated 06/24/2025; signed/entered 07/14/2025 (pre–July 4 holiday).
- Late drop July 7: timing only (Exhibit 3 texts); no unsupported “birthday party” references.
- Exhibits unchanged; accounting evidence = Exhibits 5/6 ledger + emails; amortization refs = Exhibits 7/8.

## If further updates are needed
1) Edit the markdown in `.data/legal/output/Responses_to_Motion_to_Enforce.md`.
2) (Optional) Regenerate PDF if formatting is important; current PDF is acceptable.
3) Re-run the Zep push snippet above to sync memory.

