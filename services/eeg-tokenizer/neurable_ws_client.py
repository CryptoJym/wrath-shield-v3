"""
Neurable WebSocket Live Stream Client (Mac-friendly)

Connects to a Neurable-style WebSocket endpoint, ingests 256 Hz × 12-channel
EEG samples, runs the online tokenization pipeline, and writes tokens to
TimescaleDB using DatabaseClient.

Expected message formats (JSON):
1) Sample-per-message:
   {"timestamp": 1731250020.123, "channels": [c0, c1, ..., c11]}

2) Batch-per-message:
   {"timestamp": 1731250020.000, "samples": [[c0..c11], [c0..c11], ...]}

Environment Variables:
  NEURABLE_WS_URL   e.g. ws://localhost:8765/neurable
  TIMESCALE_URL     PostgreSQL/Timescale connection string

CLI:
  python neurable_ws_client.py --url ws://localhost:8765/neurable --session-id LIVE

WS stands for WebSocket.
"""

import asyncio
import json
import os
import signal
import sys
from datetime import datetime, timezone
from typing import Optional, List

import numpy as np
import websockets

from tokenization_pipeline import OnlineTokenizer, TokenizationConfig
from db_client import DatabaseClient


class GracefulExit(Exception):
    pass


def _utcnow():
    return datetime.now(timezone.utc)


async def stream_neurable(
    url: str,
    session_id: str = "LIVE",
    sampling_rate: int = 256,
    n_channels: int = 12,
    window_size: int = 256,
    overlap: int = 128,
    verbose: bool = True,
):
    cfg = TokenizationConfig(n_channels=n_channels, sampling_rate=sampling_rate)
    tokenizer = OnlineTokenizer(config=cfg, window_size=window_size, overlap=overlap)
    tokenizer.start_session(session_id)

    with DatabaseClient() as db:
        async with websockets.connect(url) as ws:
            if verbose:
                print(f"✅ Connected to Neurable WS: {url}")

            async for msg in ws:
                try:
                    data = json.loads(msg)
                except Exception:
                    continue

                # Determine payload type
                if isinstance(data, dict) and "samples" in data:
                    samples: List[List[float]] = data["samples"]
                    for s in samples:
                        if len(s) != n_channels:
                            continue
                        out = tokenizer.process_sample(np.asarray(s, dtype=float))
                        if out is not None:
                            await _persist_window(db, out)

                elif isinstance(data, dict) and "channels" in data:
                    sample = data["channels"]
                    if isinstance(sample, list) and len(sample) == n_channels:
                        out = tokenizer.process_sample(np.asarray(sample, dtype=float))
                        if out is not None:
                            await _persist_window(db, out)

                # else ignore


async def _persist_window(db: DatabaseClient, out):
    """
    Persist one completed 1-second window of tokens.
    Writes one row per channel to match schema (tokens duplicated per channel).
    """
    ts = _utcnow()

    # Extract tokens (3 levels), as Python ints
    # Each element is a tensor of shape [1] or [1,1]
    try:
        l1 = int(out.discrete_tokens[0].view(-1)[0].item())
        l2 = int(out.discrete_tokens[1].view(-1)[0].item())
        l3 = int(out.discrete_tokens[2].view(-1)[0].item())
    except Exception:
        # Fallback if unexpected shape
        l1 = l2 = l3 = 0

    pe_t = float(getattr(out.pe_t, "item", lambda: out.pe_t)()) if hasattr(out, "pe_t") else 0.0
    mean_se = float(out.metadata.get("mean_se", 0.0)) if getattr(out, "metadata", None) else 0.0
    gate_weight = float(out.metadata.get("se_gate", 0.0)) if getattr(out, "metadata", None) else 0.0

    # Batch build values (duplicate tokens across channels to fit schema)
    rows = []
    for ch in range(12):
        rows.append((ts, ch, l1, l2, l3, pe_t, mean_se, gate_weight, json.dumps(out.metadata)))

    # Use batch insert for efficiency
    db.insert_eeg_tokens_batch(rows)


def _install_signal_handlers(loop):
    def _handler(sig, frame):
        raise GracefulExit()

    for s in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(s, _handler)
        except Exception:
            pass


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Neurable WebSocket Live Stream Client")
    parser.add_argument("--url", default=os.getenv("NEURABLE_WS_URL", "ws://localhost:8765/neurable"))
    parser.add_argument("--session-id", default="LIVE")
    parser.add_argument("--window-size", type=int, default=256)
    parser.add_argument("--overlap", type=int, default=128)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    _install_signal_handlers(loop)

    try:
        loop.run_until_complete(
            stream_neurable(
                url=args.url,
                session_id=args.session_id,
                window_size=args.window_size,
                overlap=args.overlap,
                verbose=args.verbose,
            )
        )
    except GracefulExit:
        print("\n🛑 Stopping Neurable WS client")
    finally:
        try:
            loop.run_until_complete(asyncio.sleep(0.05))
        except Exception:
            pass
        loop.close()


if __name__ == "__main__":
    main()

