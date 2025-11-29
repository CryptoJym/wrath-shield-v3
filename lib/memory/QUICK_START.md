# Zep Memory Integration - Quick Start

## 5-Minute Setup

### 1. Get API Key (2 minutes)

```bash
# Visit: https://cloud.getzep.com
# Sign up → Create project → Copy API key
```

### 2. Configure (1 minute)

```bash
# Add to .env.local
echo "ZEP_API_KEY=zep-xxxxxxxxxxxx" >> .env.local
```

### 3. Install & Run (2 minutes)

```bash
npm install
npm run dev
```

✅ **Done!** Zep is now active for all agents.

## Verify It's Working

### Check Logs

```bash
npm run dev | grep -i zep

# Expected output:
# [MemoryWrapper] init: ZEP_API_KEY set=true
# [ZepClient] Successfully initialized Zep Cloud client
# [MemoryWrapper] Successfully connected to Zep Cloud
```

### Test with Finance Agent

```typescript
import { addMemory, searchMemories } from '@/lib/MemoryWrapper';

// Add a memory
await addMemory('Test transaction: Coffee $4.50', 'finance', {
  vendor: 'Starbucks',
  amount: 4.50,
});

// Search memory
const results = await searchMemories('coffee', 'finance');
console.log('Found:', results.length, 'memories');
```

### Check Zep Dashboard

```bash
# Visit: https://cloud.getzep.com/projects/your-project
# You should see:
# - 8 users (one per agent)
# - Sessions for each agent
# - Memories being added
```

## Agent User IDs

Each agent is a Zep user:

```
finance-agent          → Finance Analyst
legal-agent            → Legal Advocate
pm-agent               → Project Maestro
ea-agent               → Executive Assistant
comms-agent            → Comms Scout
hyro-agent             → Research Agent (Grok)
relationships-agent    → Relationship Manager
eeg-agent              → Bio-Data Analyst
```

## Common Operations

### Add Memory

```typescript
import { addMemory } from '@/lib/MemoryWrapper';

await addMemory(
  'Transaction processed successfully',
  'finance',
  { vendor: 'Amazon', amount: 49.99 }
);
```

### Search Memory

```typescript
import { searchMemories } from '@/lib/MemoryWrapper';

const results = await searchMemories('Amazon purchases', 'finance', 5);
```

### Get Context

```typescript
import { getZepContext } from '@/lib/memory/zep';

const context = await getZepContext('finance-agent');
// Returns AI-generated summary of agent's memory
```

### Get Recent Memories

```typescript
import { getRecentZepMemories } from '@/lib/memory/zep';

const recent = await getRecentZepMemories('legal-agent', 10);
```

## Troubleshooting

### "Zep Not Active"

```bash
# 1. Check API key
echo $ZEP_API_KEY

# 2. Verify .env.local
cat .env.local | grep ZEP

# 3. Restart server
npm run dev
```

### "Module Not Found"

```bash
# Install dependencies
npm install

# Verify package
npm list @getzep/zep-cloud
```

### "User Creation Failed"

- Check API key is valid
- Verify network connectivity
- Check Zep service status

## What's Automatic

✅ User creation (first memory triggers)
✅ Session management (created on-demand)
✅ Fallback to Qdrant/SQLite (if Zep unavailable)
✅ Context summarization (Zep AI generates)
✅ Knowledge graph building (Zep automatic)

## What's Manual

❌ API key configuration (one-time)
❌ Session cleanup (optional)
❌ Memory migration from old system (optional)

## File Locations

```
.env.local                        # API key configuration
lib/MemoryWrapper.ts              # Main memory interface
lib/memory/zep.ts                 # Zep client wrapper
lib/memory/README.md              # Full documentation
ZEP_INTEGRATION_SUMMARY.md       # Integration summary
```

## Next Steps

1. ✅ Set up API key (above)
2. ⬜ Test with each agent
3. ⬜ Monitor Zep dashboard
4. ⬜ Read full docs (`lib/memory/README.md`)
5. ⬜ Optional: Migrate old memories

## Support

- **Docs**: `/lib/memory/README.md`
- **Summary**: `/ZEP_INTEGRATION_SUMMARY.md`
- **Zep Help**: https://help.getzep.com
- **Dashboard**: https://cloud.getzep.com

---

**Quick Reference Complete** ✅
