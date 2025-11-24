#!/usr/bin/env python3
"""
Legal Advocate AI - Streamlit Dashboard
Interactive dashboard for managing legal deadlines, attorney requests, and alerts.
"""

import os
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Any
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import httpx
from streamlit_calendar import calendar as st_calendar
import pytz

# ============================================================================
# Configuration
# ============================================================================

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
DEFAULT_API_KEY = os.getenv("API_KEY", "dev-key-change-in-production")
CACHE_TTL = 300  # 5 minutes

# Color mapping for urgency levels
URGENCY_COLORS = {
    "urgent": "#ff4444",     # Red
    "high": "#ff8c00",       # Orange
    "medium": "#ffd700",     # Yellow
    "low": "#1e90ff"         # Blue
}

# Status colors
STATUS_COLORS = {
    "pending": "#ffd700",
    "in_progress": "#1e90ff",
    "completed": "#00c851",
    "cancelled": "#808080",
    "deferred": "#ff8c00"
}

# ============================================================================
# API Client
# ============================================================================

class APIClient:
    """Client for interacting with Legal Advocate API"""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {"X-API-Key": api_key}

    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make HTTP request with error handling"""
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.request(
                    method,
                    f"{self.base_url}{endpoint}",
                    headers=self.headers,
                    **kwargs
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            st.error(f"API Error ({e.response.status_code}): {e.response.text}")
            raise
        except httpx.RequestError as e:
            st.error(f"Connection Error: {str(e)}")
            raise

    def get_deadlines(self, **params) -> Dict:
        """Get deadlines with optional filters"""
        return self._make_request("GET", "/api/deadlines", params=params)

    def get_requests(self, **params) -> Dict:
        """Get attorney requests with optional filters"""
        return self._make_request("GET", "/api/requests", params=params)

    def get_alerts(self, **params) -> Dict:
        """Get alerts with optional filters"""
        return self._make_request("GET", "/api/alerts", params=params)

    def get_cases(self, **params) -> Dict:
        """Get cases with optional filters"""
        return self._make_request("GET", "/api/cases", params=params)

    def get_completion_stats(self, **params) -> Dict:
        """Get completion statistics"""
        return self._make_request("GET", "/api/completions/stats", params=params)

    def get_recent_completions(self, **params) -> Dict:
        """Get recent completions"""
        return self._make_request("GET", "/api/completions/recent", params=params)

    def complete_deadline(self, deadline_id: int) -> Dict:
        """Mark deadline as complete"""
        return self._make_request("POST", f"/api/deadlines/{deadline_id}/complete")

    def complete_request(self, request_id: int, notes: str = "") -> Dict:
        """Mark request as complete"""
        return self._make_request(
            "POST",
            f"/api/requests/{request_id}/complete",
            json={"notes": notes}
        )

    def acknowledge_alert(self, alert_id: int, notes: str = "") -> Dict:
        """Acknowledge an alert"""
        return self._make_request(
            "PUT",
            f"/api/alerts/{alert_id}/acknowledge",
            json={"notes": notes}
        )

    def update_deadline(self, deadline_id: int, **data) -> Dict:
        """Update deadline"""
        return self._make_request("PUT", f"/api/deadlines/{deadline_id}", json=data)

    def update_request(self, request_id: int, **data) -> Dict:
        """Update request"""
        return self._make_request("PUT", f"/api/requests/{request_id}", json=data)

    def health_check(self) -> Dict:
        """Check API health"""
        return self._make_request("GET", "/health")

# ============================================================================
# Page Configuration
# ============================================================================

st.set_page_config(
    page_title="Legal Advocate AI",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .metric-card {
        background-color: #f0f2f6;
        padding: 20px;
        border-radius: 10px;
        border-left: 4px solid #1e90ff;
    }
    .urgent-item {
        border-left: 4px solid #ff4444;
        padding: 10px;
        margin: 5px 0;
        background-color: #fff5f5;
    }
    .high-item {
        border-left: 4px solid #ff8c00;
        padding: 10px;
        margin: 5px 0;
        background-color: #fff8f0;
    }
    .medium-item {
        border-left: 4px solid #ffd700;
        padding: 10px;
        margin: 5px 0;
        background-color: #fffef0;
    }
    .low-item {
        border-left: 4px solid #1e90ff;
        padding: 10px;
        margin: 5px 0;
        background-color: #f0f8ff;
    }
    .stButton>button {
        width: 100%;
    }
</style>
""", unsafe_allow_html=True)

# ============================================================================
# Session State Initialization
# ============================================================================

if "api_key" not in st.session_state:
    st.session_state.api_key = DEFAULT_API_KEY

if "current_page" not in st.session_state:
    st.session_state.current_page = "Dashboard"

