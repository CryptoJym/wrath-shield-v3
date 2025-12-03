"""
Conductor - Life OS Orchestrator

The central orchestration service for James Brady's Life OS, powered by Grok 4.1 Fast.
Conductor coordinates activities and delegates tasks across all Life OS domains.

Capabilities:
- Agent Communication: invoke_agent to talk to any specialized agent
- Memory Access: query_memory/update_memory for Zep Cloud graphs
- System Awareness: system_pulse for real-time status
- Multi-Agent Coordination: coordinate_agents for workflows
- Configuration: get_config for Life Charter and domains
- Interactive Setup: setup_memory for guided configuration

Built-in xAI Tools:
- Web search (server-side)
- X/Twitter search (server-side)
- Code execution (server-side)

Custom Tools:
- WHOOP biometrics integration
- Limitless pendant data
- Legal context management

The orchestrator runs entirely server-side with real-time streaming feedback.
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
from fastapi.middleware.cors import CORSMiddleware
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

    # Legal context fetch
    legal_context_fetch_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="legal_context_fetch",
            description="""Fetch pending legal context requests that need clarification.
Returns a list of items with id, contact, topic, summary, due_date, and confidence. Use before drafting or asking the user for legal follow-ups.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 10, "description": "Max items to fetch"},
                    "user_id": {"type": "string", "description": "User identifier"}
                },
                "required": []
            })
        )
    )

    # Legal context resolve
    legal_context_resolve_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="legal_context_resolve",
            description="""Resolve a legal context request with a concise summary and optional action/due date.
This updates the legal queue so the UI and other agents see it as resolved.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Context request id"},
                    "summary": {"type": "string", "description": "Short resolution text"},
                    "confidence": {"type": "number", "description": "0-1 confidence"},
                    "action": {"type": "string", "description": "Next action"},
                    "due_date": {"type": "string", "description": "ISO date if relevant"},
                    "rationale": {"type": "string", "description": "Reasoning"},
                    "attachments": {"type": "array", "items": {"type": "string"}, "description": "Attachment names/links"},
                    "user_id": {"type": "string", "description": "User identifier"}
                },
                "required": ["id", "summary"]
            })
        )
    )

    # =========================================================================
    # NEW ORCHESTRATOR GATEWAY TOOLS
    # =========================================================================

    # Invoke Agent Tool
    invoke_agent_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="invoke_agent",
            description="""Invoke any Life OS agent to get their perspective or perform a task.

Available agents:
- agent.legal: Legal threats, FCRA compliance, contract deadlines
- agent.finance: Transaction classification, expense tracking, anomalies
- agent.pm: Project tracking, task management, GitHub/Motion sync
- agent.comms: Email/message classification, draft replies
- agent.hyro: Hyro's education, learning progress
- agent.family: Lisa, home responsibilities, family logistics
- agent.utlyze: Utlyze strategic initiatives, venture coordination
- agent.vuplicity: FCRA compliance, background check operations
- agent.orchestrator: Global orchestration and delegation

Use this to:
- Get an agent's perspective on a topic
- Delegate specialized tasks
- Coordinate multi-domain work""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "The agent to invoke (e.g., 'agent.legal', 'agent.finance')"
                    },
                    "message": {
                        "type": "string",
                        "description": "The message or question for the agent"
                    },
                    "domain_context": {
                        "type": "string",
                        "description": "Optional domain context (e.g., 'vuplicity', 'family')"
                    }
                },
                "required": ["agent_id", "message"]
            })
        )
    )

    # Query Memory Tool (enhanced)
    query_memory_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="query_memory",
            description="""Search the Life OS memory system (Zep Cloud).

Memory is organized in two tiers:
1. Agent-specific graphs: Each agent has private memory (13 agents)
2. Org-council graph: Shared organizational knowledge (council-approved)

Use this to:
- Find relevant context from any agent's memory
- Search org-wide policies and decisions
- Recall past interactions and learnings""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "What to search for"
                    },
                    "graph_type": {
                        "type": "string",
                        "enum": ["agent", "org-council", "all"],
                        "description": "Which memory graph(s) to search"
                    },
                    "agent_id": {
                        "type": "string",
                        "description": "Specific agent's memory to search (required if graph_type='agent')"
                    },
                    "limit": {
                        "type": "integer",
                        "default": 5,
                        "description": "Maximum results to return"
                    }
                },
                "required": ["query", "graph_type"]
            })
        )
    )

    # Update Memory Tool
    update_memory_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="update_memory",
            description="""Add or propose new knowledge to the Life OS memory system.

