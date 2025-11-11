"""
Streamlit Dashboard for EEG Tokenization System

Real-time visualization of:
- EEG signals (12 channels)
- Token stream with equation breakdown
- Multi-modal timeline (EEG + Whoop + Limitless + chat)
- Grok 4 chat interface with brain context
"""

import streamlit as st
import numpy as np
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Ensure local modules (tokenization_pipeline, db_client, grok_chat) are importable
_BASE_DIR = Path(__file__).resolve().parent
if str(_BASE_DIR) not in sys.path:
    sys.path.insert(0, str(_BASE_DIR))

# Import tokenization pipeline
from db_client import DatabaseClient
from grok_chat import GrokChatClient
import httpx

# Page config
st.set_page_config(
    page_title="EEG Tokenization Dashboard",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize database connection
@st.cache_resource
def get_db_client():
    """Get cached database client."""
    try:
        db = DatabaseClient()
        return db, True
    except Exception as e:
        st.error(f"Database connection failed: {e}")
        return None, False

db_client, db_connected = get_db_client()

@st.cache_resource
def get_grok_client():
    """Get cached Grok chat client (prefer local Agentic service to avoid proxy issues)."""
    try:
        # Prefer local Agentic Grok if reachable
        agent_url = os.getenv('AGENTIC_GROK_URL', 'http://localhost:8001')
        try:
            r = httpx.get(f"{agent_url}/api/agentic/health", timeout=2.0)
            if r.status_code == 200:
                grok = GrokChatClient(agent_url=agent_url, db_client=db_client)
                return grok, True, None
        except Exception:
            pass

        # Fallback to direct xAI API
        api_key = os.getenv('XAI_API_KEY')
        if api_key:
            grok = GrokChatClient(api_key=api_key, db_client=db_client)
            return grok, True, None

        return None, False, "Agentic Grok unreachable and XAI_API_KEY not set"
    except Exception as e:
        return None, False, str(e)

grok_client, grok_connected, grok_error = get_grok_client()

# Get data status for all sources
@st.cache_data(ttl=10)
def get_data_status():
    """Get cached data status from database (refreshes every 10 seconds)."""
    if not (db_connected and db_client):
        return None
    try:
        if hasattr(db_client, 'get_data_status'):
            return db_client.get_data_status()
        else:
            return None
    except Exception as e:
        # Be quiet on Cloud or when DB is unreachable
        return None

data_status = get_data_status()

# Sidebar
st.sidebar.title("🧠 EEG Tokenizer")
st.sidebar.markdown("---")

# Mode selection
mode = st.sidebar.selectbox(
    "Mode",
    ["Live Streaming", "Historical Playback", "Validation Analysis"]
)

st.sidebar.markdown("---")
st.sidebar.markdown("### System Status")
st.sidebar.markdown("**Core Pipeline:** ✅ Loaded")
st.sidebar.markdown(f"**Database:** {'✅ Connected' if db_connected else '❌ Offline'}")
st.sidebar.markdown(f"**Grok Chat:** {'✅ Connected' if grok_connected else '❌ Offline'}")

# Data source status with actual data checks
if data_status:
    neurable_status = f"✅ {data_status['eeg_tokens']['row_count']:,} tokens" if data_status['eeg_tokens']['has_data'] else "🔴 No data"
    whoop_status = f"✅ {data_status['whoop_metrics']['row_count']:,} metrics" if data_status['whoop_metrics']['has_data'] else "🔴 No data"
    limitless_status = f"✅ {data_status['limitless_events']['row_count']:,} events" if data_status['limitless_events']['has_data'] else "🔴 No data"
else:
    neurable_status = "⏳ Loading..."
    whoop_status = "⏳ Loading..."
    limitless_status = "⏳ Loading..."

st.sidebar.markdown(f"**Neurable:** {neurable_status}")
st.sidebar.markdown(f"**Whoop:** {whoop_status}")
st.sidebar.markdown(f"**Limitless:** {limitless_status}")

# Main content
st.title("EEG Tokenization System")
st.markdown("**Equation:** `Token_t = H[S_t · PE_t · Φ_t · GA_t · (1/(1 + e^{SE}))]`")

if mode == "Validation Analysis":
    st.header("P300 Validation Results")

    # Load P300 results
    results_file = Path("p300_spike_results.json")
    if results_file.exists():
        with open(results_file, 'r') as f:
            results = json.load(f)

        # Create columns for metrics
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.metric(
                "P300 Windows",
                results['p300_windows'],
                delta=f"{results['baseline_windows']} baseline"
            )

        with col2:
            st.metric(
                "PE_t Spike Ratio",
                f"{results['spike_ratio']:.2f}x",
                delta="-0.01x (needs calibration)" if results['spike_ratio'] < 1.1 else "Good"
            )

        with col3:
            st.metric(
                "Mean SE",
                f"{results['se_stats']['mean']:.3f}",
                delta=f"±{results['se_stats']['std']:.3f}"
            )

        with col4:
            st.metric(
                "Gate Weight",
                f"{results['gate_weight_stats']['mean']:.3f}",
                delta=f"±{results['gate_weight_stats']['std']:.3f}"
            )

        # Display validation plot
        st.subheader("P300 Spike Analysis")
        img_file = Path("p300_spike_analysis.png")
        if img_file.exists():
            st.image(str(img_file), use_container_width=True)

        # Equation breakdown
        st.subheader("Equation Component Analysis")

        tab1, tab2, tab3, tab4, tab5 = st.tabs([
            "S_t (Spectral)",
            "PE_t (Prediction)",
            "Φ_t (Phase)",
            "GA_t (Gating)",
            "SE (Exponent)"
        ])

        with tab1:
            st.markdown("""
            **Spectral Gating (S_t)**
            - **Method:** Welch's PSD estimation
            - **Function:** `apply_se_gating_multichannel()`
            - **Output:** Gated EEG signal (removes 1/f noise)
            """)

        with tab2:
            st.markdown(f"""
            **Prediction Error (PE_t)**
            - **Method:** Bidirectional Transformer (5M params)
            - **P300 Mean:** {results['pe_t_p300_mean']:.3f}
            - **Baseline Mean:** {results['pe_t_baseline_mean']:.3f}
            - **Spike Ratio:** {results['spike_ratio']:.2f}x
            - **Status:** ⚠️ Not detecting P300 spikes (needs recalibration)
            """)

        with tab3:
            st.markdown("""
            **Phase Features (Φ_t)**
            - **Method:** Hilbert transform + PAC
            - **Dimensions:** 60 (5 theta × 6 gamma × 2 metrics)
            - **Bands:** Delta, Theta, Alpha, Beta, Gamma
            - **Metrics:** Modulation Index + Coherence
            """)

        with tab4:
            st.markdown("""
            **Gating Attention (GA_t)**
            - **Method:** Huxley-Gödel multi-agent replay
            - **Agents:** 3 competing predictors
            - **Mechanism:** Winner-take-all selection
            - **Memory:** Episodic buffer (capacity 1000)
            """)

        with tab5:
            st.markdown(f"""
            **Spectral Exponent (SE)**
            - **Method:** -d(log PSD)/d(log f)
            - **Range:** [{results['se_stats']['min']:.2f}, {results['se_stats']['max']:.2f}]
            - **Mean:** {results['se_stats']['mean']:.3f} ± {results['se_stats']['std']:.3f}
            - **Gating:** `1/(1 + e^|SE|)`
            - **Effect:** Filters unconscious 1/f noise
            """)

        # Technical details expander
        with st.expander("🔬 Technical Details"):
            st.json({
                "dataset": "Synthetic P300 (5 min)",
                "sampling_rate_hz": 256,
                "n_channels": 12,
                "n_samples": 76800,
                "p300_events": 149,
                "p300_latency_ms": 300.0,
                "window_size_samples": 256,
                "window_overlap": 0.5,
                "rvq_levels": 3,
                "codebook_size": 128,
                "total_parameters": 4967933
            })

    else:
        st.error("P300 validation results not found. Run `python test_tokenization.py` first.")

elif mode == "Historical Playback":
    st.header("Historical Data Playback")
    st.markdown("EEG aggregates with WHOOP overlays and lifelog markers.")

    minutes = st.slider("Window (minutes)", min_value=5, max_value=180, value=60, step=5)

    if db_connected and db_client:
        try:
            import pandas as pd
            import altair as alt

            # Load EEG aggregates
            aggs = db_client.get_eeg_aggregates(minutes=minutes)
            if not aggs:
                st.info("No EEG aggregates in this window")
            else:
                df = pd.DataFrame(aggs)
                # Aggregate across channels for overlay clarity
                df_avg = df.groupby('bucket', as_index=False)['avg_pe_t'].mean().rename(columns={'avg_pe_t':'avg_pe_t_avg'})

                # Load WHOOP
                whoop = db_client.get_whoop_series(minutes=minutes)
                df_w = pd.DataFrame(whoop) if whoop else pd.DataFrame(columns=['timestamp','hrv_ms','strain','recovery'])

                # Normalize WHOOP metrics to 0-1 for overlay
                def _norm(s):
                    if s is None or len(s)==0:
                        return s
                    mn, mx = s.min(), s.max()
                    return (s - mn) / (mx - mn + 1e-9)

                if not df_w.empty:
                    df_w['strain_n'] = _norm(df_w['strain'].astype(float))
                    df_w['recovery_n'] = _norm(df_w['recovery'].astype(float))
                    df_w['hrv_n'] = _norm(df_w['hrv_ms'].astype(float))

                # Load lifelogs
                ll = db_client.get_limitless_events(minutes=minutes)
                df_ll = pd.DataFrame(ll) if ll else pd.DataFrame(columns=['timestamp','meeting_id','speaker','transcript'])

                base = alt.Chart(df_avg).mark_line(color='#16a34a').encode(
                    x=alt.X('bucket:T', title='Time'),
                    y=alt.Y('avg_pe_t_avg:Q', title='EEG avg PE_t')
                ).properties(height=300)

                layers = [base]

                if not df_w.empty:
                    w_strain = alt.Chart(df_w).mark_line(color='#2563eb').encode(
                        x='timestamp:T', y=alt.Y('strain_n:Q', title='Scaled metrics'), tooltip=['strain']
                    )
                    w_recovery = alt.Chart(df_w).mark_line(color='#9333ea').encode(
                        x='timestamp:T', y='recovery_n:Q', tooltip=['recovery']
                    )
                    layers += [w_strain, w_recovery]

                if not df_ll.empty:
                    ll_marks = alt.Chart(df_ll).mark_rule(color='#ef4444').encode(
                        x='timestamp:T',
                        tooltip=['speaker','meeting_id','transcript']
                    )
                    layers.append(ll_marks)

                chart = alt.layer(*layers).resolve_scale(y='independent')
                st.altair_chart(chart, use_container_width=True)

                with st.expander("Raw aggregates"):
                    st.dataframe(df.head(100))
                if not df_w.empty:
                    with st.expander("WHOOP metrics"):
                        st.dataframe(df_w.head(100))
                if not df_ll.empty:
                    with st.expander("Life logs"):
                        st.dataframe(df_ll[['timestamp','speaker','meeting_id','transcript']].head(50))

        except Exception as e:
            st.error(f"Failed to load historical view: {e}")
    else:
        st.warning("Database not connected.")

elif mode == "Live Streaming":
    st.header("Live EEG Streaming")
    st.info("Stream from a Neurable WebSocket source (Mac supported).")

    # Live WS controls
    with st.expander("⚙️ Neurable WebSocket Settings", expanded=True):
        default_ws = os.getenv('NEURABLE_WS_URL', 'ws://localhost:8765/neurable')
        ws_url = st.text_input("WebSocket URL", value=default_ws, help="e.g. ws://localhost:8765/neurable")

        colA, colB, colC = st.columns([1,1,2])
        with colA:
            start = st.button("Start Stream", type="primary")
        with colB:
            stop = st.button("Stop Stream")
        with colC:
            st.write("")

        if 'ws_pid' not in st.session_state:
            st.session_state.ws_pid = None

        if start and not st.session_state.ws_pid:
            import subprocess
            base_dir = Path(__file__).resolve().parent
            script_path = str(base_dir / 'neurable_ws_client.py')
            cmd = [
                sys.executable,
                script_path,
                '--url', ws_url,
                '--session-id', 'LIVE',
                '--verbose'
            ]
            proc = subprocess.Popen(cmd, cwd=str(Path('.').resolve()))
            st.session_state.ws_pid = proc.pid
            st.success(f"Started Neurable WS client (PID {proc.pid})")

        if stop and st.session_state.ws_pid:
            try:
                import os, signal
                os.kill(st.session_state.ws_pid, signal.SIGTERM)
                st.success(f"Stopped Neurable WS client (PID {st.session_state.ws_pid})")
            except Exception as e:
                st.warning(f"Could not stop process: {e}")
            finally:
                st.session_state.ws_pid = None

    # Connection status
    st.subheader("Data Sources")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.markdown("**Neurable EEG**")
        if data_status and data_status['eeg_tokens']['has_data']:
            st.markdown(f"✅ {data_status['eeg_tokens']['row_count']:,} tokens")
        else:
            st.markdown("🔴 No data")
        st.markdown("256 Hz, 12 channels")

    with col2:
        st.markdown("**Whoop API**")
        if data_status and data_status['whoop_metrics']['has_data']:
            st.markdown(f"✅ {data_status['whoop_metrics']['row_count']:,} metrics")
        else:
            st.markdown("🔴 No data")
        st.markdown("Polling: 60s")

    with col3:
        st.markdown("**Limitless**")
        if data_status and data_status['limitless_events']['has_data']:
            st.markdown(f"✅ {data_status['limitless_events']['row_count']:,} events")
        else:
            st.markdown("🔴 No data")
        st.markdown("Life logs")

    with col4:
        st.markdown("**Chat Logs**")
        if data_status and data_status['chat_logs']['has_data']:
            st.markdown(f"✅ {data_status['chat_logs']['row_count']:,} logs")
        else:
            st.markdown("🔴 No data")
        st.markdown("Grok 4 conversations")

    st.markdown("---")

    # Brain state display (if database connected)
    if db_connected and db_client and hasattr(db_client, 'get_brain_state'):
        st.subheader("🧠 Current Brain State (Last 10 seconds)")

        try:
            brain_state = db_client.get_brain_state()

            col1, col2, col3, col4 = st.columns(4)

            with col1:
                st.metric(
                    "Avg PE_t",
                    f"{brain_state['avg_pe_t']:.3f}" if brain_state['avg_pe_t'] is not None else "No data",
                    delta=f"±{brain_state['stddev_pe_t']:.3f}" if brain_state['stddev_pe_t'] is not None else None
                )

            with col2:
                st.metric(
                    "Avg SE",
                    f"{brain_state['avg_se']:.3f}" if brain_state['avg_se'] is not None else "No data"
                )

            with col3:
                st.metric(
                    "Gate Weight",
                    f"{brain_state['avg_gate_weight']:.3f}" if brain_state['avg_gate_weight'] is not None else "No data"
                )

            with col4:
                st.markdown("**Dominant Tokens**")
                if brain_state['dominant_tokens'][0] is not None:
                    st.markdown(f"L1: {brain_state['dominant_tokens'][0]}")
                    st.markdown(f"L2: {brain_state['dominant_tokens'][1]}")
                    st.markdown(f"L3: {brain_state['dominant_tokens'][2]}")
                else:
                    st.markdown("No data")

            # Recent alerts
            st.subheader("⚠️ Recent Alerts (Last 10 minutes)")
            recent_alerts = db_client.get_recent_alerts(minutes=10)

            if recent_alerts:
                for alert in recent_alerts[:5]:  # Show last 5 alerts
                    severity_emoji = {
                        'low': 'ℹ️',
                        'medium': '⚠️',
                        'high': '🔴',
                        'critical': '🚨'
                    }.get(alert['severity'], 'ℹ️')

                    st.markdown(f"{severity_emoji} **{alert['type']}** ({alert['timestamp'].strftime('%H:%M:%S')}): {alert['message']}")
            else:
                st.info("No recent alerts")

        except Exception:
            st.info("Brain state unavailable (database not reachable)")

    st.markdown("---")

    # Placeholder for live visualization
    st.subheader("Live EEG (12 Channels)")
    chart_placeholder = st.empty()

    # Placeholder for token stream
    st.subheader("Token Stream")
    token_placeholder = st.empty()

    # Chat interface
    st.subheader("💬 Brain-Context Chat (Grok 4 Fast)")

    # Show connection status
    if not grok_connected:
        st.warning(f"⚠️ Grok chat unavailable: {grok_error}")
        st.info("Set XAI_API_KEY for direct xAI access or start the local Agentic Grok service (uses your XAI_API_KEY).")
    else:
        # Chat history
        if 'chat_history' not in st.session_state:
            st.session_state.chat_history = []

        # Display chat history
        for message in st.session_state.chat_history:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

        # Chat input
        if prompt := st.chat_input("Ask about your brain state..."):
            # Add user message
            st.session_state.chat_history.append({"role": "user", "content": prompt})

            # Display user message
            with st.chat_message("user"):
                st.markdown(prompt)

            # Generate response with Grok (streaming)
            with st.chat_message("assistant"):
                try:
                    # Stream response from Grok with brain state context
                    response_placeholder = st.empty()
                    full_response = ""

                    # Stream chunks
                    for chunk in grok_client.chat_stream(
                        user_message=prompt,
                        conversation_history=st.session_state.chat_history[:-1],  # Exclude the message we just added
                        include_brain_context=True,
                        temperature=0.7,
                        max_tokens=500
                    ):
                        full_response += chunk
                        response_placeholder.markdown(full_response + "▌")

                    # Final response without cursor
                    response_placeholder.markdown(full_response)
                    response = full_response

                    # Store conversation in database
                    if db_connected and db_client:
                        try:
                            grok_client.store_conversation(
                                user_message=prompt,
                                assistant_response=response
                            )
                        except Exception as e:
                            st.error(f"Failed to store conversation: {e}")

                except Exception as e:
                    response = f"⚠️ Error generating response: {e}"
                    st.markdown(response)

            # Add assistant message
            st.session_state.chat_history.append({"role": "assistant", "content": response})

# Footer
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center'>
        <p>EEG Tokenization System | 4.97M parameters | Real-time brain state analysis</p>
        <p><em>"Your brain becomes stateful. I become less glitchy."</em></p>
    </div>
    """,
    unsafe_allow_html=True
)