if "filters" not in st.session_state:
    st.session_state.filters = {}

# ============================================================================
# Authentication
# ============================================================================

def check_authentication() -> bool:
    """Check if user is authenticated"""
    if not st.session_state.api_key:
        st.warning("⚠️ Please enter your API key in the sidebar")
        return False
    return True

# ============================================================================
# Data Loading Functions (with caching)
# ============================================================================

@st.cache_data(ttl=CACHE_TTL)
def load_deadlines(api_key: str, **filters) -> Dict:
    """Load deadlines with caching"""
    client = APIClient(API_BASE_URL, api_key)
    return client.get_deadlines(**filters)

@st.cache_data(ttl=CACHE_TTL)
def load_requests(api_key: str, **filters) -> Dict:
    """Load requests with caching"""
    client = APIClient(API_BASE_URL, api_key)
    return client.get_requests(**filters)

@st.cache_data(ttl=CACHE_TTL)
def load_alerts(api_key: str, **filters) -> Dict:
    """Load alerts with caching"""
    client = APIClient(API_BASE_URL, api_key)
    return client.get_alerts(**filters)

@st.cache_data(ttl=CACHE_TTL)
def load_cases(api_key: str, **filters) -> Dict:
    """Load cases with caching"""
    client = APIClient(API_BASE_URL, api_key)
    return client.get_cases(**filters)

@st.cache_data(ttl=CACHE_TTL)
def load_stats(api_key: str, **params) -> Dict:
    """Load completion statistics with caching"""
    client = APIClient(API_BASE_URL, api_key)
    return client.get_completion_stats(**params)

@st.cache_data(ttl=CACHE_TTL)
def load_calendar_events(api_key: str, start_date: str, end_date: str, **filters) -> Dict:
    """Load calendar events with caching"""
    client = APIClient(API_BASE_URL, api_key)
    return client._make_request("GET", "/api/calendar/events", params={
        "start_date": start_date,
        "end_date": end_date,
        **filters
    })

# ============================================================================
# Utility Functions
# ============================================================================

def format_datetime(dt_str: str) -> str:
    """Format ISO datetime for display"""
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime("%Y-%m-%d %I:%M %p")
    except:
        return dt_str

def get_urgency_class(urgency: str) -> str:
    """Get CSS class for urgency level"""
    return f"{urgency.lower()}-item"

def calculate_days_until(due_date: str) -> int:
    """Calculate days until due date"""
    try:
        dt = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
        return (dt - datetime.now(pytz.UTC)).days
    except:
        return 0

# ============================================================================
# Sidebar Navigation
# ============================================================================

