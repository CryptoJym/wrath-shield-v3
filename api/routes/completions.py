"""
Completion Tracking API Routes
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from datetime import datetime

from api.dependencies import (
    get_completion_repo,
    get_deadline_repo,
    get_request_repo,
    get_alert_repo,
    get_current_user
)
from api.schemas.completions import (
    CompletionCreateRequest,
    CompletionStatsResponse
)
from repositories import CompletionRepository
from completion_tracker import CompletionTracker
from utils.monitoring import track_performance

router = APIRouter(prefix="/api/completions", tags=["completions"])


def get_completion_tracker(
    completion_repo=Depends(get_completion_repo),
    deadline_repo=Depends(get_deadline_repo),
    request_repo=Depends(get_request_repo),
    alert_repo=Depends(get_alert_repo)
) -> CompletionTracker:
    """Get CompletionTracker instance with dependencies"""
    return CompletionTracker(
        completion_repo=completion_repo,
        deadline_repo=deadline_repo,
        request_repo=request_repo,
        alert_repo=alert_repo
    )


@router.post("", status_code=status.HTTP_201_CREATED)
@track_performance()
async def track_completion(
    completion_data: CompletionCreateRequest,
    repo: CompletionRepository = Depends(get_completion_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Track completion of an item

    Records when a deadline or request was completed for analytics.

    Requires:
    - **item_type**: Type of item ('deadline' or 'request')
    - **item_id**: ID of the completed item
    - **user_id**: User who completed it (optional)
    - **completion_notes**: Notes about completion (optional)
    """
    completion = repo.track_completion(
        item_type=completion_data.item_type,
        item_id=completion_data.item_id,
        user_id=completion_data.user_id,
        notes=completion_data.completion_notes
    )

    return {
        "success": True,
        "message": "Completion tracked successfully",
        "completion_id": completion.id
    }


@router.get("/stats", response_model=CompletionStatsResponse)
@track_performance()
async def get_completion_stats(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    start_date: Optional[datetime] = Query(None, description="Start of date range"),
    end_date: Optional[datetime] = Query(None, description="End of date range"),
    repo: CompletionRepository = Depends(get_completion_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Get completion statistics

    Returns completion metrics for analytics and reporting.

    - **user_id**: Filter stats for specific user
    - **start_date**: Start of analysis period
    - **end_date**: End of analysis period

    Returns:
    - Total completions count
    - Breakdown by item type (deadlines vs requests)
    - Completion rate
    - Average completion time
    - Additional metrics
    """
    stats = repo.get_completion_stats(
        user_id=user_id,
        start_date=start_date,
        end_date=end_date
    )

    return CompletionStatsResponse(
        user_id=user_id,
        total_completed=stats.get('total_completed', 0),
        deadlines_completed=stats.get('deadlines_completed', 0),
        requests_completed=stats.get('requests_completed', 0),
        completion_rate=stats.get('completion_rate', 0.0),
        average_completion_time=stats.get('average_completion_time'),
        period_start=start_date,
        period_end=end_date,
        additional_metrics=stats.get('additional_metrics')
    )


@router.get("/recent", response_model=list)
@track_performance()
async def get_recent_completions(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    limit: int = Query(10, ge=1, le=100, description="Number of recent completions"),
    repo: CompletionRepository = Depends(get_completion_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Get recent completions

    Returns the most recent completed items for activity feed.

    - **user_id**: Filter for specific user
    - **limit**: Number of items to return (1-100)
    """
    recent = repo.get_recent_completions(user_id=user_id, limit=limit)

    return [
        {
            'id': c.id,
            'item_type': c.item_type,
            'item_id': c.item_id,
            'user_id': c.user_id,
            'completed_at': c.completed_at,
            'notes': c.notes
        }
        for c in recent
    ]


@router.post("/deadline/{deadline_id}/complete", status_code=status.HTTP_200_OK)
@track_performance()
async def complete_deadline(
    deadline_id: str,
    completion_method: str = Body('manual', description="Completion method"),
    notes: Optional[str] = Body(None, description="Completion notes"),
    verification_source: Optional[str] = Body(None, description="Verification source"),
    confidence_score: Optional[float] = Body(None, description="Confidence score for automatic completions"),
    tracker: CompletionTracker = Depends(get_completion_tracker),
    current_user: dict = Depends(get_current_user)
):
    """
    Complete a deadline

    Marks a deadline as completed and cancels pending alerts.

    - **deadline_id**: ID of the deadline to complete
    - **completion_method**: How it was completed (manual, automatic, email_confirmation, external_api)
    - **notes**: Optional completion notes
    - **verification_source**: Source of verification
    - **confidence_score**: Required for automatic completions (must be >= 0.8)
    """
    try:
        result = tracker.complete_deadline(
            deadline_id=deadline_id,
            user_id=current_user['email'],
            completion_method=completion_method,
            notes=notes,
            verification_source=verification_source,
            confidence_score=confidence_score
        )

        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('message', 'Failed to complete deadline')
            )

        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error completing deadline: {str(e)}"
        )


