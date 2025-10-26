from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
import logging

from app.exceptions import (
    PostOfficeNotFoundException,
    InvalidPincodeException,
    DatabaseConnectionException,
    RateLimitExceededException,
    AISearchException
)

logger = logging.getLogger(__name__)

async def post_office_not_found_handler(request: Request, exc: PostOfficeNotFoundException):
    """Handle post office not found errors"""
    logger.warning(f"Post office not found: {exc.pincode} - Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "Post Office Not Found",
            "message": exc.detail,
            "pincode": exc.pincode
        }
    )

async def invalid_pincode_handler(request: Request, exc: InvalidPincodeException):
    """Handle invalid pincode format errors"""
    logger.warning(f"Invalid pincode: {exc.pincode} - Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "Invalid Pincode",
            "message": exc.detail,
            "pincode": exc.pincode
        }
    )

async def database_exception_handler(request: Request, exc: DatabaseConnectionException):
    """Handle database connection errors"""
    logger.error(f"Database error: {exc.detail} - Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "Database Error",
            "message": "Unable to connect to database. Please try again later."
        }
    )

async def rate_limit_handler(request: Request, exc: RateLimitExceededException):
    """Handle rate limit exceeded errors"""
    logger.warning(f"Rate limit exceeded - IP: {request.client.host} - Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "Rate Limit Exceeded",
            "message": exc.detail
        }
    )

async def ai_search_handler(request: Request, exc: AISearchException):
    """Handle AI search errors"""
    logger.error(f"AI search error: {exc.detail} - Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "AI Search Error",
            "message": exc.detail
        }
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors"""
    logger.warning(f"Validation error: {exc.errors()} - Path: {request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "message": "Invalid request data",
            "details": exc.errors()
        }
    )

async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle SQLAlchemy errors"""
    logger.error(f"SQLAlchemy error: {str(exc)} - Path: {request.url.path}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Database Error",
            "message": "An error occurred while accessing the database"
        }
    )

async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other uncaught exceptions"""
    logger.error(f"Unhandled exception: {str(exc)} - Path: {request.url.path}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred. Please try again later."
        }
    )