with st.sidebar:
    st.title("⚖️ Legal Advocate AI")

    # API Key Input
    st.subheader("Authentication")
    api_key = st.text_input(
        "API Key",
        value=st.session_state.api_key,
        type="password",
        help="Enter your API key to access the dashboard"
    )
    if api_key != st.session_state.api_key:
        st.session_state.api_key = api_key
        st.cache_data.clear()
        st.rerun()

    # Navigation
    st.divider()
    st.subheader("Navigation")

    pages = {
        "📊 Dashboard": "Dashboard",
        "📅 Calendar": "Calendar",
        "⏰ Deadlines": "Deadlines",
        "📝 Requests": "Requests",
        "🔔 Alerts": "Alerts",
        "📁 Cases": "Cases"
    }

    for icon_page, page in pages.items():
        if st.button(icon_page, use_container_width=True):
            st.session_state.current_page = page
            st.rerun()

    # Settings
    st.divider()
    st.subheader("Settings")

    auto_refresh = st.checkbox("Auto-refresh (5 min)", value=False)
    if auto_refresh:
        st.info("Dashboard will auto-refresh every 5 minutes")

    if st.button("🔄 Refresh Data", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

    # API Status
    st.divider()
    try:
        client = APIClient(API_BASE_URL, st.session_state.api_key)
        health = client.health_check()
        st.success(f"✅ API Status: {health.get('status', 'unknown').upper()}")
    except:
        st.error("❌ API Offline")

# ============================================================================
# Page: Dashboard
# ============================================================================

def show_dashboard():
    """Show main dashboard with overview and statistics"""
    st.title("📊 Dashboard Overview")

    if not check_authentication():
        return

    # Load data
    try:
        deadlines_data = load_deadlines(st.session_state.api_key, status="pending", limit=100)
        requests_data = load_requests(st.session_state.api_key, status="pending", limit=100)
        alerts_data = load_alerts(st.session_state.api_key, status="scheduled", limit=100)
        stats = load_stats(st.session_state.api_key)

        deadlines = deadlines_data.get("items", [])
        requests = requests_data.get("items", [])
        alerts = alerts_data.get("items", [])

        # Summary metrics
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.metric(
                "Pending Deadlines",
                len(deadlines),
                delta=None,
                help="Total number of pending deadlines"
            )

        with col2:
            st.metric(
                "Open Requests",
                len(requests),
                delta=None,
                help="Total number of open attorney requests"
            )

        with col3:
            st.metric(
                "Scheduled Alerts",
                len(alerts),
                delta=None,
                help="Total number of scheduled alerts"
            )

        with col4:
            completion_rate = stats.get("completion_rate", 0)
            st.metric(
                "Completion Rate",
                f"{completion_rate:.1f}%",
                delta=None,
                help="Overall task completion rate"
            )

        st.divider()

        # Two column layout
        col_left, col_right = st.columns(2)

        with col_left:
            # Urgent items
            st.subheader("🚨 Urgent Items")

            urgent_deadlines = [d for d in deadlines if calculate_days_until(d["due_date"]) <= 3]
            urgent_requests = [r for r in requests if r.get("urgency") == "urgent"]

            if urgent_deadlines or urgent_requests:
                for deadline in urgent_deadlines[:5]:
                    days = calculate_days_until(deadline["due_date"])
                    st.markdown(f"""
                    <div class="urgent-item">
                        <strong>⏰ {deadline['description']}</strong><br>
                        Due: {format_datetime(deadline['due_date'])} ({days} days)<br>
                        Type: {deadline['deadline_type'].replace('_', ' ').title()}
                    </div>
                    """, unsafe_allow_html=True)

                for request in urgent_requests[:5]:
                    st.markdown(f"""
                    <div class="urgent-item">
                        <strong>📝 {request['description']}</strong><br>
                        Type: {request['request_type'].replace('_', ' ').title()}<br>
                        Urgency: {request['urgency'].upper()}
                    </div>
                    """, unsafe_allow_html=True)
            else:
                st.success("✅ No urgent items at this time")

            # Deadline distribution chart
            st.subheader("📈 Deadline Distribution")
            if deadlines:
                deadline_types = pd.DataFrame(deadlines)['deadline_type'].value_counts()
                fig = px.pie(
                    values=deadline_types.values,
                    names=[t.replace('_', ' ').title() for t in deadline_types.index],
                    title="Deadlines by Type"
                )
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("No deadlines to display")

        with col_right:
            # Request urgency breakdown
            st.subheader("📊 Request Urgency Breakdown")
            if requests:
                urgency_counts = pd.DataFrame(requests)['urgency'].value_counts()
                fig = go.Figure(data=[go.Bar(
                    x=[u.title() for u in urgency_counts.index],
                    y=urgency_counts.values,
                    marker_color=[URGENCY_COLORS.get(u, '#808080') for u in urgency_counts.index]
                )])
                fig.update_layout(
                    title="Requests by Urgency",
                    xaxis_title="Urgency Level",
                    yaxis_title="Count"
                )
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("No requests to display")

            # Completion timeline
            st.subheader("📅 Recent Activity")
            client = APIClient(API_BASE_URL, st.session_state.api_key)
            recent = client.get_recent_completions(limit=10)

            if recent.get("items"):
                for item in recent["items"][:5]:
                    st.markdown(f"""
                    <div style="padding: 10px; margin: 5px 0; background-color: #f0f8ff; border-radius: 5px;">
                        ✅ <strong>{item.get('item_type', 'Unknown').title()}</strong> completed<br>
                        <small>{format_datetime(item.get('completed_at', ''))}</small>
                    </div>
                    """, unsafe_allow_html=True)
            else:
                st.info("No recent completions")

    except Exception as e:
        st.error(f"Error loading dashboard: {str(e)}")

# ============================================================================
# Page: Deadlines
# ============================================================================

def show_deadlines():
    """Show deadlines list and calendar view"""
    st.title("⏰ Deadlines")

    if not check_authentication():
        return

    # Filter controls
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        status_filter = st.selectbox(
            "Status",
            ["All", "pending", "in_progress", "completed", "cancelled"],
            index=0
        )

    with col2:
        type_filter = st.selectbox(
            "Type",
            ["All", "court_filing", "response_deadline", "discovery_deadline", "hearing_date", "trial_date"],
            index=0
        )

    with col3:
        date_from = st.date_input("From Date", value=None)

    with col4:
        date_to = st.date_input("To Date", value=None)

    # View toggle
    view_mode = st.radio(
        "View Mode",
        ["List View", "Calendar View"],
        horizontal=True
    )

    # Build filters
    filters = {}
    if status_filter != "All":
        filters["status"] = status_filter
    if type_filter != "All":
        filters["deadline_type"] = type_filter
    if date_from:
        filters["due_after"] = date_from.isoformat()
    if date_to:
        filters["due_before"] = date_to.isoformat()

    # Load data
    try:
        data = load_deadlines(st.session_state.api_key, **filters)
        deadlines = data.get("items", [])

        st.info(f"📋 Showing {len(deadlines)} of {data.get('total', 0)} deadlines")

        if view_mode == "List View":
            # List view
            if deadlines:
                for deadline in deadlines:
                    days_until = calculate_days_until(deadline["due_date"])
                    urgency_class = "urgent" if days_until <= 3 else "high" if days_until <= 7 else "medium"

                    with st.expander(f"⏰ {deadline['description']}", expanded=False):
                        col_info, col_actions = st.columns([3, 1])

                        with col_info:
                            st.write(f"**Type:** {deadline['deadline_type'].replace('_', ' ').title()}")
                            st.write(f"**Due Date:** {format_datetime(deadline['due_date'])} ({days_until} days)")
                            st.write(f"**Status:** {deadline['status'].title()}")
                            st.write(f"**Responsible:** {deadline.get('responsible_party', 'N/A').title()}")
                            if deadline.get('notes'):
                                st.write(f"**Notes:** {deadline['notes']}")

                        with col_actions:
                            if deadline['status'] == 'pending':
                                if st.button("✅ Complete", key=f"complete_{deadline['id']}"):
                                    try:
                                        client = APIClient(API_BASE_URL, st.session_state.api_key)
                                        client.complete_deadline(deadline['id'])
                                        st.success("Deadline completed!")
                                        st.cache_data.clear()
                                        st.rerun()
                                    except Exception as e:
                                        st.error(f"Error: {str(e)}")

                            if st.button("📝 Edit", key=f"edit_{deadline['id']}"):
                                st.session_state[f"editing_{deadline['id']}"] = True
                                st.rerun()

                        # Edit form
                        if st.session_state.get(f"editing_{deadline['id']}", False):
                            with st.form(key=f"edit_form_{deadline['id']}"):
                                new_desc = st.text_input("Description", value=deadline['description'])
                                new_status = st.selectbox(
                                    "Status",
                                    ["pending", "in_progress", "completed", "cancelled"],
                                    index=["pending", "in_progress", "completed", "cancelled"].index(deadline['status'])
                                )
                                new_notes = st.text_area("Notes", value=deadline.get('notes', ''))

                                col_save, col_cancel = st.columns(2)
                                with col_save:
                                    if st.form_submit_button("💾 Save"):
                                        try:
                                            client = APIClient(API_BASE_URL, st.session_state.api_key)
                                            client.update_deadline(
                                                deadline['id'],
                                                description=new_desc,
                                                status=new_status,
                                                notes=new_notes
                                            )
                                            st.success("Deadline updated!")
                                            st.session_state[f"editing_{deadline['id']}"] = False
                                            st.cache_data.clear()
                                            st.rerun()
                                        except Exception as e:
                                            st.error(f"Error: {str(e)}")

                                with col_cancel:
                                    if st.form_submit_button("❌ Cancel"):
                                        st.session_state[f"editing_{deadline['id']}"] = False
                                        st.rerun()
            else:
                st.info("No deadlines found with current filters")

        else:
            # Calendar view
            st.info("📅 Calendar view - deadlines displayed by due date")

            if deadlines:
                # Prepare calendar events
                events = []
                for deadline in deadlines:
                    due_date = datetime.fromisoformat(deadline['due_date'].replace('Z', '+00:00'))
                    days_until = calculate_days_until(deadline['due_date'])

                    color = "#ff4444" if days_until <= 3 else "#ff8c00" if days_until <= 7 else "#1e90ff"

                    events.append({
                        "title": deadline['description'],
                        "start": due_date.strftime("%Y-%m-%d"),
                        "color": color
                    })

                # Display calendar (using simple date grouping)
                df = pd.DataFrame(deadlines)
                df['due_date'] = pd.to_datetime(df['due_date'])
                df['date'] = df['due_date'].dt.date

                grouped = df.groupby('date')
                for date, group in grouped:
                    st.subheader(f"📅 {date.strftime('%A, %B %d, %Y')}")
                    for _, deadline in group.iterrows():
                        st.markdown(f"""
                        <div style="padding: 10px; margin: 5px 0; background-color: #f0f8ff; border-left: 4px solid #1e90ff;">
                            <strong>{deadline['description']}</strong><br>
                            Type: {deadline['deadline_type'].replace('_', ' ').title()}<br>
                            Time: {deadline['due_date'].strftime('%I:%M %p')}
                        </div>
                        """, unsafe_allow_html=True)
            else:
                st.info("No deadlines to display on calendar")

    except Exception as e:
        st.error(f"Error loading deadlines: {str(e)}")

# ============================================================================
# Page: Requests
# ============================================================================

def show_requests():
    """Show attorney requests"""
    st.title("📝 Attorney Requests")

    if not check_authentication():
        return

    # Filter controls
    col1, col2, col3 = st.columns(3)

    with col1:
        status_filter = st.selectbox(
            "Status",
            ["All", "pending", "in_progress", "completed"],
            index=0,
            key="req_status"
        )

    with col2:
        urgency_filter = st.selectbox(
            "Urgency",
            ["All", "urgent", "high", "medium", "low"],
            index=0,
            key="req_urgency"
        )

    with col3:
        type_filter = st.selectbox(
            "Type",
            ["All", "document_request", "information_needed", "action_required", "meeting_scheduled"],
            index=0,
            key="req_type"
        )

    # Build filters
    filters = {}
    if status_filter != "All":
        filters["status"] = status_filter
    if urgency_filter != "All":
        filters["urgency"] = urgency_filter
    if type_filter != "All":
        filters["request_type"] = type_filter

    # Load data
    try:
        data = load_requests(st.session_state.api_key, **filters)
        requests = data.get("items", [])

        st.info(f"📋 Showing {len(requests)} of {data.get('total', 0)} requests")

        if requests:
            for request in requests:
                urgency_class = get_urgency_class(request.get('urgency', 'low'))

                with st.expander(f"📝 {request['description']}", expanded=False):
                    col_info, col_actions = st.columns([3, 1])

                    with col_info:
                        st.write(f"**Type:** {request['request_type'].replace('_', ' ').title()}")
                        st.write(f"**Urgency:** {request['urgency'].upper()}")
                        st.write(f"**Status:** {request['status'].title()}")
                        if request.get('notes'):
                            st.write(f"**Notes:** {request['notes']}")
                        if request.get('created_at'):
                            st.write(f"**Created:** {format_datetime(request['created_at'])}")

                    with col_actions:
                        if request['status'] in ['pending', 'in_progress']:
                            if st.button("✅ Complete", key=f"complete_req_{request['id']}"):
                                notes = st.text_input(
                                    "Completion Notes",
                                    key=f"notes_req_{request['id']}"
                                )
                                try:
                                    client = APIClient(API_BASE_URL, st.session_state.api_key)
                                    client.complete_request(request['id'], notes=notes)
                                    st.success("Request completed!")
                                    st.cache_data.clear()
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"Error: {str(e)}")

                        if st.button("📝 Edit", key=f"edit_req_{request['id']}"):
                            st.session_state[f"editing_req_{request['id']}"] = True
                            st.rerun()

                    # Edit form
                    if st.session_state.get(f"editing_req_{request['id']}", False):
                        with st.form(key=f"edit_req_form_{request['id']}"):
                            new_desc = st.text_input("Description", value=request['description'])
                            new_urgency = st.selectbox(
                                "Urgency",
                                ["urgent", "high", "medium", "low"],
                                index=["urgent", "high", "medium", "low"].index(request['urgency'])
                            )
                            new_status = st.selectbox(
                                "Status",
                                ["pending", "in_progress", "completed"],
                                index=["pending", "in_progress", "completed"].index(request['status'])
                            )
                            new_notes = st.text_area("Notes", value=request.get('notes', ''))

                            col_save, col_cancel = st.columns(2)
                            with col_save:
                                if st.form_submit_button("💾 Save"):
                                    try:
                                        client = APIClient(API_BASE_URL, st.session_state.api_key)
                                        client.update_request(
                                            request['id'],
                                            description=new_desc,
                                            urgency=new_urgency,
                                            status=new_status,
                                            notes=new_notes
                                        )
                                        st.success("Request updated!")
                                        st.session_state[f"editing_req_{request['id']}"] = False
                                        st.cache_data.clear()
                                        st.rerun()
                                    except Exception as e:
                                        st.error(f"Error: {str(e)}")

                            with col_cancel:
                                if st.form_submit_button("❌ Cancel"):
                                    st.session_state[f"editing_req_{request['id']}"] = False
                                    st.rerun()
        else:
            st.info("No requests found with current filters")

    except Exception as e:
        st.error(f"Error loading requests: {str(e)}")

