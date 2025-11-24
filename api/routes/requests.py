"""
Request API Routes
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from api.dependencies import get_request_repo, get_current_user
from api.schemas.requests import (
    RequestListResponse,
    RequestDetailResponse,
    RequestCreateRequest,
    RequestUpdateRequest,
    RequestCompleteRequest,
    RequestResponse
)
from repositories import RequestRepository
from models.schemas import ItemStatus, RequestType, Urgency
from utils.monitoring import track_performance

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.get("", response_model=RequestListResponse)
@track_performance()
async def list_requests(
    status_filter: Optional[ItemStatus] = Query(None, alias="status", description="Filter by status"),
    request_type: Optional[RequestType] = Query(None, description="Filter by request type"),
    urgency: Optional[Urgency] = Query(None, description="Filter by urgency level"),
    case_id: Optional[int] = Query(None, description="Filter by case ID"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    repo: RequestRepository = Depends(get_request_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    List requests with optional filtering

    - **status**: Filter by request status
    - **request_type**: Filter by type (document_request, information_needed, etc.)
    - **urgency**: Filter by urgency (urgent, high, medium, low)
    - **case_id**: Filter by specific case
    - **user_id**: Filter by user
    - **skip**: Pagination offset
    - **limit**: Maximum results per page
    """
    # Build filter dictionary
    filters = {}
    if status_filter:
        filters['status'] = status_filter
    if request_type:
        filters['request_type'] = request_type
    if urgency:
        filters['urgency'] = urgency
    if case_id:
        filters['case_id'] = case_id

    # Get requests with proper pagination
    requests = repo.filter_by(limit=limit, offset=skip, **filters)
    total = repo.count(**filters)

    # Convert to response models
    request_responses = [RequestResponse.model_validate(r) for r in requests]

    return RequestListResponse.create(
        requests=request_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
@track_performance()
async def create_request(
    request_data: RequestCreateRequest,
    repo: RequestRepository = Depends(get_request_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new request

    Requires:
    - **case_id**: Associated case ID
    - **request_type**: Type of request
    - **description**: Description of the request
    - **urgency**: Urgency level
    """
    request = repo.create(request_data.model_dump())
    return RequestResponse.model_validate(request)


@router.get("/{request_id}", response_model=RequestDetailResponse)
@track_performance()
async def get_request(
    request_id: int,
    repo: RequestRepository = Depends(get_request_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific request by ID
    """
    request = repo.get_by_id(str(request_id))
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request with id {request_id} not found"
        )
    return RequestDetailResponse.model_validate(request)


@router.put("/{request_id}", response_model=RequestResponse)
@track_performance()
async def update_request(
    request_id: int,
    request_data: RequestUpdateRequest,
    repo: RequestRepository = Depends(get_request_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Update a request

    All fields are optional. Only provided fields will be updated.
    """
    request = repo.get_by_id(str(request_id))
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request with id {request_id} not found"
        )

    # Filter out None values
    update_data = {k: v for k, v in request_data.model_dump().items() if v is not None}

    updated_request = repo.update(str(request_id), **update_data)
    return RequestResponse.model_validate(updated_request)


@router.post("/{request_id}/complete", response_model=RequestResponse)
@track_performance()
async def complete_request(
    request_id: int,
    completion_data: RequestCompleteRequest,
    repo: RequestRepository = Depends(get_request_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a request as completed

    Sets status to 'completed' and records completion timestamp
    """
    request = repo.get_by_id(str(request_id))
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request with id {request_id} not found"
        )

    # Update with completion notes if provided
    update_data = {'status': ItemStatus.COMPLETED}
    if completion_data.notes:
        update_data['notes'] = completion_data.notes

    completed_request = repo.mark_completed(request_id)
    return RequestResponse.model_validate(completed_request)
