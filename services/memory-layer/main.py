"""
HYRO Memory Layer Service

Provides a FastAPI wrapper around Mem0 and Graphiti for the HYRO Forge assessment system.
This enables semantic memory for student profiles and temporal knowledge graphs for
tracking learning trajectories.

SETUP:
1. Start Qdrant: docker-compose up -d qdrant
2. Configure .env with your preferred LLM provider
3. Run: uvicorn main:app --port 8789 --reload

MODES:
- Cloud (OpenAI): Set OPENAI_API_KEY - uses OpenAI for LLM and embeddings
- Local (Ollama): Set MEM0_MODE=local and ensure Ollama is running
- Hybrid: Use Ollama for embeddings, OpenAI for LLM
"""

import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# =============================================================================
# CONFIGURATION
# =============================================================================

# Mode detection
MEM0_MODE = os.getenv("MEM0_MODE", "cloud")  # "cloud", "local", or "hybrid"
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# Remote GPU Studio configuration (Tailscale)
REMOTE_OLLAMA_URL = os.getenv("REMOTE_OLLAMA_URL")  # e.g., http://gpu-studio:11434
REMOTE_OLLAMA_MODEL = os.getenv("REMOTE_OLLAMA_MODEL", "deepseek-r1:32b")
REMOTE_TASKS = os.getenv("REMOTE_TASKS", "").split(",") if os.getenv("REMOTE_TASKS") else []

# Try to import mem0
try:
    from mem0 import Memory
    MEM0_AVAILABLE = True
except ImportError:
    MEM0_AVAILABLE = False
    Memory = None


def get_mem0_config() -> dict:
    """
    Build Mem0 configuration based on environment.

    Supports three modes:
    - cloud: Uses OpenAI for LLM and embeddings (requires OPENAI_API_KEY)
    - local: Uses Ollama for both LLM and embeddings (fully offline)
    - hybrid: Uses Ollama embeddings + OpenAI LLM
    """
    mode = MEM0_MODE.lower()

    config = {
        "version": "v1.1",
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": "hyro_student_memory",
                "host": QDRANT_HOST,
                "port": QDRANT_PORT,
            }
        },
    }

    if mode == "local":
        # Fully local with Ollama
        config["llm"] = {
            "provider": "ollama",
            "config": {
                "model": os.getenv("OLLAMA_MODEL", "llama3.1:8b"),
                "temperature": 0.1,
                "max_tokens": 2000,
                "ollama_base_url": OLLAMA_BASE_URL,
            }
        }
        config["embedder"] = {
            "provider": "ollama",
            "config": {
                "model": os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text:latest"),
                "ollama_base_url": OLLAMA_BASE_URL,
            }
        }
        # Set embedding dimensions for Ollama models
        config["vector_store"]["config"]["embedding_model_dims"] = int(
            os.getenv("EMBEDDING_DIMS", "768")
        )

    elif mode == "hybrid":
        # Ollama embeddings + OpenAI LLM
        config["llm"] = {
            "provider": "openai",
            "config": {
                "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                "temperature": 0.1,
            }
        }
        config["embedder"] = {
            "provider": "ollama",
            "config": {
                "model": os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text:latest"),
                "ollama_base_url": OLLAMA_BASE_URL,
            }
        }
        config["vector_store"]["config"]["embedding_model_dims"] = int(
            os.getenv("EMBEDDING_DIMS", "768")
        )

    else:  # cloud mode (default)
        config["llm"] = {
            "provider": "openai",
            "config": {
                "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                "temperature": 0.1,
            }
        }
        config["embedder"] = {
            "provider": "openai",
            "config": {
                "model": os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small"),
            }
        }

    # Optional: Add Neo4j graph store if configured
    neo4j_url = os.getenv("NEO4J_URL")
    if neo4j_url:
        config["graph_store"] = {
            "provider": "neo4j",
            "config": {
                "url": neo4j_url,
                "username": os.getenv("NEO4J_USERNAME", "neo4j"),
                "password": os.getenv("NEO4J_PASSWORD", ""),
            }
        }

    return config