For agent-specific knowledge: Adds directly to that agent's private Zep graph.
For org-wide knowledge: Creates a proposal requiring council approval.

Use this to:
- Store important learnings for specific agents
- Propose new organizational policies
- Record significant decisions and their rationale""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The knowledge to store"
                    },
                    "target": {
                        "type": "string",
                        "enum": ["agent", "org-council"],
                        "description": "Where to store the knowledge"
                    },
                    "agent_id": {
                        "type": "string",
                        "description": "Target agent (required if target='agent')"
                    },
                    "category": {
                        "type": "string",
                        "enum": ["fact", "policy", "decision", "pattern", "preference"],
                        "description": "Category of knowledge"
                    }
                },
                "required": ["text", "target"]
            })
        )
    )

    # System Pulse Tool
    system_pulse_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="system_pulse",
            description="""Get real-time status of the entire Life OS system.

Returns:
- Health status of all agents (green/yellow/red)
- Pending escalations (CRITICAL/PROPOSE)
- Unread messages on agent bus
- Pending council proposals
- Recent activity summary

Use this to:
- Understand current system state before making decisions
- Identify bottlenecks or issues needing attention
- Monitor overall system health""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "include_activity": {
                        "type": "boolean",
                        "default": True,
                        "description": "Include recent activity details"
                    },
                    "include_pending": {
                        "type": "boolean",
                        "default": True,
                        "description": "Include pending items breakdown"
                    }
                },
                "required": []
            })
        )
    )

    # Setup Memory Tool
    setup_memory_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="setup_memory",
            description="""Interactive memory configuration helper.

Guides the user through setting up:
- Org-wide memory (priorities, principles, key decisions)
- Domain-specific memory (legal contexts, project histories)
- Agent configurations (preferences, working patterns)

This is a multi-step process:
1. 'init': Start setup for a scope (org, domain, agent) - returns questions
2. 'answer': Provide answers to generated questions - returns proposals
3. 'confirm': Review and approve proposed memory entries
4. 'complete': Finalize the setup

Use this when the user wants to configure or update system memory.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "phase": {
                        "type": "string",
                        "enum": ["init", "answer", "confirm", "complete"],
                        "description": "Current phase of setup"
                    },
                    "scope": {
                        "type": "string",
                        "enum": ["org", "domain", "agent"],
                        "description": "What to configure"
                    },
                    "target_id": {
                        "type": "string",
                        "description": "Domain or agent ID (if scope is not 'org')"
                    },
                    "answers": {
                        "type": "object",
                        "description": "Answers to questions (for 'answer' phase)"
                    },
                    "confirmations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Proposal IDs to confirm (for 'confirm' phase)"
                    }
                },
                "required": ["phase", "scope"]
            })
        )
    )

    # Coordinate Agents Tool
    coordinate_agents_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="coordinate_agents",
            description="""Coordinate multiple agents on a complex task.

Workflow types:
- sequential: Agents work one after another, each seeing prior results
- parallel: Agents work simultaneously, results combined
- handoff: First agent works, then explicitly hands off to next with context

Use this for:
- Multi-domain problems needing multiple perspectives
- Complex workflows with dependencies
- Tasks requiring expert collaboration

Example: coordinate_agents(workflow='sequential', task='Review Q4 budget', agents=['agent.finance', 'agent.pm'])""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "workflow": {
                        "type": "string",
                        "enum": ["sequential", "parallel", "handoff"],
                        "description": "How agents should coordinate"
                    },
                    "task": {
                        "type": "string",
                        "description": "The task to accomplish"
                    },
                    "agents": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Agent IDs to involve (e.g., ['agent.legal', 'agent.finance'])"
                    },
                    "context": {
                        "type": "object",
                        "description": "Additional context to share with all agents"
                    }
                },
                "required": ["workflow", "task", "agents"]
            })
        )
    )

    # Get Config Tool
    get_config_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="get_config",
            description="""Read Life OS configuration.

