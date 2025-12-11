# HYRO Memory Layer Service

This service provides AI-native semantic memory for the HYRO Forge assessment system using [Mem0](https://github.com/mem0ai/mem0) and [Graphiti](https://github.com/getzep/graphiti).

## Features

- **Semantic Memory (Mem0)** - Store and retrieve memories using natural language
- **Temporal Event Tracking** - Track student learning events over time
- **Misconception Recording** - Store and query student misconceptions
- **Student Context API** - Get aggregated context for item generation
- **Fully Local Operation** - No cloud API keys required (using Ollama + Qdrant)

## Operation Modes

The service supports three operation modes configured via `MEM0_MODE`:

| Mode | LLM | Embeddings | Cost | Privacy |
|------|-----|------------|------|---------|
| `local` | Ollama | Ollama | **Free** | **Full** |
| `cloud` | OpenAI | OpenAI | ~$0.002/1K tokens | Moderate |
| `hybrid` | OpenAI | Ollama | Lower | Moderate |

## Quick Start (Local Mode - Recommended)

### 1. Start Qdrant Vector Database

```bash
cd services/memory-layer
docker-compose up -d qdrant
```

### 2. Install Ollama Models (December 2025 Recommended)

```bash
# Make sure Ollama is running: ollama serve
ollama pull qwen3:8b          # Best reasoning, dual-mode thinking
ollama pull bge-m3            # Best embeddings, 1024 dims, 72% accuracy
```

**Alternative models:**
- `deepseek-r1:8b` - MIT license, distilled from 671B parameter model
- `llama3.1:8b` - Proven baseline, stable performance

### 3. Configure Environment

```bash
cp .env.example .env
# Default is local mode - no API keys needed!
```

### 4. Start the Service

```bash
./start.sh
```

Or manually:

```bash
source venv/bin/activate
uvicorn main:app --port 8789 --reload
```

### 5. Verify It's Running

```bash
curl http://localhost:8789/health
# Should show: "mode": "local", "mem0_initialized": true
```

## API Endpoints

### Health Check
```
GET /health
```

### Memory Operations

```
POST /memory/add
{
    "student_id": "student123",
    "content": "Student struggled with fraction division",
    "stat": "math",
    "session_id": "session456"
}

POST /memory/search
{
    "student_id": "student123",
    "query": "fraction difficulties",
    "stat": "math",
    "limit": 10
}

GET /memory/history/{student_id}
```

### Misconception Tracking

```
POST /misconception/record
{
    "student_id": "student123",
    "stat": "math",
    "strand": "Fractions",
    "misconception": "Treats division as multiplication",
    "item_id": "item789",
    "severity": 0.7
}

GET /misconception/get/{student_id}?stat=math
```

### Performance Events

```
POST /event/record
{
    "student_id": "student123",
    "stat": "math",
    "event_type": "item_response",
    "data": {
        "correct": true,
        "difficulty": 0.65,
        "response_time": 15000
    }
}

GET /event/timeline/{student_id}?stat=math&limit=50
```

### Student Context

```
POST /profile/context
{
    "student_id": "student123",
    "stat": "math"
}
```

### Remote GPU Inference (Tailscale Studios)

```
GET /inference/status
# Returns status of local and remote Ollama instances

POST /inference/remote
{
    "task_type": "misconception_analysis",
    "prompt": "A student answered 1/2 + 1/3 = 2/5. What misconception?",
    "system_prompt": "You are an expert math tutor.",
    "temperature": 0.1,
    "max_tokens": 500
}
# Returns both content AND thinking (Chain of Thought) for qwen3
```

**Response with qwen3's dual-mode thinking:**
```json
{
    "content": "The student added numerators and denominators separately...",
    "thinking": "Let me analyze this step by step...",
    "model": "qwen3:8b",
    "remote": false
}
```

## Integration with HYRO Forge

The TypeScript client is available at `lib/hyro/forge-memory-client.ts`:

```typescript
import { getMemoryClient, recordItemResponse, getGenerationContext } from '@/lib/hyro/forge-memory-client';

// Check if service is available
const client = getMemoryClient();
if (await client.isAvailable()) {
    // Record an item response
    await recordItemResponse(
        studentId,
        'math',
        itemId,
        true,  // correct
        15000, // response time ms
        1.2,   // theta
        0.65   // difficulty
    );

    // Get context for item generation
    const context = await getGenerationContext(studentId, 'math');
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HYRO Forge Frontend                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   forge-memory-integration.ts                │
│          (Dual-write to SQLite + Memory Service)            │
└─────────────────────────────────────────────────────────────┘
                    │                    │
                    ▼                    ▼
    ┌───────────────────────┐  ┌─────────────────────────────┐
    │  forge-memory-        │  │     Memory Layer Service    │
    │  architecture.ts      │  │         (Python)            │
    │  (SQLite - Primary)   │  │                             │
    └───────────────────────┘  │  ┌─────────┐  ┌──────────┐  │
                               │  │  Mem0   │  │ Graphiti │  │
                               │  │ (Qdrant)│  │ (Neo4j)  │  │
                               │  └─────────┘  └──────────┘  │
                               └─────────────────────────────┘
```

## Memory Systems Comparison

| Feature | Local SQLite | Mem0 (Local) | Mem0 (Cloud) | Graphiti |
|---------|-------------|--------------|--------------|----------|
| Latency | ~1ms | ~200ms | ~100ms | ~200ms |
| Semantic Search | ❌ | ✅ | ✅ | ✅ |
| Structured Queries | ✅ | ❌ | ❌ | ✅ |
| Temporal Modeling | Basic | ❌ | ❌ | ✅ |
| Knowledge Graphs | ❌ | Optional | Optional | ✅ |
| Offline Support | ✅ | ✅ | ❌ | ❌ |
| API Costs | **Free** | **Free** | ~$0.002/1K | Variable |

## Requirements for Local Mode

- **Docker** - For Qdrant vector database
- **Ollama** - For local LLM inference
- **~8GB RAM** - For running qwen3:8b
- **~1.5GB disk** - For bge-m3 embeddings

## Remote GPU Studios (Tailscale)

For complex reasoning tasks, you can offload inference to GPU-equipped machines via Tailscale:

### Setup on GPU Studio

```bash
# On your GPU machine (e.g., with RTX 4090)
ollama serve --host 0.0.0.0

# Pull larger models
ollama pull deepseek-r1:32b   # 19GB - excellent reasoning
ollama pull deepseek-r1:70b   # 43GB - state-of-the-art (requires 48GB+ VRAM)
```

### Configure Memory Layer

```bash
# In .env
REMOTE_OLLAMA_URL=http://gpu-studio.tailnet-xxxx.ts.net:11434
REMOTE_OLLAMA_MODEL=deepseek-r1:32b
REMOTE_TASKS=misconception_analysis,context_synthesis
```

### Task Routing

| Task Type | Description | Recommended Model |
|-----------|-------------|-------------------|
| `misconception_analysis` | Deep reasoning about student errors | deepseek-r1:32b |
| `context_synthesis` | Combining multiple memory sources | deepseek-r1:32b |
| `general` | Standard inference | qwen3:8b (local) |
| `all` | Route everything to remote | - |

The service automatically falls back to local if remote is unavailable.

## License

Both Mem0 and Graphiti are Apache 2.0 licensed.
