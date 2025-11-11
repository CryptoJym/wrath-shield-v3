"""
Wrath Shield v3 - Agentic Grok Service

Multi-agent orchestration using xAI's server-side agentic tool calling.
Grok autonomously searches, analyzes, and coordinates data from:
- Web/X search (server-side)
- Code execution (server-side)
- WHOOP (custom - coming soon)
- Limitless (custom - coming soon)
- Mem0 (custom - coming soon)

The agent runs entirely server-side with real-time streaming feedback.
"""

import os
from pathlib import Path
import json
import asyncio
from typing import AsyncIterator, Optional, Dict, Any, List
from datetime import datetime

def _load_env():
    # Minimal .env loader (no external deps). Loads .env.local then .env
    for fname in ('.env.local', '.env'):
        p = Path(__file__).resolve().parent / fname
        if not p.exists():
            continue
        try:
            for line in p.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                k = k.strip(); v = v.strip()
                if k and (k not in os.environ or os.environ[k] == ''):
                    os.environ[k] = v
        except Exception:
            pass

_load_env()

from xai_sdk import Client
from xai_sdk.chat import user, assistant, system
from xai_sdk.tools import web_search, x_search, code_execution, chat_pb2

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import httpx
import sqlite3
from pathlib import Path

# Import WHOOP API integration
try:
    from whoop_api import query_whoop_data
except Exception:
    async def query_whoop_data(data_type: str, days_back: int = 7):
        return {"data_type": data_type, "days_back": days_back, "note": "WHOOP API unavailable"}


# ============================================================================
# Custom Tool Definitions (Function-based)
# ============================================================================

def create_custom_tools() -> List[Any]:
    """
    Create custom function tools for WHOOP, Limitless, and Mem0.

    These tools define the schema - execution is handled separately.
    """

    # WHOOP Data Tool
    whoop_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="whoop_data_query",
            description="""Query WHOOP biometric data for the user. Can fetch:
- recovery: Latest recovery score and metrics
- sleep: Recent sleep performance and quality
- strain: Workout strain and cardiovascular load
- hrv: Heart rate variability trends

Use this when the user asks about their health metrics, recovery, sleep, or workout data.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "data_type": {
                        "type": "string",
                        "enum": ["recovery", "sleep", "strain", "hrv"],
                        "description": "Type of biometric data to query"
                    },
                    "days_back": {
                        "type": "integer",
                        "default": 7,
                        "description": "Number of days to look back (default: 7)"
                    }
                },
                "required": ["data_type"]
            })
        )
    )

    # Limitless Data Tool
    limitless_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="limitless_query",
            description="""Query Limitless Pendant data and recordings.
Can search conversations, retrieve recent recordings, get action items, or summarize topics.

Use this when the user asks about past conversations, meetings, or things they discussed.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "query_type": {
                        "type": "string",
                        "enum": ["search", "recent", "actions", "summary"],
                        "description": "Type of query to perform"
                    },
                    "search_term": {
                        "type": "string",
                        "description": "Search term for 'search' query type"
                    },
                    "limit": {
                        "type": "integer",
                        "default": 5,
                        "description": "Maximum number of results"
                    }
                },
                "required": ["query_type"]
            })
        )
    )

    # Mem0 Query Tool (read)
    mem0_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="memory_search",
            description="""Search the shared memory system for user context, preferences, and historical information.
This memory is shared across all AI agents and contains important user details.

Use this when you need to recall user preferences, past interactions, or stored context.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "What to search for in memory"
                    },
                    "user_id": {
                        "type": "string",
                        "description": "User identifier (optional)"
                    },
                    "limit": {
                        "type": "integer",
                        "default": 5,
                        "description": "Maximum number of memories to return"
                    }
                },
                "required": ["query"]
            })
        )
    )

    # Memory Add Tool (write)
    memory_add_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="memory_add",
            description="""Persist an important user memory for later use.
Call this ONLY for durable facts that are likely useful in future conversations, such as:
- Stable preferences (e.g., coffee order, preferred tools),
- Long-term projects/goals/tasks and deadlines,
- Biographical details and relationships explicitly shared,
- Anchors/commitments (category + date),
Do NOT store secrets (passwords, API keys), financial identifiers, or ephemeral one-off facts.
If the user explicitly says "remember ...", you may store without further confirmation.
Otherwise use discretion and store at most a few high-value items per session.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "What to store as memory"},
                    "user_id": {"type": "string", "description": "User identifier (optional)"},
                    "type": {"type": "string", "enum": ["fact", "preference", "anchor", "todo", "profile"], "description": "Memory type (optional)"},
                    "category": {"type": "string", "description": "Category for anchors/preferences (optional)"},
                    "date": {"type": "string", "description": "YYYY-MM-DD for dated memories like anchors (optional)"}
                },
                "required": ["text"]
            })
        )
    )

    return [whoop_tool, limitless_tool, mem0_tool, memory_add_tool]


