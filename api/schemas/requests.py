"""
Request API Schemas
"""

from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from models.schemas import RequestType, Urgency, ItemStatus


class RequestBase(BaseModel):
    """Base request schema"""
    case_id: int = Field(..., description="Associated case ID")
    request_type: RequestType = Field(..., description="Type of request")
    description: str = Field(..., description="Request description")
    urgency: Urgency = Field(..., description="Request urgency level")
    notes: Optional[str] = Field(None, description="Additional notes")


class RequestCreateRequest(RequestBase):
    """Request schema for creating a request"""
    pass


class RequestUpdateRequest(BaseModel):
    """Request schema for updating a request"""
    request_type: Optional[RequestType] = None
    description: Optional[str] = None
    urgency: Optional[Urgency] = None
    status: Optional[ItemStatus] = None
    notes: Optional[str] = None
    completed_date: Optional[datetime] = None


class RequestCompleteRequest(BaseModel):
    """Request schema for completing a request"""
    notes: Optional[str] = Field(None, description="Completion notes")


class RequestResponse(RequestBase):
    """Response schema for request"""
    id: int
    status: ItemStatus
    created_date: datetime
    completed_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RequestDetailResponse(RequestResponse):
    """Detailed request response with relationships"""
    pass


class RequestListResponse(BaseModel):
    """List of requests response"""
    requests: List[RequestResponse]
    total: int
    skip: int
    limit: int
    has_more: bool

    @classmethod
    def create(cls, requests: List[RequestResponse], total: int, skip: int, limit: int):
        return cls(
            requests=requests,
            total=total,
            skip=skip,
            limit=limit,
            has_more=skip + len(requests) < total
        )
