# Temporal Search Preprocessing System

## Overview

The Temporal Search Preprocessing System provides intelligent temporal reasoning for the Life OS Working Memory architecture. It enables natural language queries like:

- "what did I discuss with John last week"
- "what's overdue from Tuesday's meeting"
- "show me everything from yesterday afternoon"
- "between Monday and Friday"

## Key Features

### 1. Natural Language Temporal Parsing

Supports multiple temporal expression types:

**Relative Expressions:**
- `today`, `yesterday`, `tomorrow`
- `this week`, `last week`, `this month`, `last month`, `this year`
- `3 days ago`, `2 weeks ago`, `1 month ago`
- `last Tuesday`, `next Monday`

**Absolute Expressions:**
- ISO dates: `2024-12-09`
- US dates: `12/9/24`, `12/09/2024`
- Natural dates: `December 5th`, `Dec 5`

**Ranges:**
- `between Monday and Friday`
- `this week`
- `last month`

**Recurring Patterns:**
- `every Monday`
- `weekly`
- `monthly`

### 2. Temporal-Aware Search

- Temporal scoring (0-1) based on distance from query range
- Recency bias option to prefer newer results
- Direction modifiers: `before`, `after`, `around`, `exact`
- Configurable time windows for "around" queries

### 3. Overdue Detection

- Automatic deadline extraction from event metadata
- Deadline parsing from event content
- Overdue item detection and sorting

### 4. Integration with Working Memory

- Seamless integration with existing `WorkingMemory` class
- Efficient SQLite-backed querying
- Minimal performance overhead

## Architecture

```
┌─────────────────────────────────────────┐
│   Natural Language Query                │
│   "what did John say last Tuesday"      │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│   extractTemporalContext()              │
│   - Parse temporal expressions          │
│   - Clean query text                    │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│   searchWithTemporal()                  │
│   - Get candidate events                │
│   - Filter by temporal range            │
│   - Score by temporal relevance         │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│   Ranked Results                        │
│   (sorted by temporal + recency score)  │
└─────────────────────────────────────────┘
```

## Usage Examples

### Basic Usage

```typescript
import { createTemporalSearchPreprocessor } from '@/lib/cortex/temporal-search';
import { getWorkingMemory } from '@/lib/cortex/working-memory';

// Create preprocessor
const wm = getWorkingMemory();
const temporalSearch = createTemporalSearchPreprocessor(wm);

// Search with natural language temporal query
const results = await temporalSearch.search(
  "meetings with John last week"
);

// Search with explicit options
const recentResults = await temporalSearch.search(
  "budget discussions",
  {
    temporal: {
      reference: 'last_week',
      direction: 'exact'
    },
    recencyBias: 0.5, // Prefer recent items
    limit: 10
  }
);
```

### Overdue Detection

```typescript
// Find all overdue items
const overdueItems = await temporalSearch.findOverdue();

// Find items overdue as of a specific date
const overdueAsOf = await temporalSearch.findOverdue(
  new Date('2024-12-01')
);
```

### Advanced Temporal Queries

```typescript
// Parse temporal expression
const parsed = temporalSearch.parseExpression("last Tuesday");
console.log(parsed.resolved); // { start: Date, end: Date }
console.log(parsed.confidence); // 0.9
console.log(parsed.type); // "relative"

// Extract temporal context from query
const { cleanedQuery, temporal } = temporalSearch.extractTemporalContext(
  "show me emails from yesterday about the project"
);
console.log(cleanedQuery); // "show me emails about the project"
console.log(temporal.reference); // { range: { start: ..., end: ... } }
```

### Deadline-Only Search

```typescript
// Only return events with deadlines
const withDeadlines = await temporalSearch.search(
  "project tasks",
  {
    deadlineOnly: true,
    includeOverdue: true
  }
);
```

### Recency Bias

```typescript
// Prefer recent items (0-1, higher = more recent bias)
const recentBiased = await temporalSearch.search(
  "status updates",
  {
    recencyBias: 0.8 // Strongly prefer recent
  }
);
```

## API Reference

### Types

```typescript
// Temporal reference types
type TemporalReference =
  | 'today' | 'yesterday' | 'this_week' | 'last_week'
  | 'this_month' | 'last_month' | 'this_year'
  | { date: Date }
  | { range: { start: Date; end: Date } };

// Direction modifiers
type TemporalDirection = 'before' | 'after' | 'around' | 'exact';

// Temporal query specification
interface TemporalQuery {
  reference: TemporalReference;
  direction?: TemporalDirection;
  windowMs?: number; // for 'around' queries
}

// Search options
interface TemporalSearchOptions {
  temporal?: TemporalQuery;
  includeOverdue?: boolean;
  deadlineOnly?: boolean;
  recencyBias?: number; // 0-1
  limit?: number;
}

// Parsed temporal expression
interface ParsedTemporalExpression {
  original: string;
  resolved: { start: Date; end: Date };
  confidence: number; // 0-1
  type: 'absolute' | 'relative' | 'recurring';
}
```

### Functions

#### `parseTemporalExpression(text: string, referenceDate?: Date): ParsedTemporalExpression | null`

Parse a temporal expression from natural language text.

**Parameters:**
- `text`: Text potentially containing temporal expressions
- `referenceDate`: Reference date for relative expressions (default: now)

**Returns:** Parsed expression or `null` if no match

#### `extractTemporalContext(query: string): { cleanedQuery: string; temporal: TemporalQuery | null }`

Extract temporal context from a query and return cleaned query text.

**Parameters:**
- `query`: Natural language query

**Returns:** Object with cleaned query and temporal query

