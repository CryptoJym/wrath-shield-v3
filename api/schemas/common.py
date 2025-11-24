"""
Common API Schemas
Shared Pydantic models used across multiple endpoints
"""

from typing import Generic, TypeVar, List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="System health status")
    uptime_seconds: float = Field(..., description="System uptime in seconds")
    total_operations: int = Field(..., description="Total operations performed")
    total_errors: int = Field(..., description="Total errors encountered")
    success_rate: float = Field(..., description="Overall success rate percentage")
    timestamp: str = Field(..., description="Timestamp of health check")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "healthy",
                "uptime_seconds": 3600.0,
                "total_operations": 1000,
                "total_errors": 5,
                "success_rate": 99.5,
                "timestamp": "2024-01-01T12:00:00Z"
            }
        }
    )


class MetricsResponse(BaseModel):
    """Metrics endpoint response"""
    health: Dict[str, Any] = Field(..., description="Health status")
    performance: Dict[str, Dict[str, Any]] = Field(..., description="Performance metrics")
    errors: Dict[str, Any] = Field(..., description="Error summary")
    counters: Dict[str, int] = Field(..., description="Counter metrics")
    gauges: Dict[str, float] = Field(..., description="Gauge metrics")


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "error": "ValidationError",
                "message": "Invalid request parameters",
                "details": {"field": "user_id", "issue": "must be an integer"},
                "timestamp": "2024-01-01T12:00:00Z"
            }
        }
    )


class PaginationParams(BaseModel):
    """Pagination query parameters"""
    skip: int = Field(0, ge=0, description="Number of records to skip")
    limit: int = Field(100, ge=1, le=1000, description="Maximum number of records to return")


T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""
    items: List[T] = Field(..., description="List of items")
    total: int = Field(..., description="Total number of items")
    skip: int = Field(..., description="Number of items skipped")
    limit: int = Field(..., description="Maximum items per page")
    has_more: bool = Field(..., description="Whether more items are available")

    @classmethod
    def create(cls, items: List[T], total: int, skip: int, limit: int):
        """Create paginated response with calculated has_more"""
        return cls(
            items=items,
            total=total,
            skip=skip,
            limit=limit,
            has_more=skip + len(items) < total
        )
