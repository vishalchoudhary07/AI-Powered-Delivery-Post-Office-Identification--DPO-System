from fastapi import Request
import logging
import time

logger = logging.getLogger(__name__)

async def log_requests(request: Request, call_next):
    """Middleware to log all incoming requests and responses"""
    
    # Start timing
    start_time = time.time()
    
    # Log incoming request
    logger.info(
        f"Incoming request - Method: {request.method} "
        f"Path: {request.url.path} "
        f"Client: {request.client.host if request.client else 'Unknown'}"
    )
    
    # Process request
    try:
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Log response
        logger.info(
            f"Request completed - Method: {request.method} "
            f"Path: {request.url.path} "
            f"Status: {response.status_code} "
            f"Duration: {process_time:.3f}s"
        )
        
        # Add custom header with processing time
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
        
    except Exception as e:
        # Log error
        process_time = time.time() - start_time
        logger.error(
            f"Request failed - Method: {request.method} "
            f"Path: {request.url.path} "
            f"Duration: {process_time:.3f}s "
            f"Error: {str(e)}",
            exc_info=True
        )
        raise
