# Ollama Integration Architecture

## Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Agent Invocation Request                        │
│                   (e.g., agent.comms classification)                    │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────────┐
        │     AgentInvoker.invoke(params)                   │
        │                                                    │
        │  1. Load agent config from AGENT_PROVIDER_MAP     │
        │     → agent.comms = { provider: 'ollama',         │
        │                       model: 'deepseek-r1:32b',   │
        │                       fallback: { provider: 'xai',│
        │                                   model: 'grok-   │
        │                                   4-1-fast' } }    │
        └────────────┬───────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────────────────┐
        │  2. Build prompt with system context + user msg    │
        │     - Inject Life OS Charter                       │
        │     - Add Zep memory context                       │
        │     - Apply domain context                         │
        └────────────┬───────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────────────────┐
        │  3. routeToLLM(prompt, 'ollama', 'deepseek-r1:32b')│
        │                                                    │
        │     switch (provider) {                            │
        │       case 'ollama':                               │
        │         return callOllama(prompt, model);          │
        │     }                                              │
        └────────────┬───────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────────────────┐
        │  4. callOllama() → DirectLLMClients.ollamaChat()  │
        │                                                    │
        │     const ollama = new Ollama({ host })            │
        │     await ollama.chat({                            │
        │       model: 'deepseek-r1:32b',                    │
        │       messages: [...],                             │
        │       options: { temperature, num_predict }        │
        │     })                                             │
        └────────────┬───────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────────────────┐
        │  5. Try Ollama with 30s timeout                    │
        └──┬─────────────────────────────────────────────┬───┘
           │                                             │
           │ SUCCESS                                     │ FAIL
           │                                             │
           ▼                                             ▼
    ┌──────────────┐                         ┌─────────────────────┐
    │ Return result│                         │ Catch error:        │
    │ model:       │                         │ - ECONNREFUSED      │
    │ deepseek-    │                         │ - Timeout           │
    │ r1:32b       │                         │ - Model not found   │
    └──────────────┘                         └──────┬──────────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────────┐
                                         │ 6. Try Fallback (xAI)   │
                                         │                         │
                                         │ routeToLLM(prompt,      │
                                         │   'xai',                │
                                         │   'grok-4-1-fast')      │
                                         └──────┬──────────────────┘
                                                │
                                                ▼
                                         ┌─────────────────────────┐
                                         │ callXAI() → xaiChat()   │
                                         │                         │
                                         │ POST https://api.x.ai/  │
                                         │   v1/chat/completions   │
                                         └──┬──────────────────┬───┘
                                            │                  │
                                            │ SUCCESS          │ FAIL
                                            │                  │
                                            ▼                  ▼
                                     ┌─────────────┐  ┌──────────────────┐
                                     │ Return      │  │ 7. Last Resort:  │
                                     │ model:      │  │ OpenRouter       │
                                     │ grok-4-1-   │  │                  │
                                     │ fast        │  │ callOpenRouter() │
                                     │ (fallback)  │  └──────────────────┘
                                     └─────────────┘
```

## Component Structure

```
/lib/agents/
├── types.ts
│   └── LLMProvider = 'openai' | 'xai' | 'ollama'
│   └── AGENT_PROVIDER_MAP
│       ├── agent.comms → ollama (deepseek-r1:32b) + xai fallback
│       └── agent.relationships → ollama (deepseek-r1:32b) + xai fallback
│
└── AgentInvoker.ts
    ├── invoke(params) ────────────────┐
    ├── routeToLLM()                   │
    │   ├── case 'openai'              │
    │   ├── case 'xai'                 │
    │   └── case 'ollama' ──────┐      │
    │                            │      │
    ├── callOpenAI() ────────┐  │      │
    ├── callXAI() ────────┐  │  │      │
    └── callOllama() ──┐  │  │  │      │
                       │  │  │  │      │
                       ▼  ▼  ▼  ▼      │
/lib/DirectLLMClients.ts               │
    ├── openaiChat()                   │
    ├── xaiChat()                      │
    └── ollamaChat() ◄─────────────────┘
        └── new Ollama({ host })
            └── ollama.chat({ model, messages, options })
```

## Error Handling Flow

```
Ollama Request
      │
      ├─ ECONNREFUSED (server not running)
      │     └─→ Fallback to xAI
      │
      ├─ Timeout (> 30s)
      │     └─→ Fallback to xAI
      │
      ├─ Model not found
      │     └─→ Fallback to xAI
      │
      └─ Other errors
            └─→ Fallback to xAI
                  │
                  ├─ xAI Success → Return
                  │
                  └─ xAI Fail → OpenRouter (last resort)
```

## Configuration Points

### 1. Environment Variables (`.env`)
```bash
OLLAMA_HOST=http://localhost:11434        # Ollama server URL
OLLAMA_TIMEOUT_MS=30000                   # Request timeout (30s)
```

### 2. Agent Configuration (`/lib/agents/types.ts`)
```typescript
AGENT_PROVIDER_MAP = {
  'agent.comms': {
    provider: 'ollama',
    model: 'deepseek-r1:32b',
    fallback: { provider: 'xai', model: 'grok-4-1-fast' }
  }
}
```

### 3. Runtime Override (per request)
```typescript
agentInvoker.invoke({
  agentId: 'agent.finance',
  providerOverride: 'ollama',    // Force Ollama
  modelOverride: 'llama3:8b'     // Use different model
})
```

## Logging and Observability

All events are logged at different stages:

1. **Primary attempt**: `[AgentInvoker] {provider} | {escalation} | {latency}ms | {tokens} tokens`
2. **Fallback triggered**: `[AgentInvoker] {provider} failed: {error}`
3. **Fallback attempt**: `[AgentInvoker] Falling back to configured {fallbackProvider}`
4. **Last resort**: `[AgentInvoker] Fallback {fallbackProvider} also failed, using OpenRouter`

Example log sequence:
```
[AgentInvoker] ollama | AUTO_EXECUTE | timeout
[AgentInvoker] ollama failed: Ollama error: Ollama request timeout
[AgentInvoker] Falling back to configured xai (grok-4-1-fast)
[AgentInvoker] xai | AUTO_EXECUTE | 1234ms | 456 tokens
```

## Integration Points

### Current Agents Using Ollama
- `agent.comms` - Email/message classification
- `agent.relationships` - Contact analysis

### Potential Future Agents
- `agent.inbox` - Message routing
- `agent.pm` - Task classification
- Any agent requiring fast, local classification

### Model Options
Recommended local models for different use cases:
- `deepseek-r1:32b` - Complex reasoning, classification
- `llama3:8b` - Fast, lightweight
- `phi3:mini` - Very fast, minimal resources
- `mistral:7b` - Balanced performance

---

**Architecture Status**: Production-ready
**Fallback Chain**: Ollama → xAI → OpenRouter
**Fault Tolerance**: 3-tier degradation
**Performance**: Local-first with cloud backup
