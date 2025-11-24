"""
Completion Tracking API Schemas
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class CompletionCreateRequest(BaseModel):
    """Request schema for tracking completion"""
    item_type: str = Field(..., description="Type of item (deadline/request)")
    item_id: int = Field(..., description="ID of completed item")
    user_id: Optional[int] = Field(None, description="User who completed the item")
    completion_notes: Optional[str] = Field(None, description="Notes about completion")


class CompletionStatsResponse(BaseModel):
    """Response schema for completion statistics"""
    user_id: Optional[int] = None
    total_completed: int = Field(..., description="Total items completed")
    deadlines_completed: int = Field(..., description="Deadlines completed")
    requests_completed: int = Field(..., description="Requests completed")
    completion_rate: float = Field(..., description="Completion rate percentage")
    average_completion_time: Optional[float] = Field(None, description="Average completion time in hours")
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    additional_metrics: Optional[Dict[str, Any]] = None
