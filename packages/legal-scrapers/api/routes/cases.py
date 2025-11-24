"""
Case API Routes
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from api.dependencies import get_case_repo, get_current_user
from api.schemas.cases import (
    CaseListResponse,
    CaseDetailResponse,
    CaseCreateRequest,
    CaseUpdateRequest,
    CaseResponse
)
from repositories import CaseRepository
from utils.monitoring import track_performance

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.get("", response_model=CaseListResponse)
@track_performance()
async def list_cases(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by case status"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    repo: CaseRepository = Depends(get_case_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    List cases with optional filtering

    - **status**: Filter by case status (active, closed, pending, etc.)
    - **user_id**: Filter by user
    - **skip**: Pagination offset
    - **limit**: Maximum results per page
    """
    # Build filter dictionary
    filters = {}
    if status_filter:
        filters['status'] = status_filter

    # Get cases with proper pagination
    cases = repo.filter_by(limit=limit, offset=skip, **filters)
    total = repo.count(**filters)

    # Convert to response models
    case_responses = [CaseResponse.model_validate(c) for c in cases]

    return CaseListResponse.create(
        cases=case_responses,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
@track_performance()
async def create_case(
    case_data: CaseCreateRequest,
    repo: CaseRepository = Depends(get_case_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new case

    Requires:
    - **case_number**: Unique case number
    - **title**: Case title
    - **status**: Case status
    """
    # Check if case number already exists
    existing_case = repo.get_by_case_number(case_data.case_number)
    if existing_case:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Case with case_number '{case_data.case_number}' already exists"
        )

    # Prepare data and auto-populate user_id if not provided
    case_dict = case_data.model_dump()
    if not case_dict.get('user_id'):
        case_dict['user_id'] = str(current_user.get('user_id', 'api_user'))

    case = repo.create(**case_dict)
    return CaseResponse.model_validate(case)


@router.get("/{case_id}", response_model=CaseDetailResponse)
@track_performance()
async def get_case(
    case_id: int,
    repo: CaseRepository = Depends(get_case_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific case by ID with related items count
    """
    case = repo.get_by_id(str(case_id))
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {case_id} not found"
        )

    # Get related item counts (these methods need to be added to repository)
    deadline_count = 0  # TODO: Implement count_deadlines in repository
    request_count = 0   # TODO: Implement count_requests in repository
    alert_count = 0     # TODO: Implement count_alerts in repository

    # Create detailed response
    case_dict = CaseResponse.model_validate(case).model_dump()
    case_dict.update({
        'deadline_count': deadline_count,
        'request_count': request_count,
        'alert_count': alert_count
    })

    return CaseDetailResponse(**case_dict)


@router.put("/{case_id}", response_model=CaseResponse)
@track_performance()
async def update_case(
    case_id: int,
    case_data: CaseUpdateRequest,
    repo: CaseRepository = Depends(get_case_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Update a case

    All fields are optional. Only provided fields will be updated.
    """
    case = repo.get_by_id(str(case_id))
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with id {case_id} not found"
        )

    # Filter out None values
    update_data = {k: v for k, v in case_data.model_dump().items() if v is not None}

    # Check for case_number conflict if updating case_number
    if 'case_number' in update_data:
        existing_case = repo.get_by_case_number(update_data['case_number'])
        if existing_case and existing_case.id != str(case_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Case with case_number '{update_data['case_number']}' already exists"
            )

    updated_case = repo.update(str(case_id), **update_data)
    return CaseResponse.model_validate(updated_case)
