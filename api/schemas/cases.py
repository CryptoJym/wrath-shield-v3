"""
Case API Schemas
"""

from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class CaseBase(BaseModel):
    """Base case schema"""
    case_number: str = Field(..., description="Case number")
    case_title: Optional[str] = Field(None, description="Case title")
    case_type: Optional[str] = Field(None, description="Case type (family, civil, criminal, etc.)")
    court_name: Optional[str] = Field(None, description="Court name")
    filing_date: Optional[datetime] = Field(None, description="Filing date")
    status: str = Field(default="active", description="Case status (active, closed, archived)")
    mycase_url: Optional[str] = Field(None, description="MyCase portal URL")
    notes: Optional[str] = Field(None, description="Case notes")


class CaseCreateRequest(CaseBase):
    """Request schema for creating/updating a case"""
    user_id: Optional[str] = Field(None, description="User ID (auto-populated from auth if not provided)")


class CaseUpdateRequest(BaseModel):
    """Request schema for updating a case"""
    case_number: Optional[str] = None
    user_id: Optional[str] = None
    case_title: Optional[str] = None
    case_type: Optional[str] = None
    court_name: Optional[str] = None
    filing_date: Optional[datetime] = None
    status: Optional[str] = None
    mycase_url: Optional[str] = None
    notes: Optional[str] = None


class CaseResponse(CaseBase):
    """Response schema for case"""
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CaseDetailResponse(CaseResponse):
    """Detailed case response with related items"""
    deadline_count: int = 0
    request_count: int = 0
    alert_count: int = 0


class CaseListResponse(BaseModel):
    """List of cases response"""
    cases: List[CaseResponse]
    total: int
    skip: int
    limit: int
    has_more: bool

    @classmethod
    def create(cls, cases: List[CaseResponse], total: int, skip: int, limit: int):
        return cls(
            cases=cases,
            total=total,
            skip=skip,
            limit=limit,
            has_more=skip + len(cases) < total
        )