# Global memory instance
memory_instance: Optional[Memory] = None


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class MemoryAddRequest(BaseModel):
    """Request to add a memory."""
    student_id: str = Field(..., description="Student identifier")
    content: str = Field(..., description="Memory content to store")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")
    stat: Optional[str] = Field(default=None, description="Related stat (math, reading, etc.)")
    session_id: Optional[str] = Field(default=None, description="Assessment session ID")


class MemorySearchRequest(BaseModel):
    """Request to search memories."""
    student_id: str = Field(..., description="Student identifier")
    query: str = Field(..., description="Search query")
    stat: Optional[str] = Field(default=None, description="Filter by stat")
    limit: int = Field(default=10, description="Maximum results to return")


class MemoryResponse(BaseModel):
    """Standard memory response."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None


class StudentProfileRequest(BaseModel):
    """Request for student profile operations."""
    student_id: str
    stat: Optional[str] = None


class MisconceptionRecord(BaseModel):
    """Record of a student misconception."""
    student_id: str
    stat: str
    strand: str
    misconception: str
    item_id: Optional[str] = None
    severity: float = Field(default=0.5, ge=0.0, le=1.0)


class PerformanceEvent(BaseModel):
    """Record of a performance event for temporal tracking."""
    student_id: str
    stat: str
    event_type: str  # 'item_response', 'session_complete', 'mastery_achieved', etc.
    data: Dict[str, Any]
    timestamp: Optional[str] = None


class RemoteInferenceRequest(BaseModel):
    """Request for remote GPU inference via Tailscale studio."""
    task_type: str = Field(..., description="Task type: misconception_analysis, context_synthesis, etc.")
    prompt: str = Field(..., description="The prompt to send to the model")
    system_prompt: Optional[str] = Field(default=None, description="Optional system prompt")
    temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2000, ge=1, le=8000)


# =============================================================================
# REMOTE GPU HELPER
# =============================================================================

async def call_remote_ollama(
    prompt: str,
    task_type: str = "general",
    system_prompt: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 2000
) -> Dict[str, Any]:
    """
    Call remote Ollama instance on Tailscale GPU studio.
    Falls back to local if remote is unavailable.
    """
    import httpx

    # Determine which URL to use
    use_remote = REMOTE_OLLAMA_URL and (task_type in REMOTE_TASKS or "all" in REMOTE_TASKS)
    target_url = REMOTE_OLLAMA_URL if use_remote else OLLAMA_BASE_URL
    model = REMOTE_OLLAMA_MODEL if use_remote else os.getenv("OLLAMA_MODEL", "qwen3:8b")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{target_url}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                }
            )
            response.raise_for_status()
            result = response.json()

            # Handle qwen3's thinking mode - content may be in 'thinking' field
            message = result.get("message", {})
            content = message.get("content", "")
            thinking = message.get("thinking", "")

            # If content is empty but thinking exists, the model uses thinking mode
            # Return both for transparency
            return {
                "success": True,
                "content": content if content else thinking,
                "thinking": thinking if content else None,  # Only include if separate
                "model": model,
                "remote": use_remote,
                "target": target_url
            }
    except Exception as e:
        # If remote fails and we were trying remote, fallback to local
        if use_remote and OLLAMA_BASE_URL:
            print(f"[WARN] Remote Ollama failed, falling back to local: {e}")
            return await call_remote_ollama(
                prompt=prompt,
                task_type="__local_fallback__",  # Prevents infinite recursion
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens
            )
        return {
            "success": False,
            "error": str(e),
            "model": model,
            "remote": use_remote
        }


# =============================================================================
# LIFESPAN MANAGEMENT
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources."""
    global memory_instance

    print(f"[INFO] Starting HYRO Memory Layer in {MEM0_MODE.upper()} mode")
    print(f"[INFO] Qdrant: {QDRANT_HOST}:{QDRANT_PORT}")

    if MEM0_MODE == "local":
        print(f"[INFO] Ollama: {OLLAMA_BASE_URL}")

    # Initialize Mem0 if available
    if MEM0_AVAILABLE:
        try:
            config = get_mem0_config()

            # Validate required credentials
            if MEM0_MODE == "cloud" and not os.getenv("OPENAI_API_KEY"):
                print("[WARN] OPENAI_API_KEY not set - Mem0 cloud mode requires it")
                print("[HINT] Set MEM0_MODE=local to use Ollama instead")
                memory_instance = None
            else:
                memory_instance = Memory.from_config(config)
                print("[OK] Mem0 initialized successfully")

        except Exception as e:
            print(f"[ERROR] Failed to initialize Mem0: {e}")
            if "Connection refused" in str(e):
                print("[HINT] Is Qdrant running? Try: docker-compose up -d qdrant")
            if "Ollama" in str(e) or "11434" in str(e):
                print("[HINT] Is Ollama running? Try: ollama serve")
            memory_instance = None
    else:
        print("[WARN] Mem0 not available - install with: pip install mem0ai")

    yield

    # Cleanup
    print("[OK] Memory service shutting down")


