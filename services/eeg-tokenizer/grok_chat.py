"""
Grok 4 Fast Chat Integration for EEG Tokenization System

Provides context-aware chat responses based on current brain state.
Uses xAI's Grok API with OpenAI-compatible client.
"""

import os
import re
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import httpx
from openai import OpenAI
from db_client import DatabaseClient


class GrokChatClient:
    """
    Client for Grok 4 Fast chat with brain state context.
    """

    def __init__(self, api_key: Optional[str] = None, db_client: Optional[DatabaseClient] = None, agent_url: Optional[str] = None):
        """
        Initialize Grok chat client.

        Args:
            api_key: xAI API key (or from XAI_API_KEY env var)
            db_client: DatabaseClient instance for brain state context
        """
        # Local Agentic Grok (FastAPI) override — preferred if provided
        self.agent_url = agent_url or os.getenv('AGENTIC_GROK_URL')

        self.api_key = api_key or os.getenv('XAI_API_KEY')
        self.client = None
        if not self.agent_url:
            # Fallback to direct xAI API if local agent not configured
            if not self.api_key:
                raise ValueError("XAI_API_KEY not found. Set environment variable or pass api_key parameter.")
            self.client = OpenAI(
                api_key=self.api_key,
                base_url="https://api.x.ai/v1"
            )

        self.db_client = db_client
        self.model = "grok-4-latest"  # Grok 4 Fast (latest model)

        # System prompt for brain-context awareness
        self.system_prompt = """You are an AI assistant integrated with an EEG tokenization system that monitors the user's brain activity in real-time.

You have access to the following brain state metrics:
- PE_t (Prediction Error): Measures cognitive load and attention. Higher values indicate increased mental effort or surprise.
- SE (Spectral Exponent): Relates to neural noise and consciousness. Values typically range from -2 to 0.
- Gate Weight: Derived from SE, filters unconscious 1/f noise. Values range from 0 to 1.
- Dominant Tokens: Most frequent neural patterns across 3 hierarchical levels (L1, L2, L3).

You can answer questions about both current and historical brain states. Historical queries are supported for any past time (e.g., "What was my focus at 2pm yesterday?" or "How was my concentration 30 minutes ago?").

When answering questions about brain state, focus, or cognitive performance:
1. Reference the specific metrics provided in the context
2. Explain changes in accessible terms
3. Provide actionable insights when possible
4. Be concise and avoid speculation beyond the data
5. For historical queries, note the time range being analyzed

If the user asks about general topics unrelated to brain state, answer normally without forcing brain-state references."""

    def parse_temporal_reference(self, query: str) -> Optional[Tuple[datetime, datetime]]:
        """
        Parse temporal references from user query.

        Args:
            query: User's query text

        Returns:
            Tuple of (start_time, end_time) if temporal reference found, else None
        """
        now = datetime.now()
        query_lower = query.lower()

        # Pattern: "X minutes/hours ago"
        match = re.search(r'(\d+)\s+(minute|hour)s?\s+ago', query_lower)
        if match:
            value = int(match.group(1))
            unit = match.group(2)
            if unit == 'minute':
                end_time = now - timedelta(minutes=value)
            else:  # hour
                end_time = now - timedelta(hours=value)
            start_time = end_time - timedelta(seconds=10)
            return (start_time, end_time)

        # Pattern: "yesterday at X:XX" or "yesterday"
        if 'yesterday' in query_lower:
            yesterday = now - timedelta(days=1)
            # Try to extract time
            time_match = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm)?', query_lower)
            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2))
                period = time_match.group(3)
                if period == 'pm' and hour < 12:
                    hour += 12
                elif period == 'am' and hour == 12:
                    hour = 0
                target_time = yesterday.replace(hour=hour, minute=minute, second=0, microsecond=0)
            else:
                # Default to same time yesterday
                target_time = yesterday
            return (target_time - timedelta(seconds=10), target_time)

        # Pattern: "at X:XX" (today)
        time_match = re.search(r'at\s+(\d{1,2}):(\d{2})\s*(am|pm)?', query_lower)
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2))
            period = time_match.group(3)
            if period == 'pm' and hour < 12:
                hour += 12
            elif period == 'am' and hour == 12:
                hour = 0
            target_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            # If time is in future, assume they mean yesterday
            if target_time > now:
                target_time -= timedelta(days=1)
            return (target_time - timedelta(seconds=10), target_time)

        return None

    def get_brain_context(self, user_message: str = "", window_seconds: int = 10) -> str:
        """
        Get brain state context as formatted string (current or historical).

        Args:
            user_message: User's message (for temporal parsing)
            window_seconds: Time window for brain state query (default: 10)

        Returns:
            Formatted brain state context string
        """
        if not self.db_client:
            return "No brain state data available (database not connected)."

        try:
            # Check for temporal references
            temporal_ref = self.parse_temporal_reference(user_message) if user_message else None

            if temporal_ref:
                # Historical query
                start_time, end_time = temporal_ref
                brain_state = self.db_client.get_historical_brain_state(
                    start_time=start_time,
                    end_time=end_time
                )

                if brain_state['sample_count'] == 0:
                    return f"No brain state data found for {start_time.strftime('%Y-%m-%d %H:%M:%S')} to {end_time.strftime('%H:%M:%S')}."

                context = f"""Historical brain state ({start_time.strftime('%Y-%m-%d %H:%M:%S')} to {end_time.strftime('%H:%M:%S')}):
- Average PE_t: {brain_state['avg_pe_t']:.3f}""" + (f" (±{brain_state['stddev_pe_t']:.3f})" if brain_state['stddev_pe_t'] else "") + f"""
- Average SE: {brain_state['avg_se']:.3f}
- Gate Weight: {brain_state['avg_gate_weight']:.3f}
- Dominant Tokens: L1={brain_state['dominant_tokens'][0]}, L2={brain_state['dominant_tokens'][1]}, L3={brain_state['dominant_tokens'][2]}
- Samples: {brain_state['sample_count']}"""

            else:
                # Current query
                brain_state = self.db_client.get_brain_state()

                if brain_state['avg_pe_t'] is None:
                    return f"No brain state data in last {window_seconds} seconds."

                context = f"""Current brain state (last {window_seconds} seconds):
- Average PE_t: {brain_state['avg_pe_t']:.3f} (±{brain_state['stddev_pe_t']:.3f})
- Average SE: {brain_state['avg_se']:.3f}
- Gate Weight: {brain_state['avg_gate_weight']:.3f}
- Dominant Tokens: L1={brain_state['dominant_tokens'][0]}, L2={brain_state['dominant_tokens'][1]}, L3={brain_state['dominant_tokens'][2]}"""

            return context

        except Exception as e:
            return f"Error fetching brain state: {e}"

    def chat(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        include_brain_context: bool = True,
        temperature: float = 0.7,
        max_tokens: int = 500
    ) -> str:
        """
        Send a chat message to Grok 4 Fast with optional brain state context.

        Args:
            user_message: User's chat message
            conversation_history: Previous messages [{"role": "user"|"assistant", "content": "..."}]
            include_brain_context: Whether to inject brain state context
            temperature: Sampling temperature (0.0 to 1.0)
            max_tokens: Maximum response length

        Returns:
            Assistant's response text
        """
        # If using local Agentic Grok service, delegate request
        if self.agent_url:
            try:
                payload = {
                    "query": user_message,
                    "conversation_history": conversation_history or []
                }
                r = httpx.post(
                    f"{self.agent_url}/api/agentic/chat",
                    json=payload,
                    timeout=30
                )
                r.raise_for_status()
                data = r.json()
                return data.get("content", "")
            except Exception as e:
                return f"⚠️ Agentic Grok error: {e}"

        # Build messages array for direct xAI API
        messages = [{"role": "system", "content": self.system_prompt}]

        # Add conversation history
        if conversation_history:
            messages.extend(conversation_history)

        # Inject brain state context if requested
        if include_brain_context:
            brain_context = self.get_brain_context(user_message=user_message)
            # Add as system message right before user query
            messages.append({
                "role": "system",
                "content": f"[BRAIN STATE CONTEXT]\n{brain_context}"
            })

        # Add user message
        messages.append({"role": "user", "content": user_message})

        try:
            # Call Grok API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=False
            )

            # Extract response text
            assistant_message = response.choices[0].message.content
            return assistant_message

        except Exception as e:
            return f"⚠️ Grok API error: {e}"

    def chat_stream(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        include_brain_context: bool = True,
        temperature: float = 0.7,
        max_tokens: int = 500
    ):
        """
        Stream chat response from Grok 4 Fast (for real-time typing effect).

        Args:
            user_message: User's chat message
            conversation_history: Previous messages
            include_brain_context: Whether to inject brain state context
            temperature: Sampling temperature
            max_tokens: Maximum response length

        Yields:
            Text chunks as they arrive
        """
        # If using local Agentic Grok service, stream SSE and yield content chunks
        if self.agent_url:
            try:
                payload = {
                    "query": user_message,
                    "conversation_history": conversation_history or []
                }
                with httpx.Client(timeout=None) as client:
                    with client.stream("POST", f"{self.agent_url}/api/agentic/chat/stream", json=payload) as resp:
                        resp.raise_for_status()
                        for line in resp.iter_lines():
                            if not line:
                                continue
                            if isinstance(line, bytes):
                                line = line.decode('utf-8', errors='ignore')
                            if line.startswith('data: '):
                                try:
                                    evt = json.loads(line[6:])
                                    if evt.get('type') == 'content' and 'text' in evt:
                                        yield evt['text']
                                except Exception:
                                    continue
            except Exception as e:
                yield f"⚠️ Agentic Grok stream error: {e}"
            return

        # Build messages array (same as chat()) for direct xAI API
        messages = [{"role": "system", "content": self.system_prompt}]

        if conversation_history:
            messages.extend(conversation_history)

        if include_brain_context:
            brain_context = self.get_brain_context(user_message=user_message)
            messages.append({
                "role": "system",
                "content": f"[BRAIN STATE CONTEXT]\n{brain_context}"
            })

        messages.append({"role": "user", "content": user_message})

        try:
            # Call Grok API with streaming
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )

            # Yield chunks as they arrive
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            yield f"⚠️ Grok API error: {e}"

    def store_conversation(
        self,
        user_message: str,
        assistant_response: str,
        token_window_start: Optional[datetime] = None
    ):
        """
        Store conversation in database for historical analysis.

        Args:
            user_message: User's message
            assistant_response: Assistant's response
            token_window_start: EEG token window timestamp (defaults to 10s ago)
        """
        if not self.db_client:
            return

        timestamp = datetime.now()

        # Default token window: 10 seconds before message
        if token_window_start is None:
            token_window_start = timestamp - timedelta(seconds=10)

        # Store user message
        self.db_client.insert_chat_log(
            timestamp=timestamp,
            role='user',
            content=user_message,
            token_window_start=token_window_start
        )

        # Store assistant response
        self.db_client.insert_chat_log(
            timestamp=timestamp,
            role='assistant',
            content=assistant_response,
            token_window_start=token_window_start
        )


# Convenience function for quick testing
def test_grok_chat():
    """Test Grok chat integration with database connection."""
    print("=" * 60)
    print("Grok 4 Fast Chat Integration Test")
    print("=" * 60)

    try:
        # Connect to database
        with DatabaseClient() as db:
            # Initialize Grok client
            grok = GrokChatClient(db_client=db)

            # Test chat
            print("\n💬 Testing chat with brain state context...")
            response = grok.chat(
                user_message="How is my focus right now?",
                include_brain_context=True
            )

            print(f"\n🤖 Response:\n{response}\n")

            # Store conversation
            grok.store_conversation(
                user_message="How is my focus right now?",
                assistant_response=response
            )

            print("✅ Conversation stored in database")

    except Exception as e:
        print(f"❌ Test failed: {e}")


if __name__ == "__main__":
    test_grok_chat()
