"""
Deadline API Schemas
"""

from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from models.schemas import DeadlineType, ResponsibleParty, ItemStatus


class DeadlineBase(BaseModel):
    """Base deadline schema"""
    case_id: int = Field(..., description="Associated case ID")
    deadline_type: DeadlineType = Field(..., description="Type of deadline")
    due_date: datetime = Field(..., description="Deadline due date")
    description: str = Field(..., description="Deadline description")
    responsible_party: ResponsibleParty = Field(..., description="Who is responsible")
    notes: Optional[str] = Field(None, description="Additional notes")


class DeadlineCreateRequest(DeadlineBase):
    """Request schema for creating a deadline"""
    pass


class DeadlineUpdateRequest(BaseModel):
    """Request schema for updating a deadline"""
    deadline_type: Optional[DeadlineType] = None
    due_date: Optional[datetime] = None
    description: Optional[str] = None
    responsible_party: Optional[ResponsibleParty] = None
    status: Optional[ItemStatus] = None
    notes: Optional[str] = None
    completed_date: Optional[datetime] = None


class DeadlineResponse(DeadlineBase):
    """Response schema for deadline"""
    id: int
    status: ItemStatus
    created_date: datetime
    completed_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DeadlineDetailResponse(DeadlineResponse):
    """Detailed deadline response with relationships"""
    # Can include related alerts, case details, etc.
    pass


class DeadlineListResponse(BaseModel):
    """List of deadlines response"""
    deadlines: List[DeadlineResponse]
    total: int
    skip: int
    limit: int
    has_more: bool

    @classmethod
    def create(cls, deadlines: List[DeadlineResponse], total: int, skip: int, limit: int):
        return cls(
            deadlines=deadlines,
            total=total,
            skip=skip,
            limit=limit,
            has_more=skip + len(deadlines) < total
        )