# ============================================================================
# Tool Execution Handlers
# ============================================================================

async def execute_custom_tool(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute custom tools (WHOOP, Limitless, Mem0).
    """

    if tool_name == "whoop_data_query":
        data_type = arguments.get("data_type")
        days_back = arguments.get("days_back", 7)

        # Call actual WHOOP API
        return await query_whoop_data(data_type, days_back)

    elif tool_name == "limitless_query":
        query_type = arguments.get("query_type")
        search_term = arguments.get("search_term")

        # TODO: Call actual Limitless API
        return {
            "query_type": query_type,
            "search_term": search_term,
            "message": f"Limitless {query_type} query",
            "note": "Placeholder - Limitless API integration pending"
        }

    elif tool_name == "memory_search":
        query = arguments.get("query")
        user_id = arguments.get("user_id") or "default"
        limit = int(arguments.get("limit", 5))

        if not query or not isinstance(query, str):
            return {"error": "query is required for memory_search"}

        # Call Next.js API route which wraps Mem0 search
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:3000")

        # simple fallback to common alternate dev port
        candidate_urls = [f"{base_url}/api/memory/search", "http://localhost:3002/api/memory/search"]

        last_error: Optional[str] = None
        for url in candidate_urls:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, json={
                        "query": query,
                        "userId": user_id,
                        "limit": limit,
                    })
                    if resp.status_code == 200:
                        data = resp.json()
                        return {
                            "query": query,
                            "user_id": user_id,
                            "limit": limit,
                            "results": data.get("results", []),
                        }
                    else:
                        last_error = f"HTTP {resp.status_code}: {resp.text}"
            except Exception as e:
                last_error = str(e)

        return {
            "error": "Failed to query memory search endpoint",
            "details": last_error,
            "query": query,
            "user_id": user_id,
            "limit": limit,
        }

    elif tool_name == "memory_add":
        text = str(arguments.get("text") or "").strip()
        if not text:
            return {"error": "text is required for memory_add"}
        user_id = str(arguments.get("user_id") or "default")
        meta = {}
        if arguments.get("type"):
            meta["type"] = arguments.get("type")
        if arguments.get("category"):
            meta["category"] = arguments.get("category")
        if arguments.get("date"):
            meta["date"] = arguments.get("date")

        # Deduplicate simple exact matches (same user + text)
        conn = sqlite3.connect(MEM_DB_PATH)
        try:
            cur = conn.execute("SELECT id FROM memories WHERE user_id=? AND text=? LIMIT 1", (user_id, text))
            row = cur.fetchone()
            if row:
                return {"success": True, "id": row[0], "dedup": True}
            mem_id = __import__('uuid').uuid4().hex
            conn.execute(
                "INSERT INTO memories (id, user_id, text, metadata) VALUES (?, ?, ?, ?)",
                (mem_id, user_id, text, None if not meta else json.dumps(meta))
            )
            conn.commit()
            return {"success": True, "id": mem_id}
        finally:
            conn.close()

    return {"error": f"Unknown tool: {tool_name}"}


# ============================================================================
# Agentic Orchestrator
# ============================================================================

class AgenticOrchestrator:
    """
    Orchestrates agentic interactions with Grok using server-side tool calling.

    Manages:
    - Chat session creation with tools
    - Streaming responses with real-time events
    - Tool execution (both server-side and custom)
    """

    def __init__(self):
        api_key = os.getenv("XAI_API_KEY")
        if not api_key:
            raise ValueError("XAI_API_KEY environment variable not set")

        self.client = Client(api_key=api_key)
        self.model = "grok-4-fast"

        # Combine built-in and custom tools
        self.tools = [
            web_search(),
            x_search(),
            code_execution(),
            *create_custom_tools()
        ]

    def create_chat(
        self,
        system_prompt: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ):
        """Create a new chat session with tools enabled."""

        messages = []

        # Base memory policy
        memory_policy = (
            "You have tools memory_search and memory_add. "
            "Save memories only when they are durable and beneficial: stable preferences, long-term goals, "
            "biographical details shared explicitly, or dated anchors/todos. Avoid secrets or ephemeral facts. "
            "Use memory_add sparingly (max a few per session). Include type/category/date when appropriate."
        )
        messages.append(system(memory_policy))

        # Add optional system prompt after the policy
        if system_prompt:
            messages.append(system(system_prompt))

        # Add conversation history
        if conversation_history:
            for msg in conversation_history:
                if msg["role"] == "user":
                    messages.append(user(msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(assistant(msg["content"]))

        # Create chat with tools
        chat = self.client.chat.create(
            model=self.model,
            tools=self.tools,
        )

        # Add messages to chat
        for msg in messages:
            chat.append(msg)

        return chat

    async def stream_response(
        self,
        query: str,
        system_prompt: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        user_id: Optional[str] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Stream agentic response with real-time events.

        Yields events:
        - thinking: Agent is reasoning (shows token count)
        - tool_call: Agent is calling a tool
        - response_start: Agent begins generating response
        - content: Response text chunks
        - complete: Final metadata (citations, usage, etc.)
        """

        chat = self.create_chat(system_prompt, conversation_history)
        chat.append(user(query))

        is_thinking = True
        accumulated_content = ""
        tool_calls_made = []

        try:
            max_writes = int(os.getenv("AGENTIC_MEMORY_MAX_PER_CHAT", "3"))
            writes = 0
            for response, chunk in chat.stream():
                # Emit thinking progress (reasoning tokens)
                if response.usage.reasoning_tokens and is_thinking:
                    yield {
                        "type": "thinking",
                        "tokens": response.usage.reasoning_tokens,
                        "timestamp": datetime.now().isoformat()
                    }

                # Emit tool calls as they happen
                if chunk.tool_calls:
                    for tool_call in chunk.tool_calls:
                        tool_info = {
                            "type": "tool_call",
                            "tool": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                            "id": tool_call.id,
                            "timestamp": datetime.now().isoformat()
                        }
                        tool_calls_made.append(tool_info)
                        yield tool_info

                        # Execute memory_add immediately, respecting per-chat cap
                        if tool_call.function.name in ("memory_add", "store_memory") and writes < max_writes:
                            try:
                                args = tool_call.function.arguments
                                if isinstance(args, str):
                                    try:
                                        args = json.loads(args)
                                    except Exception:
                                        args = {"text": str(args)}
                                result = await execute_custom_tool("memory_add", args or {})
                                writes += 1 if result.get("success") else 0
                                yield {
                                    "type": "tool_result",
                                    "tool": tool_call.function.name,
                                    "result": result,
                                    "timestamp": datetime.now().isoformat()
                                }
                            except Exception as e:
                                yield {
                                    "type": "tool_result",
                                    "tool": tool_call.function.name,
                                    "error": str(e),
                                    "timestamp": datetime.now().isoformat()
                                }

                # Emit content chunks
                if chunk.content:
                    if is_thinking:
                        is_thinking = False
                        yield {
                            "type": "response_start",
                            "timestamp": datetime.now().isoformat()
                        }

                    accumulated_content += chunk.content
                    yield {
                        "type": "content",
                        "text": chunk.content,
                        "timestamp": datetime.now().isoformat()
                    }

            # Final complete event with metadata
            # Convert protobuf objects to JSON-serializable types
            citations = list(response.citations) if hasattr(response, 'citations') else []
            server_tool_usage = dict(response.server_side_tool_usage) if hasattr(response, 'server_side_tool_usage') else {}

            yield {
                "type": "complete",
                "content": accumulated_content,
                "citations": citations,
                "usage": {
                    "completion_tokens": response.usage.completion_tokens,
                    "prompt_tokens": response.usage.prompt_tokens,
                    "total_tokens": response.usage.total_tokens,
                    "reasoning_tokens": response.usage.reasoning_tokens,
                },
                "tool_calls": tool_calls_made,
                "server_side_tool_usage": server_tool_usage,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            yield {
                "type": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="Wrath Shield Agentic API",
    description="Multi-agent orchestration with xAI Grok",
    version="1.0.0"
)

# Initialize orchestrator
orchestrator = AgenticOrchestrator()

# Optional import of TimescaleDB client for DB status endpoint (resolve path relative to repo)
import sys as _sys
from pathlib import Path as _Path
_BASE = _Path(__file__).resolve().parents[1] / 'eeg-tokenizer'
if str(_BASE) not in _sys.path:
    _sys.path.insert(0, str(_BASE))
try:
    from db_client import DatabaseClient as _DatabaseClient
except Exception:
    _DatabaseClient = None


# Request/Response Models
class ChatRequest(BaseModel):
    query: str
    system_prompt: Optional[str] = None
    conversation_history: Optional[List[Dict[str, str]]] = None
    user_id: Optional[str] = None


# ============================================================================
# Simple Memory Store (SQLite) for Grok-backed memory
# ============================================================================

MEM_DB_PATH = Path(__file__).resolve().parent / 'mem_store.db'

def _init_mem_db():
    conn = sqlite3.connect(MEM_DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            text TEXT NOT NULL,
            metadata TEXT,
            created_at INTEGER DEFAULT (strftime('%s','now'))
        );
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_mem_user ON memories(user_id, created_at DESC);")
    conn.commit()
    conn.close()

_init_mem_db()

class MemoryAddRequest(BaseModel):
    text: str
    user_id: str
    metadata: Optional[dict] = None

class MemorySearchRequest(BaseModel):
    query: str
    user_id: str
    limit: int = 5

@app.post("/api/agentic/memory/add")
async def memory_add(req: MemoryAddRequest):
    conn = sqlite3.connect(MEM_DB_PATH)
    try:
        mem_id = __import__('uuid').uuid4().hex
        conn.execute(
            "INSERT INTO memories (id, user_id, text, metadata) VALUES (?, ?, ?, ?)",
            (mem_id, req.user_id, req.text, None if req.metadata is None else json.dumps(req.metadata))
        )
        conn.commit()
        return {"success": True, "id": mem_id}
    finally:
        conn.close()

@app.post("/api/agentic/memory/search")
async def memory_search(req: MemorySearchRequest):
    conn = sqlite3.connect(MEM_DB_PATH)
    try:
        cur = conn.execute(
            "SELECT id, text, metadata, created_at FROM memories WHERE user_id=? AND text LIKE ? ORDER BY created_at DESC LIMIT ?",
            (req.user_id, f"%{req.query}%", req.limit)
        )
        rows = cur.fetchall()
        results = [
            {
                "id": r[0],
                "text": r[1],
                "metadata": None if r[2] is None else json.loads(r[2]),
                "created_at": r[3],
            }
            for r in rows
        ]
        return {"results": results}
    finally:
        conn.close()

@app.get("/api/agentic/memory/list")
async def memory_list(user_id: str):
    conn = sqlite3.connect(MEM_DB_PATH)
    try:
        cur = conn.execute(
            "SELECT id, text, metadata, created_at FROM memories WHERE user_id=? ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cur.fetchall()
        results = [
            {
                "id": r[0],
                "text": r[1],
                "metadata": None if r[2] is None else json.loads(r[2]),
                "created_at": r[3],
            }
            for r in rows
        ]
        return {"results": results}
    finally:
        conn.close()


@app.post("/api/agentic/chat/stream")
async def stream_chat(request: ChatRequest):
    """
    Streaming endpoint for agentic chat.

    Returns Server-Sent Events (SSE) with real-time updates:
    - thinking events
    - tool_call events
    - content chunks
    - complete metadata
    """

    async def event_generator():
        async for event in orchestrator.stream_response(
            query=request.query,
            system_prompt=request.system_prompt,
            conversation_history=request.conversation_history,
            user_id=request.user_id,
        ):
            yield {
                "event": event["type"],
                "data": json.dumps(event)
            }

    return EventSourceResponse(event_generator())


@app.post("/api/agentic/chat")
async def chat(request: ChatRequest):
    """
    Non-streaming endpoint for agentic chat.
    Returns complete response after all processing.
    """

    events = []
    final_response = None

    async for event in orchestrator.stream_response(
        query=request.query,
        system_prompt=request.system_prompt,
        conversation_history=request.conversation_history,
        user_id=request.user_id,
    ):
        events.append(event)
        if event["type"] == "complete":
            final_response = event

    return final_response or {"error": "No response generated"}


@app.get("/api/agentic/health")
async def health_check():
    """Health check endpoint."""
    tool_names: List[str] = ["web_search", "x_search", "code_execution"]
    try:
        for t in orchestrator.tools:
            # chat_pb2.Tool(function=Function(name=...))
            name = getattr(getattr(t, 'function', None), 'name', None)
            if name:
                tool_names.append(name)
    except Exception:
        pass
    return {
        "status": "healthy",
        "service": "agentic-grok",
        "model": orchestrator.model,
        "tools": tool_names,
    }


@app.get("/api/db/status")
async def db_status():
    if _DatabaseClient is None:
        raise HTTPException(status_code=500, detail="Database client unavailable")
    try:
        with _DatabaseClient() as db:
            return db.get_data_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8001))

    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║           Wrath Shield v3 - Agentic Grok Service                 ║
╚══════════════════════════════════════════════════════════════════╝

🤖 Model: {orchestrator.model}
🛠️  Tools: {len(orchestrator.tools)} enabled
    • web_search (server-side)
    • x_search (server-side)
    • code_execution (server-side)
    • whoop_data_query (custom)
    • limitless_query (custom)
    • memory_search (custom)

🌐 Server: http://localhost:{port}
📡 Streaming: /api/agentic/chat/stream
💬 Standard: /api/agentic/chat
🏥 Health: /api/agentic/health

Ready for agentic orchestration! 🚀
""")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