#### `calculateTemporalScore(eventTimestamp: Date, queryTemporal: TemporalQuery, recencyBias?: number): number`

Calculate temporal relevance score for an event.

**Parameters:**
- `eventTimestamp`: Timestamp of the event
- `queryTemporal`: Temporal query specification
- `recencyBias`: Recency bias factor (0-1, default: 0)

**Returns:** Score from 0 to 1

#### `findOverdueItems(workingMemory: WorkingMemory, referenceDate?: Date): Promise<WorkingMemoryEvent[]>`

Find all overdue items in working memory.

**Parameters:**
- `workingMemory`: Working memory instance
- `referenceDate`: Reference date for "now" (default: current time)

**Returns:** Array of overdue events, sorted by deadline

#### `searchWithTemporal(baseQuery: string, options: TemporalSearchOptions, workingMemory: WorkingMemory): Promise<WorkingMemoryEvent[]>`

Search working memory with temporal constraints.

**Parameters:**
- `baseQuery`: Base search query (can include temporal expressions)
- `options`: Temporal search options
- `workingMemory`: Working memory instance

**Returns:** Array of matching events with temporal scoring

### Class: `TemporalSearchPreprocessor`

Main interface for temporal search operations.

#### Constructor

```typescript
new TemporalSearchPreprocessor(workingMemory: WorkingMemory)
```

#### Methods

##### `search(query: string, options?: TemporalSearchOptions): Promise<WorkingMemoryEvent[]>`

Search with natural language temporal queries.

##### `extractTemporalContext(query: string): { cleanedQuery: string; temporal: TemporalQuery | null }`

Extract temporal context from query.

##### `findOverdue(referenceDate?: Date): Promise<WorkingMemoryEvent[]>`

Find all overdue items.

##### `parseExpression(text: string, referenceDate?: Date): ParsedTemporalExpression | null`

Parse temporal expression from text.

#### Factory Function

```typescript
createTemporalSearchPreprocessor(workingMemory: WorkingMemory): TemporalSearchPreprocessor
```

Create a new temporal search preprocessor instance.

## Temporal Scoring Algorithm

The temporal scoring algorithm combines multiple factors:

1. **Base Temporal Score**: Distance from query temporal range
   - Events within range: score = 1.0
   - Events outside range: exponential decay based on distance

2. **Recency Bias** (optional): Preference for newer events
   - Exponential decay based on age
   - Blended with base score: `baseScore * (1 - bias) + recencyScore * bias`

3. **Overdue Boost**: Overdue items receive 1.5x score multiplier

## Performance Considerations

- **Efficient Indexing**: Uses existing SQLite indexes on `timestamp` and `processed_by_synthesis`
- **Range Queries**: Expands temporal range with buffer to avoid missing edge cases
- **Lazy Evaluation**: Only scores candidates that pass initial filters
- **Configurable Limits**: Supports result limiting to prevent memory issues

## Dependencies

- `date-fns`: Comprehensive date manipulation
- `better-sqlite3`: SQLite database (via WorkingMemory)
- `lib/server-only-guard`: Server-side enforcement

## Security

- **Server-Side Only**: Enforced via `ensureServerOnly()` guard
- **No Client Bundling**: Must only be imported in API routes or server actions
- **SQL Injection Safe**: Uses parameterized queries via WorkingMemory

## Integration Points

### With Working Memory

```typescript
import { getWorkingMemory } from '@/lib/cortex/working-memory';
import { createTemporalSearchPreprocessor } from '@/lib/cortex/temporal-search';

const wm = getWorkingMemory();
const temporal = createTemporalSearchPreprocessor(wm);
```

### With Synthesis Loop

```typescript
import { searchWithTemporal } from '@/lib/cortex/temporal-search';

// Inside synthesis loop
const recentEvents = await searchWithTemporal(
  "",
  { temporal: { reference: 'this_week' }, limit: 50 },
  workingMemory
);
```

### With Event Ingestor

```typescript
// Add deadline metadata when ingesting events
await workingMemory.addEvent({
  source: 'email',
  content: emailContent,
  metadata: {
    deadline: '2024-12-15T17:00:00Z', // Will be detected by overdue finder
    // ... other metadata
  }
});
```

## Future Enhancements

- [ ] Support for time-of-day expressions ("this morning", "tonight")
- [ ] Timezone-aware parsing
- [ ] Natural language relative durations ("in the next 3 days")
- [ ] Recurring pattern matching (e.g., "every Monday" → filter to Mondays)
- [ ] Fuzzy temporal matching ("around the holidays")
- [ ] Integration with calendar events for deadline extraction
- [ ] Machine learning for confidence scoring

## Testing

Example test cases:

```typescript
// Test relative expressions
const parsed = parseTemporalExpression("last Tuesday");
expect(parsed).toBeTruthy();
expect(parsed.type).toBe("relative");

// Test absolute expressions
const absolute = parseTemporalExpression("2024-12-09");
expect(absolute.type).toBe("absolute");
expect(absolute.confidence).toBe(1.0);

// Test scoring
const score = calculateTemporalScore(
  new Date('2024-12-08'),
  { reference: { date: new Date('2024-12-09') }, direction: 'exact' },
  0
);
expect(score).toBeGreaterThan(0.9); // Within 1 day

// Test overdue detection
const events = await findOverdueItems(wm);
expect(events.every(e => extractDeadline(e) < new Date())).toBe(true);
```

## Changelog

### v1.0.0 (2024-12-09)
- Initial release
- Natural language temporal parsing
- Temporal-aware search with scoring
- Overdue detection
- Integration with Working Memory
- Comprehensive date-fns support

## License

Part of Wrath Shield v3 - Life OS Memory Architecture