# ============================================================================
# Page: Alerts
# ============================================================================

def show_alerts():
    """Show alerts and notification center"""
    st.title("🔔 Alerts & Notifications")

    if not check_authentication():
        return

    # Filter controls
    col1, col2 = st.columns(2)

    with col1:
        status_filter = st.selectbox(
            "Status",
            ["All", "scheduled", "sent", "acknowledged", "cancelled"],
            index=0,
            key="alert_status"
        )

    with col2:
        type_filter = st.selectbox(
            "Alert Type",
            ["All", "seven_day", "three_day", "one_day", "same_day"],
            index=0,
            key="alert_type"
        )

    # Build filters
    filters = {}
    if status_filter != "All":
        filters["status"] = status_filter
    if type_filter != "All":
        filters["alert_type"] = type_filter

    # Load data
    try:
        data = load_alerts(st.session_state.api_key, **filters)
        alerts = data.get("items", [])

        st.info(f"📋 Showing {len(alerts)} of {data.get('total', 0)} alerts")

        # Upcoming alerts section
        st.subheader("⏰ Upcoming Alerts (Next 24 Hours)")
        client = APIClient(API_BASE_URL, st.session_state.api_key)
        upcoming = client.get_alerts(status="scheduled", limit=20)

        if upcoming.get("items"):
            for alert in upcoming["items"][:10]:
                scheduled_time = format_datetime(alert.get('scheduled_for', ''))

                st.markdown(f"""
                <div style="padding: 10px; margin: 5px 0; background-color: #fff8f0; border-left: 4px solid #ff8c00;">
                    <strong>🔔 {alert.get('alert_type', 'Unknown').replace('_', ' ').title()} Alert</strong><br>
                    Scheduled: {scheduled_time}<br>
                    Deadline ID: {alert.get('deadline_id', 'N/A')}
                </div>
                """, unsafe_allow_html=True)
        else:
            st.success("✅ No upcoming alerts in next 24 hours")

        st.divider()

        # All alerts
        st.subheader("📋 All Alerts")

        if alerts:
            for alert in alerts:
                with st.expander(
                    f"🔔 {alert.get('alert_type', 'Unknown').replace('_', ' ').title()} - {alert['status'].title()}",
                    expanded=False
                ):
                    col_info, col_actions = st.columns([3, 1])

                    with col_info:
                        st.write(f"**Status:** {alert['status'].title()}")
                        st.write(f"**Type:** {alert['alert_type'].replace('_', ' ').title()}")
                        st.write(f"**Deadline ID:** {alert.get('deadline_id', 'N/A')}")
                        if alert.get('scheduled_for'):
                            st.write(f"**Scheduled:** {format_datetime(alert['scheduled_for'])}")
                        if alert.get('sent_at'):
                            st.write(f"**Sent:** {format_datetime(alert['sent_at'])}")

                    with col_actions:
                        if alert['status'] in ['scheduled', 'sent']:
                            if st.button("✅ Acknowledge", key=f"ack_alert_{alert['id']}"):
                                try:
                                    client.acknowledge_alert(alert['id'])
                                    st.success("Alert acknowledged!")
                                    st.cache_data.clear()
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"Error: {str(e)}")
        else:
            st.info("No alerts found with current filters")

    except Exception as e:
        st.error(f"Error loading alerts: {str(e)}")

