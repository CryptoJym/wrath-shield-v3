"""
API Middleware
CORS, error handling, logging, and request tracking
"""

import time
import logging
from typing import Callable
from fastapi import Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from utils.exceptions import LegalAdvocateException, get_exception_category
from utils.monitoring import metrics

logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Global error handling middleware

    Catches all unhandled exceptions and returns formatted JSON responses
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            return response
        except LegalAdvocateException as e:
            # Handle custom application exceptions
            logger.error(
                f"Application error: {str(e)}",
                exc_info=True,
                extra={
                    'path': request.url.path,
                    'method': request.method,
                    'error_category': get_exception_category(e),
                    'error_details': e.details
                }
            )

            return JSONResponse(
                status_code=e.status_code if hasattr(e, 'status_code') else status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    'error': type(e).__name__,
                    'message': str(e),
                    'details': e.details if hasattr(e, 'details') else None
                }
            )
        except Exception as e:
            # Handle unexpected exceptions
            logger.error(
                f"Unexpected error: {str(e)}",
                exc_info=True,
                extra={
                    'path': request.url.path,
                    'method': request.method
                }
            )

            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    'error': 'InternalServerError',
                    'message': 'An unexpected error occurred',
                    'details': None
                }
            )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Request logging and performance tracking middleware

    Logs all requests and tracks performance metrics
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(time.time())
        request.state.request_id = request_id

        # Track request start time
        start_time = time.time()

        # Log incoming request
        logger.info(
            f"Incoming request: {request.method} {request.url.path}",
            extra={
                'request_id': request_id,
                'method': request.method,
                'path': request.url.path,
                'query_params': str(request.query_params),
                'client_host': request.client.host if request.client else None
            }
        )

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Record performance metrics
        operation_name = f"{request.method}_{request.url.path}"
        metrics.record_performance(
            operation=operation_name,
            duration=duration,
            success=response.status_code < 400,
            error=f"HTTP {response.status_code}" if response.status_code >= 400 else None
        )

        # Log response
        logger.info(
            f"Request completed: {request.method} {request.url.path}",
            extra={
                'request_id': request_id,
                'method': request.method,
                'path': request.url.path,
                'status_code': response.status_code,
                'duration_ms': round(duration * 1000, 2)
            }
        )

        # Add custom headers
        response.headers['X-Request-ID'] = request_id
        response.headers['X-Response-Time'] = f"{round(duration * 1000, 2)}ms"

        return response


def setup_cors(app):
    """
    Setup CORS middleware

    Args:
        app: FastAPI application instance
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",  # React development
            "http://localhost:5173",  # Vite development
            "http://localhost:8000",  # API docs
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Response-Time"]
    )


def setup_middleware(app):
    """
    Setup all middleware for the application

    Args:
        app: FastAPI application instance
    """
    # Add middlewares in order (they execute in reverse order)
    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    setup_cors(app)
