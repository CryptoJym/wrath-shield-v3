"""
Alert API Schemas
"""

from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from models.schemas import AlertType, AlertStatus, Channel


class AlertBase(BaseModel):
    """Base alert schema"""
    deadline_id: int = Field(..., description="Associated deadline ID")
    alert_type: AlertType = Field(..., description="Type of alert")
    scheduled_time: datetime = Field(..., description="When alert is scheduled")
    channel: Channel = Field(..., description="Notification channel")
    message: str = Field(..., description="Alert message content")


class AlertResponse(AlertBase):
    """Response schema for alert"""
    id: int
    status: AlertStatus
    sent_time: Optional[datetime] = None
    acknowledged_time: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AlertDetailResponse(AlertResponse):
    """Detailed alert response with relationships"""
    pass


class AlertListResponse(BaseModel):
    """List of alerts response"""
    alerts: List[AlertResponse]
    total: int
    skip: int
    limit: int
    has_more: bool

    @classmethod
    def create(cls, alerts: List[AlertResponse], total: int, skip: int, limit: int):
        return cls(
            alerts=alerts,
            total=total,
            skip=skip,
            limit=limit,
            has_more=skip + len(alerts) < total
        )


class AlertAcknowledgeRequest(BaseModel):
    """Request schema for acknowledging an alert"""
    notes: Optional[str] = Field(None, description="Acknowledgment notes")
