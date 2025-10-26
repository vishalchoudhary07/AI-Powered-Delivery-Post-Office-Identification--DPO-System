from fastapi import HTTPException, status

class PostOfficeNotFoundException(HTTPException):
    """Raised when a post office is not found"""
    def __init__(self, pincode: str):
        self.pincode = pincode
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post office not found for pincode: {pincode}"
        )

class InvalidPincodeException(HTTPException):
    """Raised when pincode format is invalid"""
    def __init__(self, pincode: str):
        self.pincode = pincode
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid pincode format: {pincode}. Must be 6 digits."
        )

class DatabaseConnectionException(HTTPException):
    """Raised when database connection fails"""
    def __init__(self, detail: str = "Database connection failed"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail
        )

class RateLimitExceededException(HTTPException):
    """Raised when rate limit is exceeded"""
    def __init__(self, detail: str = "Rate limit exceeded. Please try again later."):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail
        )

class AISearchException(HTTPException):
    """Raised when AI search fails"""
    def __init__(self, detail: str = "AI search service unavailable"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail
        )