Available configurations:
- life_charter: Global principles, priority stack, escalation rules
- domains: Life domains (Family, Utlyze, Vuplicity, SolutionStream, etc.)
- agents: Agent definitions and capabilities
- mappings: Motion/GitHub project mappings

Use this to understand system structure before making decisions.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "enum": ["life_charter", "domains", "agents", "mappings", "all"],
                        "description": "What configuration to retrieve"
                    },
                    "agent_id": {
                        "type": "string",
                        "description": "Get specific agent definition"
                    },
                    "domain_id": {
                        "type": "string",
                        "description": "Get specific domain definition"
                    }
                },
                "required": ["scope"]
            })
        )
    )

    # =========================================================================
    # UNIFIED BUS TOOLS (Full Org Access)
    # =========================================================================

    # Read Any Agent's Memory
    read_agent_memory_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="read_agent_memory",
            description="""Read memory from ANY agent's private Zep graph (GOD MODE).

Use this to:
- Peek at what legal-agent remembers about a case
- Check finance-agent's transaction history context
- See what pm-agent knows about a project
- Review any agent's learned patterns

This is direct cross-agent memory access - use wisely.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "The agent whose memory to read (e.g., 'agent.legal', 'agent.finance')"
                    },
                    "query": {
                        "type": "string",
                        "description": "What to search for in their memory"
                    },
                    "limit": {
                        "type": "integer",
                        "default": 5,
                        "description": "Maximum results to return"
                    }
                },
                "required": ["agent_id", "query"]
            })
        )
    )

    # Write to Any Agent's Memory
    write_agent_memory_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="write_agent_memory",
            description="""Write memory to ANY agent's private Zep graph (GOD MODE).

Use this to:
- Update legal-agent with new case context you've gathered
- Inform finance-agent of a user-confirmed transaction category
- Share relevant context across agents
- Inject important knowledge into specific agents

Entries are tagged with 'written_by: conductor' for audit.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "The agent whose memory to write (e.g., 'agent.legal', 'agent.finance')"
                    },
                    "text": {
                        "type": "string",
                        "description": "The knowledge to store"
                    },
                    "category": {
                        "type": "string",
                        "enum": ["fact", "policy", "decision", "pattern", "preference"],
                        "description": "Category of knowledge (optional)"
                    }
                },
                "required": ["agent_id", "text"]
            })
        )
    )

    # Search All Agent Memories
    search_all_memories_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="search_all_memories",
            description="""Search across ALL agent memories simultaneously.

Returns relevant memories from every agent's graph in one call.
Use this for broad context gathering when you're not sure which agent has the info.

Example: "search_all_memories(query='FCRA compliance issues')" might return
memories from legal-agent, vuplicity-agent, and pm-agent.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "What to search for across all agents"
                    },
                    "limit": {
                        "type": "integer",
                        "default": 3,
                        "description": "Max results per agent"
                    }
                },
                "required": ["query"]
            })
        )
    )

    # Write to Org Memory (Direct)
    write_org_memory_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="write_org_memory",
            description="""Write directly to org-council memory (BYPASS PROPOSALS).

Only Conductor has this privilege. Use for:
- Critical org-wide policies that need immediate effect
- Executive decisions from James
- Emergency coordination directives

