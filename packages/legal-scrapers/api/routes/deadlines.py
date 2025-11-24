"""
Deadline API Routes
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime

from api.dependencies import get_deadline_repo, get_current_user
from api.schemas.deadlines import (
    DeadlineListResponse,
    DeadlineDetailResponse,
    DeadlineCreateRequest,
    DeadlineUpdateRequest,
    DeadlineResponse
)
from repositories import DeadlineRepository
from models.schemas import ItemStatus, DeadlineType
from utils.monitoring import track_performance

router = APIRouter(prefix="/api/deadlines", tags=["deadlines"])


@router.get("", response_model=DeadlineListResponse)
@track_performance()
async def list_deadlines(
    status_filter: Optional[ItemStatus] = Query(None, alias="status", description="Filter by status"),
    deadline_type: Optional[DeadlineType] = Query(None, description="Filter by deadline type"),
    case_id: Optional[int] = Query(None, description="Filter by case ID"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    due_after: Optional[datetime] = Query(None, description="Filter deadlines due after this date"),
    due_before: Optional[datetime] = Query(None, description="Filter deadlines due before this date"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    repo: DeadlineRepository = Depends(get_deadline_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    List deadlines with optional filtering

    - **status**: Filter by deadline status (pending, completed, cancelled)
    - **deadline_type**: Filter by type (court_filing, response_deadline, etc.)
    - **case_id**: Filter by specific case
    - **user_id**: Filter by user (if multi-user system)
    - **due_after**: Show deadlines due after this date
    - **due_before**: Show deadlines due before this date
    - **skip**: Pagination offset
    - **limit**: Maximum results per page
    """
    # Build filter dictionary
    filters = {}
    if status_filter:
        filters['status'] = status_filter
    if deadline_type:
        filters['deadline_type'] = deadline_type
    if case_id:
        filters['case_id'] = case_id

    # Get deadlines with proper pagination
    deadlines = repo.filter_by(limit=limit, offset=skip, **filters)
    total = repo.count(**filters)

    # Apply date filters
    if due_after or due_before:
        filtered_deadlines = []
        for deadline in deadlines:
            if due_after and deadline.due_date < due_after:
                continue
            if due_before and deadline.due_date > due_before:
                continue
            filtered_deadlines.append(deadline)
        deadlines = filtered_deadlines

    # Convert to response models
    deadline_responses = [DeadlineResponse.model_validate(d) for d in deadlines]

    return DeadlineListResponse.create(
        deadlines=deadline_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("", response_model=DeadlineResponse, status_code=status.HTTP_201_CREATED)
@track_performance()
async def create_deadline(
    deadline_data: DeadlineCreateRequest,
    repo: DeadlineRepository = Depends(get_deadline_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new deadline

    Requires:
    - **case_id**: Associated case ID
    - **deadline_type**: Type of deadline
    - **due_date**: When the deadline is due
    - **description**: Description of the deadline
    - **responsible_party**: Who is responsible
    """
    deadline = repo.create(deadline_data.model_dump())
    return DeadlineResponse.model_validate(deadline)


@router.get("/{deadline_id}", response_model=DeadlineDetailResponse)
@track_performance()
async def get_deadline(
    deadline_id: int,
    repo: DeadlineRepository = Depends(get_deadline_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific deadline by ID
    """
    deadline = repo.get_by_id(str(deadline_id))
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deadline with id {deadline_id} not found"
        )
    return DeadlineDetailResponse.model_validate(deadline)


@router.put("/{deadline_id}", response_model=DeadlineResponse)
@track_performance()
async def update_deadline(
    deadline_id: int,
    deadline_data: DeadlineUpdateRequest,
    repo: DeadlineRepository = Depends(get_deadline_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Update a deadline

    All fields are optional. Only provided fields will be updated.
    """
    deadline = repo.get_by_id(str(deadline_id))
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deadline with id {deadline_id} not found"
        )

    # Filter out None values
    update_data = {k: v for k, v in deadline_data.model_dump().items() if v is not None}

    updated_deadline = repo.update(str(deadline_id), **update_data)
    return DeadlineResponse.model_validate(updated_deadline)


@router.delete("/{deadline_id}", status_code=status.HTTP_204_NO_CONTENT)
@track_performance()
async def delete_deadline(
    deadline_id: int,
    repo: DeadlineRepository = Depends(get_deadline_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a deadline

    Note: This permanently removes the deadline from the database.
    Consider using status update to 'cancelled' instead.
    """
    deadline = repo.get_by_id(str(deadline_id))
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deadline with id {deadline_id} not found"
        )

    repo.delete(str(deadline_id))
    return None


@router.post("/{deadline_id}/complete", response_model=DeadlineResponse)
@track_performance()
async def complete_deadline(
    deadline_id: int,
    repo: DeadlineRepository = Depends(get_deadline_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a deadline as completed

    Sets status to 'completed' and records completion timestamp
    """
    deadline = repo.get_by_id(str(deadline_id))
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deadline with id {deadline_id} not found"
        )

    completed_deadline = repo.mark_completed(str(deadline_id))
    return DeadlineResponse.model_validate(completed_deadline)
