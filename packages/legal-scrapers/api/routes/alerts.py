"""
Alert API Routes
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime

from api.dependencies import get_alert_repo, get_current_user
from api.schemas.alerts import (
    AlertListResponse,
    AlertDetailResponse,
    AlertAcknowledgeRequest,
    AlertResponse
)
from repositories import AlertRepository
from models.schemas import AlertStatus, AlertType
from utils.monitoring import track_performance

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=AlertListResponse)
@track_performance()
async def list_alerts(
    status_filter: Optional[AlertStatus] = Query(None, alias="status", description="Filter by status"),
    alert_type: Optional[AlertType] = Query(None, description="Filter by alert type"),
    deadline_id: Optional[int] = Query(None, description="Filter by deadline ID"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    scheduled_after: Optional[datetime] = Query(None, description="Filter alerts scheduled after this time"),
    scheduled_before: Optional[datetime] = Query(None, description="Filter alerts scheduled before this time"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    repo: AlertRepository = Depends(get_alert_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    List alerts with optional filtering

    - **status**: Filter by alert status (scheduled, sent, acknowledged, cancelled)
    - **alert_type**: Filter by type (seven_day, three_day, one_day, same_day)
    - **deadline_id**: Filter by specific deadline
    - **user_id**: Filter by user
    - **scheduled_after**: Show alerts scheduled after this time
    - **scheduled_before**: Show alerts scheduled before this time
    - **skip**: Pagination offset
    - **limit**: Maximum results per page
    """
    # Build filter dictionary
    filters = {}
    if status_filter:
        filters['status'] = status_filter
    if alert_type:
        filters['alert_type'] = alert_type
    if deadline_id:
        filters['deadline_id'] = deadline_id

    # Get alerts with proper pagination
    alerts = repo.filter_by(limit=limit, offset=skip, **filters)
    total = repo.count(**filters)

    # Apply date filters
    if scheduled_after or scheduled_before:
        filtered_alerts = []
        for alert in alerts:
            if scheduled_after and alert.scheduled_time < scheduled_after:
                continue
            if scheduled_before and alert.scheduled_time > scheduled_before:
                continue
            filtered_alerts.append(alert)
        alerts = filtered_alerts

    # Convert to response models
    alert_responses = [AlertResponse.model_validate(a) for a in alerts]

    return AlertListResponse.create(
        alerts=alert_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/upcoming", response_model=AlertListResponse)
@track_performance()
async def list_upcoming_alerts(
    hours: int = Query(24, ge=1, le=168, description="Hours to look ahead (default 24, max 168/1 week)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    repo: AlertRepository = Depends(get_alert_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    List upcoming alerts within specified hours

    Returns alerts that are scheduled within the next N hours and not yet sent.
    Useful for dashboard "What's coming up" views.

    - **hours**: Number of hours to look ahead (1-168)
    - **skip**: Pagination offset
    - **limit**: Maximum results per page
    """
    alerts = repo.find_upcoming(hours=hours, skip=skip, limit=limit)
    total = repo.count_upcoming(hours=hours)

    # Convert to response models
    alert_responses = [AlertResponse.model_validate(a) for a in alerts]

    return AlertListResponse.create(
        alerts=alert_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{alert_id}", response_model=AlertDetailResponse)
@track_performance()
async def get_alert(
    alert_id: int,
    repo: AlertRepository = Depends(get_alert_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific alert by ID
    """
    alert = repo.get_by_id(str(alert_id))
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id {alert_id} not found"
        )
    return AlertDetailResponse.model_validate(alert)


@router.put("/{alert_id}/acknowledge", response_model=AlertResponse)
@track_performance()
async def acknowledge_alert(
    alert_id: int,
    ack_data: AlertAcknowledgeRequest,
    repo: AlertRepository = Depends(get_alert_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Acknowledge an alert

    Marks the alert as acknowledged and records the acknowledgment timestamp.
    """
    alert = repo.get_by_id(str(alert_id))
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id {alert_id} not found"
        )

    acknowledged_alert = repo.mark_acknowledged(str(alert_id))
    return AlertResponse.model_validate(acknowledged_alert)


@router.post("/{alert_id}/cancel", response_model=AlertResponse)
@track_performance()
async def cancel_alert(
    alert_id: int,
    repo: AlertRepository = Depends(get_alert_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Cancel a scheduled alert

    Prevents a scheduled alert from being sent. Only works for alerts
    with status 'scheduled'.
    """
    alert = repo.get_by_id(str(alert_id))
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id {alert_id} not found"
        )

    if alert.status != AlertStatus.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel alert with status '{alert.status}'. Only scheduled alerts can be cancelled."
        )

    cancelled_alert = repo.cancel_alert(str(alert_id))
    return AlertResponse.model_validate(cancelled_alert)