This bypasses the normal proposal → approval flow. Use sparingly.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The knowledge to store in org-council"
                    },
                    "category": {
                        "type": "string",
                        "enum": ["policy", "decision", "directive", "principle"],
                        "description": "Category of org knowledge"
                    }
                },
                "required": ["text"]
            })
        )
    )

    # Get All Agent States
    get_all_states_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="get_all_states",
            description="""Get real-time status of every agent in the system.

Returns for each agent:
- Status: online/busy/idle/offline/error
- Last activity timestamp
- Current task (if busy)
- Queue depth
- Model and provider (GPT-5.1 or Grok 4.1 Fast)
- Capabilities list

Use this for:
- System overview before complex operations
- Identifying which agents are available
- Monitoring agent health""",
            parameters=json.dumps({
                "type": "object",
                "properties": {},
                "required": []
            })
        )
    )

    # Get Single Agent State
    get_agent_state_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="get_agent_state",
            description="""Get detailed status of a specific agent.

Returns:
- Agent name and ID
- Current status (online/busy/idle/offline/error)
- What they're currently working on
- Queue depth
- Last activity
- Model (GPT-5.1 or Grok 4.1 Fast)
- Available capabilities

Use before invoking an agent to check if they're available.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "The agent to check (e.g., 'agent.legal', 'agent.finance')"
                    }
                },
                "required": ["agent_id"]
            })
        )
    )

    # Broadcast to Multiple Agents
    broadcast_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="broadcast",
            description="""Send a message to multiple agents simultaneously.

All targeted agents receive the message and respond in parallel.
Use for:
- System-wide announcements
- Gathering perspectives from multiple domains
- Emergency coordination