@router.post("/request/{request_id}/complete", status_code=status.HTTP_200_OK)
@track_performance()
async def complete_request(
    request_id: str,
    completion_method: str = Body('manual', description="Completion method"),
    notes: Optional[str] = Body(None, description="Completion notes"),
    verification_source: Optional[str] = Body(None, description="Verification source"),
    confidence_score: Optional[float] = Body(None, description="Confidence score for automatic completions"),
    tracker: CompletionTracker = Depends(get_completion_tracker),
    current_user: dict = Depends(get_current_user)
):
    """
    Complete a request

    Marks an attorney request as completed.

    - **request_id**: ID of the request to complete
    - **completion_method**: How it was completed
    - **notes**: Optional completion notes
    - **verification_source**: Source of verification
    - **confidence_score**: Required for automatic completions (must be >= 0.8)
    """
    try:
        result = tracker.complete_request(
            request_id=request_id,
            user_id=current_user['email'],
            completion_method=completion_method,
            notes=notes,
            verification_source=verification_source,
            confidence_score=confidence_score
        )

        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('message', 'Failed to complete request')
            )

        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error completing request: {str(e)}"
        )


@router.post("/batch/complete", status_code=status.HTTP_200_OK)
@track_performance()
async def batch_complete_items(
    items: List[dict] = Body(..., description="List of items to complete"),
    completion_method: str = Body('manual', description="Completion method"),
    notes: Optional[str] = Body(None, description="Batch completion notes"),
    tracker: CompletionTracker = Depends(get_completion_tracker),
    current_user: dict = Depends(get_current_user)
):
    """
    Complete multiple items at once

    Batch completion for multiple deadlines and/or requests.

    - **items**: List of dicts with 'type' ('deadline' or 'request') and 'id'
    - **completion_method**: How they were completed
    - **notes**: Optional notes for all items

    Example request body:
    ```json
    {
        "items": [
            {"type": "deadline", "id": "deadline-123"},
            {"type": "request", "id": "request-456"}
        ],
        "completion_method": "manual",
        "notes": "Batch completion after court session"
    }
    ```
    """
    try:
        result = tracker.batch_complete(
            items=items,
            user_id=current_user['email'],
            completion_method=completion_method,
            notes=notes
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in batch completion: {str(e)}"
        )


@router.post("/undo/{completion_id}", status_code=status.HTTP_200_OK)
@track_performance()
async def undo_completion(
    completion_id: str,
    reason: str = Body(..., description="Reason for undoing completion"),
    tracker: CompletionTracker = Depends(get_completion_tracker),
    current_user: dict = Depends(get_current_user)
):
    """
    Undo a completion

    Reverts a completed item back to pending status.

    - **completion_id**: ID of the completion record to undo
    - **reason**: Reason for undoing the completion

    This will:
    1. Mark the item as pending again
    2. Delete the completion record
    3. Recreate alerts for deadlines
    4. Log the undo action in audit trail
    """
    try:
        result = tracker.undo_completion(
            completion_id=completion_id,
            user_id=current_user['email'],
            reason=reason
        )

        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error undoing completion: {str(e)}"
        )


@router.get("/analytics/stats", status_code=status.HTTP_200_OK)
@track_performance()
async def get_analytics_stats(
    start_date: Optional[datetime] = Query(None, description="Start of date range"),
    end_date: Optional[datetime] = Query(None, description="End of date range"),
    item_type: Optional[str] = Query(None, description="Filter by item type"),
    tracker: CompletionTracker = Depends(get_completion_tracker),
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive completion analytics

    Returns detailed statistics and analytics for completions.

    - **start_date**: Start of analysis period (defaults to 30 days ago)
    - **end_date**: End of analysis period (defaults to now)
    - **item_type**: Optional filter ('deadline' or 'request')

    Returns:
    - Total completions
    - Breakdown by type
    - Completion methods distribution
    - Verification sources
    - Deadline-specific stats (on-time rate, late rate, etc.)
    - Activity patterns (time of day, day of week)
    """
    try:
        stats = tracker.get_completion_stats(
            user_id=current_user['email'],
            start_date=start_date,
            end_date=end_date,
            item_type=item_type
        )

        return stats

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting analytics: {str(e)}"
        )