# ============================================================================
# Page: Cases
# ============================================================================

def show_cases():
    """Show case management"""
    st.title("📁 Case Management")

    if not check_authentication():
        return

    # Filter controls
    status_filter = st.selectbox(
        "Status",
        ["All", "active", "closed", "pending"],
        index=0,
        key="case_status"
    )

    # Build filters
    filters = {}
    if status_filter != "All":
        filters["status"] = status_filter

    # Load data
    try:
        data = load_cases(st.session_state.api_key, **filters)
        cases = data.get("items", [])

        st.info(f"📋 Showing {len(cases)} of {data.get('total', 0)} cases")

        if cases:
            for case in cases:
                with st.expander(f"📁 {case['title']} ({case['case_number']})", expanded=False):
                    col_info, col_stats = st.columns([2, 1])

                    with col_info:
                        st.write(f"**Case Number:** {case['case_number']}")
                        st.write(f"**Client:** {case.get('client_name', 'N/A')}")
                        st.write(f"**Status:** {case['status'].title()}")
                        if case.get('notes'):
                            st.write(f"**Notes:** {case['notes']}")
                        if case.get('created_at'):
                            st.write(f"**Created:** {format_datetime(case['created_at'])}")

                    with col_stats:
                        # Load case details for counts
                        try:
                            client = APIClient(API_BASE_URL, st.session_state.api_key)
                            case_detail = client._make_request("GET", f"/api/cases/{case['id']}")

                            st.metric("Deadlines", case_detail.get('deadline_count', 0))
                            st.metric("Requests", case_detail.get('request_count', 0))
                            st.metric("Alerts", case_detail.get('alert_count', 0))
                        except:
                            pass

                    # Action buttons
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        if st.button("📋 View Deadlines", key=f"case_deadlines_{case['id']}"):
                            st.session_state.filters = {"case_id": case['id']}
                            st.session_state.current_page = "Deadlines"
                            st.rerun()

                    with col2:
                        if st.button("📝 View Requests", key=f"case_requests_{case['id']}"):
                            st.session_state.filters = {"case_id": case['id']}
                            st.session_state.current_page = "Requests"
                            st.rerun()

                    with col3:
                        if st.button("🔔 View Alerts", key=f"case_alerts_{case['id']}"):
                            st.session_state.current_page = "Alerts"
                            st.rerun()
        else:
            st.info("No cases found with current filters")

    except Exception as e:
        st.error(f"Error loading cases: {str(e)}")