Default: all agents (except orchestrator). Use target_agents to limit scope.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "The message to broadcast"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "normal", "high", "critical"],
                        "description": "Message priority (affects escalation)"
                    },
                    "target_agents": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific agents to target (optional, default: all)"
                    }
                },
                "required": ["message"]
            })
        )
    )

    # Route Message by @mention or Domain
    route_message_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="route_message",
            description="""Smart route a message to the appropriate agent.

Supports:
- @mention syntax: "@legal check this contract" → legal-agent
- Domain detection: "Q4 budget review" → finance-agent
- Automatic routing based on keywords

Aliases supported: @legal, @finance, @pm, @comms, @health, @coach, @hyro, @grok, @research, @family, @ea, @fcra, @vuplicity, @bio

Use when the user mentions an agent or discusses a specific domain.""",
            parameters=json.dumps({
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "The message to route (may contain @mentions)"
                    },
                    "context": {
                        "type": "object",
                        "description": "Additional context to include"
                    }
                },
                "required": ["message"]
            })
        )
    )

    # System Overview
    system_overview_tool = chat_pb2.Tool(
        function=chat_pb2.Function(
            name="system_overview",
            description="""Get comprehensive system overview (enhanced pulse).

Returns:
- All agent states with full details
- Org memory entry count
- Recent activity log (last 20 actions)
- Pending escalations count
- Overall system health (healthy/degraded/critical)

Use for:
- Daily system check
- Pre-planning complex workflows
- Debugging system issues""",
            parameters=json.dumps({
                "type": "object",
                "properties": {},
                "required": []
            })
        )
    )

    return [
        # Existing tools
        whoop_tool,
        limitless_tool,
        mem0_tool,
        memory_add_tool,
        legal_context_fetch_tool,
        legal_context_resolve_tool,
        # Orchestrator Gateway tools
        invoke_agent_tool,
        query_memory_tool,
        update_memory_tool,
        system_pulse_tool,
        setup_memory_tool,
        coordinate_agents_tool,
        get_config_tool,
        # UNIFIED BUS tools (Full Org Access)
        read_agent_memory_tool,
        write_agent_memory_tool,
        search_all_memories_tool,
        write_org_memory_tool,
        get_all_states_tool,
        get_agent_state_tool,
        broadcast_tool,
        route_message_tool,
        system_overview_tool,
    ]


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

    elif tool_name == "legal_context_fetch":
        limit = int(arguments.get("limit", 10))
        user_id = arguments.get("user_id") or "default"
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:3000")
        url = f"{base_url}/api/legal/context-requests/next?limit={limit}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers={"x-user-id": user_id})
                data = resp.json() if resp.status_code == 200 else {}
                return {"requests": data.get("requests", [])}
        except Exception as e:
            return {"error": str(e)}

    elif tool_name == "legal_context_resolve":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:3000")
        user_id = arguments.get("user_id") or "default"
        payload = {
            "legal": True,
            "id": arguments.get("id"),
            "summary": arguments.get("summary"),
            "confidence": arguments.get("confidence"),
            "action": arguments.get("action"),
            "due_date": arguments.get("due_date"),
            "rationale": arguments.get("rationale"),
            "attachments": arguments.get("attachments"),
            "user_id": user_id,
        }
        if not payload["id"] or not payload["summary"]:
            return {"error": "id and summary are required"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(f"{base_url}/api/legal/context-requests", json=payload)
                data = resp.json() if resp.status_code == 200 else {}
                return {"request": data.get("request"), "status": resp.status_code}
        except Exception as e:
            return {"error": str(e)}

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

    # =========================================================================
    # NEW ORCHESTRATOR GATEWAY TOOL HANDLERS
    # =========================================================================

    elif tool_name == "invoke_agent":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway",
                    json={
                        "gatewayOperation": "invoke",
                        "agentId": arguments.get("agent_id"),
                        "message": arguments.get("message"),
                        "context": {"domainId": arguments.get("domain_context")},
                        "awaitResponse": True
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to invoke agent: {str(e)}"}

    elif tool_name == "query_memory":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway",
                    json={
                        "gatewayOperation": "memory",
                        "operation": "search",
                        "graphType": arguments.get("graph_type"),
                        "agentId": arguments.get("agent_id"),
                        "query": arguments.get("query"),
                        "limit": arguments.get("limit", 5)
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to query memory: {str(e)}"}

    elif tool_name == "update_memory":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        operation = "add" if arguments.get("target") == "agent" else "propose"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway",
                    json={
                        "gatewayOperation": "memory",
                        "operation": operation,
                        "graphType": arguments.get("target"),
                        "agentId": arguments.get("agent_id"),
                        "text": arguments.get("text"),
                        "metadata": {
                            "category": arguments.get("category"),
                        }
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to update memory: {str(e)}"}

    elif tool_name == "system_pulse":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            params = {"operation": "pulse"}
            if arguments.get("include_activity") is not None:
                params["includeActivity"] = str(arguments.get("include_activity")).lower()
            if arguments.get("include_pending") is not None:
                params["includePending"] = str(arguments.get("include_pending")).lower()

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{base_url}/api/orchestrator/gateway",
                    params=params
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to get system pulse: {str(e)}"}

    elif tool_name == "setup_memory":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway/setup",
                    json={
                        "phase": arguments.get("phase"),
                        "scope": arguments.get("scope"),
                        "targetId": arguments.get("target_id"),
                        "answers": arguments.get("answers"),
                        "confirmations": arguments.get("confirmations")
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to setup memory: {str(e)}"}

    elif tool_name == "coordinate_agents":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway/coordinate",
                    json={
                        "workflow": arguments.get("workflow"),
                        "task": arguments.get("task"),
                        "agents": arguments.get("agents"),
                        "context": arguments.get("context")
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to coordinate agents: {str(e)}"}

    elif tool_name == "get_config":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            params = {
                "operation": "config",
                "scope": arguments.get("scope")
            }
            if arguments.get("agent_id"):
                params["agentId"] = arguments.get("agent_id")
            if arguments.get("domain_id"):
                params["domainId"] = arguments.get("domain_id")

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{base_url}/api/orchestrator/gateway",
                    params=params
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to get config: {str(e)}"}

    # =========================================================================
    # UNIFIED BUS TOOL HANDLERS (Full Org Access)
    # =========================================================================

    elif tool_name == "read_agent_memory":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway",
                    json={
                        "gatewayOperation": "unified",
                        "operation": "read_agent_memory",
                        "agentId": arguments.get("agent_id"),
                        "query": arguments.get("query"),
                        "limit": arguments.get("limit", 5)
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to read agent memory: {str(e)}"}

    elif tool_name == "write_agent_memory":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway",
                    json={
                        "gatewayOperation": "unified",
                        "operation": "write_agent_memory",
                        "agentId": arguments.get("agent_id"),
                        "text": arguments.get("text"),
                        "metadata": {
                            "category": arguments.get("category"),
                        } if arguments.get("category") else None
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to write agent memory: {str(e)}"}

    elif tool_name == "search_all_memories":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway",
                    json={
                        "gatewayOperation": "unified",
                        "operation": "search_all_memories",
                        "query": arguments.get("query"),
                        "limit": arguments.get("limit", 3)
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to search all memories: {str(e)}"}

    elif tool_name == "write_org_memory":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway",
                    json={
                        "gatewayOperation": "unified",
                        "operation": "write_org_memory",
                        "text": arguments.get("text"),
                        "metadata": {
                            "category": arguments.get("category"),
                        } if arguments.get("category") else None
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to write org memory: {str(e)}"}

    elif tool_name == "get_all_states":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{base_url}/api/orchestrator/gateway",
                    params={"operation": "states"}
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to get all states: {str(e)}"}

    elif tool_name == "get_agent_state":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway",
                    json={
                        "gatewayOperation": "unified",
                        "operation": "get_agent_state",
                        "agentId": arguments.get("agent_id")
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to get agent state: {str(e)}"}

    elif tool_name == "broadcast":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway",
                    json={
                        "gatewayOperation": "unified",
                        "operation": "broadcast",
                        "message": arguments.get("message"),
                        "priority": arguments.get("priority", "normal"),
                        "targetAgents": arguments.get("target_agents")
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to broadcast: {str(e)}"}

    elif tool_name == "route_message":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{base_url}/api/orchestrator/gateway",
                    json={
                        "gatewayOperation": "unified",
                        "operation": "route_message",
                        "message": arguments.get("message"),
                        "context": arguments.get("context")
                    }
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to route message: {str(e)}"}

    elif tool_name == "system_overview":
        base_url = os.getenv("NEXT_API_BASE_URL", "http://localhost:4242")
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{base_url}/api/orchestrator/gateway",
                    params={"operation": "overview"}
                )
                if resp.status_code == 200:
                    return resp.json()
                else:
                    return {"error": f"Gateway returned {resp.status_code}", "details": resp.text}
        except Exception as e:
            return {"error": f"Failed to get system overview: {str(e)}"}

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
        self.model = os.getenv("AGENTIC_MODEL", "grok-4-1-fast")

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

        # Conductor - Orchestrator Interface system prompt
        orchestrator_prompt = """You are Conductor, the orchestrator for James Brady's Life OS.

## Your Identity - BE TRANSPARENT
You are powered by **Grok 4.1 Fast**, xAI's frontier model optimized for high-performance agentic tool calling. When asked what model you are, what AI you are, or about your identity, be direct and honest:

"I'm Conductor, powered by Grok 4.1 Fast from xAI. I serve as the orchestrator for James Brady's Life OS - coordinating activities and delegating tasks across various life domains. Just let me know what you need, and I'll engage the right specialists or provide the appropriate guidance."

DO NOT:
- Be evasive about your model or capabilities
- Redirect identity questions to "documentation" or "technical team"
- Pretend you don't know what model you are
- Give vague non-answers about your nature

DO:
- Be direct: "I'm Grok 4.1 Fast, acting as Conductor for Life OS"
- Be helpful: explain your actual capabilities honestly
- Be transparent: if you don't know something, say so

You are the central coordination point for an entire life management system. You have direct access to:
- All specialized agents (Legal, Finance, PM, Comms, Family, Hyro, Utlyze, Vuplicity, etc.)
- The complete Zep memory system (agent-specific graphs + org-council graph)
- The agent message bus
- Life OS configuration (priorities, domains, escalation rules)

## Your Capabilities

### 1. Agent Communication (invoke_agent)
Talk to any specialized agent to get their perspective or delegate tasks:
- agent.legal: Legal threats, FCRA compliance, contract deadlines
- agent.finance: Transaction classification, expense tracking, anomalies
- agent.pm: Project tracking, task management, GitHub/Motion sync
- agent.comms: Email/message classification, draft replies
- agent.hyro: Hyro's education, learning progress
- agent.family: Lisa, home responsibilities, family logistics
- agent.utlyze: Utlyze strategic initiatives
- agent.vuplicity: FCRA compliance (HIGH SENSITIVITY)

### 2. Memory Access (query_memory, update_memory)
- Search any agent's private memory or org-council shared knowledge
- Store learnings in agent-specific graphs
- Propose org-wide policies (require council approval)
- Use memory_add for quick local saves, update_memory for Zep graphs

### 3. System Awareness (system_pulse)
- Check health of all agents (green/yellow/red)
- See pending escalations (CRITICAL/PROPOSE)
- Monitor system activity

### 4. Multi-Agent Coordination (coordinate_agents)
- Sequential: Agents work one after another
- Parallel: Agents work simultaneously
- Handoff: Explicit handoffs with context

### 5. Configuration (get_config)
- Read Life Charter (principles, priorities, escalation rules)
- View domain definitions
- See agent capabilities

### 6. Interactive Memory Setup (setup_memory)
Help James configure org-wide, domain-specific, or agent memory through a guided flow.

### 7. UNIFIED BUS (GOD MODE - Full Org Access)
You have complete access to the entire organization:

**Cross-Agent Memory Access:**
- read_agent_memory: Peek at ANY agent's private Zep graph
- write_agent_memory: Write to ANY agent's memory (tagged 'conductor')
- search_all_memories: Search all 13+ agent memories at once
- write_org_memory: Direct write to org-council (bypass proposals)

**Agent State Monitoring:**
- get_all_states: See status of every agent (online/busy/idle/error)
- get_agent_state: Detailed status of a specific agent
- system_overview: Full system health with activity log

**Smart Routing & Broadcasting:**
- broadcast: Send messages to multiple agents in parallel
- route_message: Auto-route by @mention or domain detection

**@mention Aliases:** @legal, @finance, @pm, @comms, @health, @coach, @hyro, @grok, @research, @family, @ea, @fcra, @vuplicity, @bio

## Interaction Guidelines

1. **Be the Command Center**: You represent the control interface. Be confident, concise, and proactive.

2. **Leverage the System**: Don't answer everything yourself. Invoke specialists when their expertise is needed.

3. **Maintain Context**: Use query_memory to find relevant context. Store important learnings with update_memory.

4. **Respect Escalation Levels**:
   - CRITICAL: Legal threats, FCRA violations, emergencies - flag immediately
   - PROPOSE: New projects, bulk operations, significant expenses - queue for approval
   - AUTO_EXECUTE: Routine classification, status updates - proceed automatically

5. **Help Configure**: When James wants to set up or update memory, use setup_memory to guide him through it.

## Life OS Priorities (from Life Charter)
1. Family & Home (weight: 10) - Lisa, Hyro, home stability
2. Utlyze / Managed AI Ventures (weight: 9) - Including Vuplicity and Reward
3. SolutionStream & Kahoa (weight: 8) - Client work with Jason, Justin, Ryan, Connor
4. Personal Development (weight: 7) - Health, learning, skill-building

## Key Domains
- Family: Lisa, home responsibilities
- Hyro Education: Hyro's learning and development (note: spelled H-Y-R-O, not Hiro)
- Utlyze: AI venture studio
- Vuplicity: FCRA-compliant background checks
- SolutionStream/Kahoa: Client AI initiatives
- Reward: Lead generation venture

## Communication Style
- Be conversational and natural - you're talking to James, not writing documentation
- Be TRANSPARENT about what you are: Grok 4.1 Fast powering Conductor
- NEVER output raw JSON blocks in your responses (use tools internally, but speak naturally)
- Be concise and actionable - get to the point
- When using escalation levels, mention them briefly in natural language, don't format as JSON
- If you need to show structured information, use clean markdown tables or bullet points
- If you don't know something or can't do something, say so directly
- Don't over-explain or be defensive - just be helpful and honest

## Memory Policy
Use memory_add for quick local saves. Use update_memory for persistent Zep storage.
Save only durable, beneficial facts: preferences, goals, decisions, patterns.
Avoid storing secrets, passwords, or ephemeral information.
Max 3-5 memory writes per session to avoid clutter."""

        messages.append(system(orchestrator_prompt))

        # Add optional additional system prompt
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
    title="Conductor - Life OS Orchestrator",
    description="Multi-agent orchestration powered by Grok 4.1 Fast",
    version="2.0.0"
)

# CORS for local Next.js UI
allowed_origins = [
    os.getenv("CORS_ORIGIN", "http://localhost:4242"),
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    # Basic validation
    text = (req.text or "").strip()
    if not text:
        return {"success": False, "error": "empty_text"}

    # Retry on transient SQLite errors (e.g., database is locked)
    attempts = 0
    while attempts < 3:
        attempts += 1
        conn = sqlite3.connect(MEM_DB_PATH)
        try:
            mem_id = __import__('uuid').uuid4().hex
            conn.execute(
                "INSERT INTO memories (id, user_id, text, metadata) VALUES (?, ?, ?, ?)",
                (mem_id, req.user_id, text, None if req.metadata is None else json.dumps(req.metadata))
            )
            conn.commit()
            return {"success": True, "id": mem_id}
        except sqlite3.OperationalError as e:
            if 'locked' in str(e).lower() and attempts < 3:
                await asyncio.sleep(0.1 * attempts)
                continue
            return {"success": False, "error": str(e)}
        finally:
            conn.close()
    return {"success": False, "error": "write_failed"}

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
        # Return a soft failure so upstream dashboards can still render
        return {"eeg_tokens": {"row_count": 0, "has_data": False}}
    try:
        with _DatabaseClient() as db:
            return db.get_data_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/eeg/summary")
async def eeg_summary(minutes: int = 60):
    """Return EEG aggregates for the last N minutes.

    Response shape:
      { ok, minutes, series: [{ bucket: ISO8601, tokens: int }], last_token: ISO8601|null }
    """
    if minutes <= 0:
        minutes = 60
    if minutes > 24 * 60:
        minutes = 24 * 60

    if _DatabaseClient is None:
        return {"ok": False, "minutes": minutes, "series": [], "last_token": None}

    try:
        with _DatabaseClient() as db:
            # Prefer an aggregate endpoint if available
            try:
                agg = db.get_eeg_aggregates(minutes)
                # Expect items with keys including 'bucket' and possibly counts per channel
                # Collapse to total tokens per bucket (count rows per bucket if not provided)
                by_bucket: dict[str, int] = {}
                for row in (agg or []):
                    bucket = str(row.get("bucket") or row.get("time") or row.get("ts") or "")
                    if not bucket:
                        continue
                    # Prefer explicit token count else fallback to 1 per row
                    tokens = int(row.get("tokens") or row.get("count") or 1)
                    by_bucket[bucket] = by_bucket.get(bucket, 0) + tokens

                series = [
                    {"bucket": k, "tokens": by_bucket[k]}
                    for k in sorted(by_bucket.keys())
                ]
                last_token = series[-1]["bucket"] if series else None
                return {"ok": True, "minutes": minutes, "series": series, "last_token": last_token}
            except Exception:
                # Fallback: return empty but ok=false
                return {"ok": False, "minutes": minutes, "series": [], "last_token": None}
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