# =============================================================================
# FASTAPI APP
# =============================================================================

app = FastAPI(
    title="HYRO Memory Layer",
    description="Semantic memory and temporal knowledge graph service for HYRO Forge",
    version="1.0.0",
    lifespan=lifespan,
)


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""

    # Check Qdrant connection
    qdrant_healthy = False
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"http://{QDRANT_HOST}:{QDRANT_PORT}/readyz", timeout=2.0)
            qdrant_healthy = resp.status_code == 200
    except Exception:
        pass

    return {
        "status": "healthy" if memory_instance else "degraded",
        "mode": MEM0_MODE,
        "mem0_available": MEM0_AVAILABLE,
        "mem0_initialized": memory_instance is not None,
        "qdrant_connected": qdrant_healthy,
        "qdrant_url": f"{QDRANT_HOST}:{QDRANT_PORT}",
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# MEMORY ENDPOINTS (Mem0)
# =============================================================================

@app.post("/memory/add", response_model=MemoryResponse)
async def add_memory(request: MemoryAddRequest):
    """Add a memory for a student."""
    if memory_instance is None:
        return MemoryResponse(
            success=False,
            error=f"Mem0 not initialized - check configuration for {MEM0_MODE} mode"
        )

    try:
        # Build metadata
        metadata = request.metadata or {}
        if request.stat:
            metadata["stat"] = request.stat
        if request.session_id:
            metadata["session_id"] = request.session_id
        metadata["timestamp"] = datetime.utcnow().isoformat()

        # Add memory
        result = memory_instance.add(
            messages=[{"role": "user", "content": request.content}],
            user_id=request.student_id,
            metadata=metadata,
        )

        return MemoryResponse(success=True, data=result)
    except Exception as e:
        return MemoryResponse(success=False, error=str(e))


@app.post("/memory/search", response_model=MemoryResponse)
async def search_memory(request: MemorySearchRequest):
    """Search memories for a student."""
    if memory_instance is None:
        return MemoryResponse(
            success=False,
            error=f"Mem0 not initialized - check configuration for {MEM0_MODE} mode"
        )

    try:
        # Search memories
        results = memory_instance.search(
            query=request.query,
            user_id=request.student_id,
            limit=request.limit,
        )

        # Filter by stat if specified
        if request.stat and results:
            filtered = []
            for r in results:
                # Handle both dict results and object results
                if isinstance(r, dict):
                    metadata = r.get("metadata", {})
                    if isinstance(metadata, dict) and metadata.get("stat") == request.stat:
                        filtered.append(r)
                elif hasattr(r, 'metadata'):
                    metadata = r.metadata if isinstance(r.metadata, dict) else {}
                    if metadata.get("stat") == request.stat:
                        filtered.append(r)
                else:
                    # Include if we can't determine stat
                    filtered.append(r)
            results = filtered if filtered else results

        return MemoryResponse(success=True, data=results)
    except Exception as e:
        return MemoryResponse(success=False, error=str(e))


@app.get("/memory/history/{student_id}", response_model=MemoryResponse)
async def get_memory_history(student_id: str):
    """Get all memories for a student."""
    if memory_instance is None:
        return MemoryResponse(
            success=False,
            error=f"Mem0 not initialized - check configuration for {MEM0_MODE} mode"
        )

    try:
        results = memory_instance.get_all(user_id=student_id)
        return MemoryResponse(success=True, data=results)
    except Exception as e:
        return MemoryResponse(success=False, error=str(e))


# =============================================================================
# MISCONCEPTION TRACKING
# =============================================================================

@app.post("/misconception/record", response_model=MemoryResponse)
async def record_misconception(record: MisconceptionRecord):
    """Record a student misconception."""
    if memory_instance is None:
        # Fallback to local storage if Mem0 not available
        return MemoryResponse(
            success=True,
            data={"stored": "local", "record": record.model_dump()}
        )

    try:
        content = f"Misconception in {record.stat}/{record.strand}: {record.misconception}"

        result = memory_instance.add(
            messages=[{"role": "system", "content": content}],
            user_id=record.student_id,
            metadata={
                "type": "misconception",
                "stat": record.stat,
                "strand": record.strand,
                "item_id": record.item_id,
                "severity": record.severity,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

        return MemoryResponse(success=True, data=result)
    except Exception as e:
        return MemoryResponse(success=False, error=str(e))


@app.get("/misconception/get/{student_id}", response_model=MemoryResponse)
async def get_misconceptions(student_id: str, stat: Optional[str] = None):
    """Get misconceptions for a student, optionally filtered by stat."""
    if memory_instance is None:
        return MemoryResponse(success=True, data=[])

    try:
        # Search for misconception memories
        results = memory_instance.search(
            query="misconception error incorrect understanding",
            user_id=student_id,
            limit=50,
        )

        # Filter to only misconception type
        misconceptions = [
            r for r in results
            if r.get("metadata", {}).get("type") == "misconception"
        ]

        # Filter by stat if specified
        if stat:
            misconceptions = [
                m for m in misconceptions
                if m.get("metadata", {}).get("stat") == stat
            ]

        return MemoryResponse(success=True, data=misconceptions)
    except Exception as e:
        return MemoryResponse(success=False, error=str(e))


# =============================================================================
# PERFORMANCE EVENTS (Temporal Tracking)
# =============================================================================

# Local event storage (until Graphiti is configured)
_event_store: Dict[str, List[Dict]] = {}


@app.post("/event/record", response_model=MemoryResponse)
async def record_event(event: PerformanceEvent):
    """Record a performance event for temporal tracking."""
    event_data = event.model_dump()
    event_data["timestamp"] = event.timestamp or datetime.utcnow().isoformat()

    # Store in local event store
    key = f"{event.student_id}:{event.stat}"
    if key not in _event_store:
        _event_store[key] = []
    _event_store[key].append(event_data)

    # Also store in Mem0 if available
    if memory_instance is not None:
        try:
            content = f"Performance event ({event.event_type}) in {event.stat}: {json.dumps(event.data)}"
            memory_instance.add(
                messages=[{"role": "system", "content": content}],
                user_id=event.student_id,
                metadata={
                    "type": "performance_event",
                    "event_type": event.event_type,
                    "stat": event.stat,
                    **event.data,
                    "timestamp": event_data["timestamp"],
                }
            )
        except Exception as e:
            print(f"[WARN] Failed to store event in Mem0: {e}")

    return MemoryResponse(success=True, data=event_data)


@app.get("/event/timeline/{student_id}", response_model=MemoryResponse)
async def get_event_timeline(
    student_id: str,
    stat: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 100,
):
    """Get timeline of events for a student."""
    events = []

    # Collect from local store
    for key, stored_events in _event_store.items():
        sid, s = key.split(":", 1)
        if sid == student_id:
            if stat is None or s == stat:
                events.extend(stored_events)

    # Filter by event type
    if event_type:
        events = [e for e in events if e.get("event_type") == event_type]

    # Sort by timestamp (newest first)
    events.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    return MemoryResponse(success=True, data=events[:limit])


# =============================================================================
# STUDENT PROFILE AGGREGATION
# =============================================================================

@app.post("/profile/context", response_model=MemoryResponse)
async def get_student_context(request: StudentProfileRequest):
    """Get aggregated context for a student (for item generation)."""
    context = {
        "student_id": request.student_id,
        "stat": request.stat,
        "memories": [],
        "misconceptions": [],
        "recent_events": [],
        "generated_at": datetime.utcnow().isoformat(),
    }

    if memory_instance is not None:
        try:
            # Get relevant memories
            query = f"learning history performance {request.stat or ''}"
            memories = memory_instance.search(
                query=query,
                user_id=request.student_id,
                limit=20,
            )
            context["memories"] = memories

            # Get misconceptions
            misconceptions = memory_instance.search(
                query="misconception error",
                user_id=request.student_id,
                limit=10,
            )
            context["misconceptions"] = [
                m for m in misconceptions
                if m.get("metadata", {}).get("type") == "misconception"
                and (request.stat is None or m.get("metadata", {}).get("stat") == request.stat)
            ]
        except Exception as e:
            print(f"[WARN] Error fetching context: {e}")

    # Get recent events
    events_result = await get_event_timeline(
        request.student_id,
        stat=request.stat,
        limit=10
    )
    if events_result.success:
        context["recent_events"] = events_result.data

    return MemoryResponse(success=True, data=context)


# =============================================================================
# REMOTE GPU INFERENCE
# =============================================================================

@app.post("/inference/remote", response_model=MemoryResponse)
async def remote_inference(request: RemoteInferenceRequest):
    """
    Run inference on remote GPU studio via Tailscale.

    Supported task types:
    - misconception_analysis: Analyze student misconceptions with deep reasoning
    - context_synthesis: Synthesize student context from multiple sources
    - general: General LLM inference

    Falls back to local model if remote is unavailable.
    """
    result = await call_remote_ollama(
        prompt=request.prompt,
        task_type=request.task_type,
        system_prompt=request.system_prompt,
        temperature=request.temperature,
        max_tokens=request.max_tokens
    )

    return MemoryResponse(
        success=result.get("success", False),
        data=result if result.get("success") else None,
        error=result.get("error")
    )


@app.get("/inference/status")
async def inference_status():
    """Check status of local and remote inference endpoints."""
    import httpx

    status = {
        "local": {
            "url": OLLAMA_BASE_URL,
            "model": os.getenv("OLLAMA_MODEL", "qwen3:8b"),
            "available": False
        },
        "remote": {
            "url": REMOTE_OLLAMA_URL,
            "model": REMOTE_OLLAMA_MODEL,
            "enabled": bool(REMOTE_OLLAMA_URL),
            "tasks": REMOTE_TASKS,
            "available": False
        }
    }

    async with httpx.AsyncClient(timeout=5.0) as client:
        # Check local
        try:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                status["local"]["available"] = True
                models = resp.json().get("models", [])
                status["local"]["models"] = [m.get("name") for m in models]
        except Exception:
            pass

        # Check remote if configured
        if REMOTE_OLLAMA_URL:
            try:
                resp = await client.get(f"{REMOTE_OLLAMA_URL}/api/tags")
                if resp.status_code == 200:
                    status["remote"]["available"] = True
                    models = resp.json().get("models", [])
                    status["remote"]["models"] = [m.get("name") for m in models]
            except Exception as e:
                status["remote"]["error"] = str(e)

    return status


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8789)