def show_calendar():
    """Calendar page"""
    st.header("📅 Calendar View")

    if not check_authentication():
        return

    try:
        # View selector
        col1, col2, col3 = st.columns([1, 1, 1])

        with col1:
            view_mode = st.selectbox(
                "View",
                ["Month", "Week", "Day"],
                key="calendar_view_mode"
            )

        with col2:
            # Date picker based on view mode
            if view_mode == "Month":
                selected_date = st.date_input(
                    "Select Month",
                    value=date.today(),
                    key="calendar_month_picker"
                )
                # Set to first day of month
                start_date = selected_date.replace(day=1)
                # Set to last day of month
                if selected_date.month == 12:
                    end_date = selected_date.replace(year=selected_date.year + 1, month=1, day=1) - timedelta(days=1)
                else:
                    end_date = selected_date.replace(month=selected_date.month + 1, day=1) - timedelta(days=1)
            elif view_mode == "Week":
                selected_date = st.date_input(
                    "Week Starting",
                    value=date.today(),
                    key="calendar_week_picker"
                )
                # Start from Monday of the week
                start_date = selected_date - timedelta(days=selected_date.weekday())
                end_date = start_date + timedelta(days=6)
            else:  # Day
                start_date = st.date_input(
                    "Select Day",
                    value=date.today(),
                    key="calendar_day_picker"
                )
                end_date = start_date

        with col3:
            # Export button
            if st.button("📥 Export to iCalendar", use_container_width=True):
                try:
                    client = APIClient(API_BASE_URL, st.session_state.api_key)
                    response = client._make_request(
                        "GET",
                        "/api/calendar/export",
                        params={
                            "start_date": str(start_date),
                            "end_date": str(end_date)
                        }
                    )
                    st.success("✅ Calendar exported! Check your downloads folder.")
                except Exception as e:
                    st.error(f"Export failed: {str(e)}")

        st.divider()

        # Filters
        with st.expander("🔍 Filters", expanded=False):
            filter_col1, filter_col2, filter_col3 = st.columns(3)

            with filter_col1:
                event_types = st.multiselect(
                    "Event Types",
                    ["deadline", "request"],
                    default=["deadline", "request"],
                    key="calendar_event_types"
                )

            with filter_col2:
                statuses = st.multiselect(
                    "Status",
                    ["pending", "in_progress", "completed", "cancelled"],
                    default=["pending", "in_progress"],
                    key="calendar_statuses"
                )

            with filter_col3:
                urgencies = st.multiselect(
                    "Urgency",
                    ["urgent", "high", "medium", "low"],
                    key="calendar_urgencies"
                )

        # Load calendar events
        filters = {}
        if event_types:
            filters['event_types'] = ",".join(event_types)
        if statuses:
            filters['statuses'] = ",".join(statuses)
        if urgencies:
            filters['urgencies'] = ",".join(urgencies)

        calendar_data = load_calendar_events(
            st.session_state.api_key,
            str(start_date),
            str(end_date),
            **filters
        )

        events = calendar_data.get('events', [])

        # Display summary
        st.metric(
            f"Events in {view_mode} View",
            len(events),
            help=f"Total events from {start_date} to {end_date}"
        )

        st.divider()

        # Calendar visualization using streamlit-calendar
        calendar_events = []
        for event in events:
            calendar_events.append({
                "title": event.get('title'),
                "start": event.get('start'),
                "end": event.get('end') or event.get('start'),
                "color": event.get('color'),
                "resourceId": event.get('id'),
                "extendedProps": {
                    "type": event.get('event_type'),
                    "status": event.get('status'),
                    "urgency": event.get('urgency'),
                    "case_number": event.get('case_number'),
                    "description": event.get('description')
                }
            })

        calendar_options = {
            "initialView": "dayGridMonth" if view_mode == "Month" else ("timeGridWeek" if view_mode == "Week" else "timeGridDay"),
            "initialDate": str(start_date),
            "headerToolbar": {
                "left": "prev,next today",
                "center": "title",
                "right": ""
            },
            "editable": False,
            "selectable": True,
            "selectMirror": True,
            "dayMaxEvents": True,
            "height": 600
        }

        # Display calendar
        calendar_result = st_calendar(
            events=calendar_events,
            options=calendar_options,
            key="calendar_view"
        )

        # Handle event clicks
        if calendar_result and calendar_result.get("eventClick"):
            event_data = calendar_result["eventClick"]["event"]
            st.divider()
            st.subheader("Event Details")

            detail_col1, detail_col2, detail_col3 = st.columns([2, 1, 1])

            with detail_col1:
                st.write(f"**{event_data.get('title')}**")
                st.write(f"📅 {event_data.get('start')}")
                if event_data.get('extendedProps'):
                    props = event_data['extendedProps']
                    if props.get('description'):
                        st.write(f"📝 {props.get('description')}")
                    if props.get('case_number'):
                        st.write(f"📁 Case: {props.get('case_number')}")

            with detail_col2:
                if event_data.get('extendedProps'):
                    props = event_data['extendedProps']
                    status = props.get('status', 'Unknown')
                    st.markdown(f"**Status:** {status}")
                    urgency = props.get('urgency', 'Unknown')
                    st.markdown(f"**Urgency:** {urgency}")

            with detail_col3:
                # Quick actions
                if event_data.get('extendedProps'):
                    props = event_data['extendedProps']
                    event_type = props.get('type')
                    event_id = event_data.get('resourceId')

                    if event_type == 'deadline':
                        if st.button("✅ Complete", key=f"complete_deadline_{event_id}"):
                            try:
                                client = APIClient(API_BASE_URL, st.session_state.api_key)
                                client.complete_deadline(event_id)
                                st.success("Deadline marked as complete!")
                                st.cache_data.clear()
                                st.rerun()
                            except Exception as e:
                                st.error(f"Failed to complete: {str(e)}")

                    elif event_type == 'request':
                        if st.button("✅ Complete", key=f"complete_request_{event_id}"):
                            try:
                                client = APIClient(API_BASE_URL, st.session_state.api_key)
                                client.complete_request(event_id)
                                st.success("Request marked as complete!")
                                st.cache_data.clear()
                                st.rerun()
                            except Exception as e:
                                st.error(f"Failed to complete: {str(e)}")

        # List view for events
        st.divider()
        st.subheader(f"Events List ({len(events)})")

        if events:
            for event in sorted(events, key=lambda e: e.get('start')):
                urgency = event.get('urgency', 'low')
                color = URGENCY_COLORS.get(urgency, "#6c757d")

                with st.container():
                    event_col1, event_col2, event_col3, event_col4 = st.columns([3, 2, 1, 1])

                    with event_col1:
                        st.markdown(
                            f"<div style='padding: 10px; border-left: 4px solid {color};'>"
                            f"<strong>{event.get('title')}</strong><br/>"
                            f"<small>{event.get('description', '')[:100]}...</small>"
                            f"</div>",
                            unsafe_allow_html=True
                        )

                    with event_col2:
                        st.write(f"📅 {format_datetime(event.get('start'))}")
                        if event.get('case_number'):
                            st.write(f"📁 {event.get('case_number')}")

                    with event_col3:
                        st.badge(event.get('status', 'unknown').upper(), color=STATUS_COLORS.get(event.get('status'), '#6c757d'))
                        st.badge(urgency.upper(), color=color)

                    with event_col4:
                        event_type = event.get('event_type')
                        event_id = event.get('id')

                        if event_type == 'deadline':
                            if st.button("✅", key=f"list_complete_deadline_{event_id}", help="Complete deadline"):
                                try:
                                    client = APIClient(API_BASE_URL, st.session_state.api_key)
                                    client.complete_deadline(event_id)
                                    st.success("Completed!")
                                    st.cache_data.clear()
                                    st.rerun()
                                except Exception as e:
                                    st.error(str(e))

                        elif event_type == 'request':
                            if st.button("✅", key=f"list_complete_request_{event_id}", help="Complete request"):
                                try:
                                    client = APIClient(API_BASE_URL, st.session_state.api_key)
                                    client.complete_request(event_id)
                                    st.success("Completed!")
                                    st.cache_data.clear()
                                    st.rerun()
                                except Exception as e:
                                    st.error(str(e))

                    st.divider()
        else:
            st.info("No events found for the selected date range and filters.")

    except Exception as e:
        st.error(f"Error loading calendar: {str(e)}")
        import traceback
        st.code(traceback.format_exc())

# ============================================================================
# Main App Router
# ============================================================================

def main():
    """Main application router"""

    # Route to appropriate page
    page = st.session_state.current_page

    if page == "Dashboard":
        show_dashboard()
    elif page == "Calendar":
        show_calendar()
    elif page == "Deadlines":
        show_deadlines()
    elif page == "Requests":
        show_requests()
    elif page == "Alerts":
        show_alerts()
    elif page == "Cases":
        show_cases()

if __name__ == "__main__":
    main()
