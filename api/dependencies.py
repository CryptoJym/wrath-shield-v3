"""
API Dependencies
Dependency injection for database sessions, authentication, etc.
"""

import os
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from models.database import get_session
from repositories import (
    DeadlineRepository,
    RequestRepository,
    AlertRepository,
    CaseRepository,
    CompletionRepository
)


# Database session dependency
def get_db() -> Generator[Session, None, None]:
    """
    Get database session for dependency injection

    Yields:
        Database session
    """
    db = get_session()
    try:
        yield db
    finally:
        db.close()


# API Key authentication
def get_api_key(x_api_key: Optional[str] = Header(None)) -> str:
    """
    Validate API key from request header

    Args:
        x_api_key: API key from X-API-Key header

    Returns:
        Validated API key

    Raises:
        HTTPException: If API key is invalid
    """
    expected_key = os.getenv("API_KEY", "dev-key-change-in-production")

    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key",
            headers={"WWW-Authenticate": "X-API-Key"}
        )

    if x_api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )

    return x_api_key


# Repository dependencies
def get_deadline_repo(db: Session = Depends(get_db)) -> DeadlineRepository:
    """Get deadline repository instance"""
    return DeadlineRepository(db)


def get_request_repo(db: Session = Depends(get_db)) -> RequestRepository:
    """Get request repository instance"""
    return RequestRepository(db)


def get_alert_repo(db: Session = Depends(get_db)) -> AlertRepository:
    """Get alert repository instance"""
    return AlertRepository(db)


def get_case_repo(db: Session = Depends(get_db)) -> CaseRepository:
    """Get case repository instance"""
    return CaseRepository(db)


def get_completion_repo(db: Session = Depends(get_db)) -> CompletionRepository:
    """Get completion repository instance"""
    return CompletionRepository(db)


# Optional: User authentication (JWT - for future implementation)
def get_current_user(api_key: str = Depends(get_api_key)) -> dict:
    """
    Get current authenticated user

    This is a placeholder for future JWT-based authentication.
    Currently validates API key only.

    Returns:
        User information dictionary
    """
    # TODO: Implement JWT token validation
    # For now, return a default user
    return {
        "user_id": 1,
        "username": "api_user",
        "role": "admin"
    }
