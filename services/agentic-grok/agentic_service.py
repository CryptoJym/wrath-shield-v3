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
import json
import asyncio
from typing import AsyncIterator, Optional, Dict, Any, List
from datetime import datetime

from xai_sdk import Client
from xai_sdk.chat import user, assistant, system
from xai_sdk.tools import web_search, x_search, code_execution, chat_pb2

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import httpx

# Import WHOOP API integration
from whoop_api import query_whoop_data


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

    # Mem0 Query Tool
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

    return [whoop_tool, limitless_tool, mem0_tool]


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
        user_id = arguments.get("user_id")

        # TODO: Call actual Mem0 API
        return {
            "query": query,
            "user_id": user_id,
            "message": f"Memory search for: {query}",
            "note": "Placeholder - Mem0 integration pending"
        }

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

        # Add system prompt
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

# Optional import of TimescaleDB client for DB status endpoint
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path('/Users/jamesbrady/wrath-shield-v3/services/eeg-tokenizer')))
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
    return {
        "status": "healthy",
        "service": "agentic-grok",
        "model": orchestrator.model,
        "tools": [
            "web_search",
            "x_search",
            "code_execution",
            "whoop_data_query",
            "limitless_query",
            "memory_search",
        ]
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
