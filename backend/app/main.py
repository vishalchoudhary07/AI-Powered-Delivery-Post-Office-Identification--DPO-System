from app.cache import cache_response, test_redis_connection, get_cache_stats
from sqlalchemy import select
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
from typing import Optional
from app.db_models import DeliveryPost

from app.database import get_db
from app import crud
from app.logging_config import setup_logging
from app.middleware import log_requests
from app.exceptions import (
    PostOfficeNotFoundException,
    InvalidPincodeException,
    DatabaseConnectionException,
    RateLimitExceededException,
    AISearchException
)
from app.exception_handlers import (
    post_office_not_found_handler,
    invalid_pincode_handler,
    database_exception_handler,
    rate_limit_handler,
    ai_search_handler,
    validation_exception_handler,
    sqlalchemy_exception_handler,
    general_exception_handler
)

# ========================================
# SETUP LOGGING FIRST
# ========================================
logger = setup_logging()

# ========================================
# CREATE FASTAPI APP
# ========================================
app = FastAPI(
    title="DPO System API",
    description="AI-Powered Delivery Post Office Identification System",
    version="1.0.0"
)

# ========================================
# SETUP RATE LIMITER
# ========================================
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# ========================================
# ADD MIDDLEWARE
# ========================================
# Request logging middleware
app.middleware("http")(log_requests)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Your frontend URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)

# ========================================
# REGISTER EXCEPTION HANDLERS
# ========================================
app.add_exception_handler(PostOfficeNotFoundException, post_office_not_found_handler)
app.add_exception_handler(InvalidPincodeException, invalid_pincode_handler)
app.add_exception_handler(DatabaseConnectionException, database_exception_handler)
app.add_exception_handler(RateLimitExceededException, rate_limit_handler)
app.add_exception_handler(AISearchException, ai_search_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_exception_handler(Exception, general_exception_handler)

# ========================================
# STARTUP & SHUTDOWN EVENTS
# ========================================
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 DPO System API starting up...")
    logger.info("📊 Rate limiting: Enabled")
    logger.info("🔒 CORS: Configured")
    logger.info("📝 Logging: Active")
    if test_redis_connection():
        logger.info("💾 Redis caching: Enabled")
    else:
        logger.warning("⚠️ Redis caching: Disabled (connection failed)")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 DPO System API shutting down...")

# ========================================
# API ENDPOINTS
# ========================================

@app.get("/")
async def root():
    """Root endpoint - Health check"""
    logger.info("Health check endpoint called")
    return {
        "message": "DPO System API is running",
        "version": "1.0.0",
        "status": "healthy"
    }

@app.get("/posts")
@limiter.limit("100/minute")  # Simple listing - high limit
async def read_posts(
    request: Request,
    skip: int = 0,
    limit: int = Query(default=100, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """Get all post offices with pagination"""
    try:
        logger.info(f"Fetching posts - skip: {skip}, limit: {limit}")
        posts = await crud.get_posts(db, skip=skip, limit=limit)
        logger.info(f"Successfully fetched {len(posts)} posts")
        return posts
    except SQLAlchemyError as e:
        logger.error(f"Database error in read_posts: {str(e)}")
        raise DatabaseConnectionException("Failed to fetch posts from database")
    except Exception as e:
        logger.error(f"Unexpected error in read_posts: {str(e)}", exc_info=True)
        raise

@app.get("/posts/pincode/{pincode}")
@limiter.limit("100/minute")
@cache_response(ttl=600, key_prefix="pincode")
async def get_post_by_pincode(
    request: Request,
    pincode: str,
    db: AsyncSession = Depends(get_db)
):
    """Get post office by pincode"""
    try:
        # Validate pincode format
        if not pincode.isdigit() or len(pincode) != 6:
            logger.warning(f"Invalid pincode format: {pincode}")
            raise InvalidPincodeException(pincode)
        
        logger.info(f"Searching for pincode: {pincode}")
        post = await crud.get_post_by_pincode(db, pincode=pincode)
        
        if post is None:
            logger.warning(f"Pincode not found: {pincode}")
            raise PostOfficeNotFoundException(pincode)
        
        logger.info(f"Found post office for pincode: {pincode}")
        return post
        
    except (InvalidPincodeException, PostOfficeNotFoundException):
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error in get_post_by_pincode: {str(e)}")
        raise DatabaseConnectionException("Failed to query database")
    except Exception as e:
        logger.error(f"Unexpected error in get_post_by_pincode: {str(e)}", exc_info=True)
        raise

@app.get("/posts/search")
@limiter.limit("30/minute")  # AI search - lower limit (expensive)
async def search_posts(
    request: Request,
    q: str = Query(..., description="Search query"),
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db)
):
    """AI-powered semantic search for post offices"""
    try:
        logger.info(f"AI search query: '{q}' with limit: {limit}")
        
        # Import AI search here to handle errors
        try:
            from app.ai_search import search_posts_by_query
        except ImportError as e:
            logger.error(f"Failed to import AI search module: {str(e)}")
            raise AISearchException("AI search service is currently unavailable")
        
        results = await search_posts_by_query(db, query=q, limit=limit)
        
        logger.info(f"AI search completed - found {len(results)} results for query: '{q}'")
        return results
        
    except AISearchException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error in search_posts: {str(e)}")
        raise DatabaseConnectionException("Failed to perform search")
    except Exception as e:
        logger.error(f"Unexpected error in search_posts: {str(e)}", exc_info=True)
        raise AISearchException(f"Search failed: {str(e)}")
    
@app.get("/posts/fulltext-search")
@limiter.limit("60/minute")
@cache_response(ttl=300, key_prefix="fulltext")  
async def fulltext_search_posts(
    request: Request,
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Lightning-fast full-text search using PostgreSQL GIN index.
    Searches across office names, pincodes, districts, states, divisions, regions, and circles.
    Much faster than AI search for simple text matching.
    
    Examples:
    - /posts/fulltext-search?q=Mumbai
    - /posts/fulltext-search?q=400001
    - /posts/fulltext-search?q=Delhi post office
    """
    try:
        logger.info(f"Full-text search query: '{q}' with limit: {limit}")
        
        results = await crud.fulltext_search_posts(db, query=q, limit=limit)
        
        logger.info(f"Full-text search completed - found {len(results)} results for query: '{q}'")
        
        return {
            "query": q,
            "count": len(results),
            "results": results
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Database error in fulltext_search_posts: {str(e)}")
        raise DatabaseConnectionException("Failed to perform full-text search")
    except Exception as e:
        logger.error(f"Unexpected error in fulltext_search_posts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/posts/hybrid-search")
@limiter.limit("60/minute")  # Geospatial - moderate limit
async def hybrid_search(
    request: Request,
    q: str = Query(..., description="Search query"),
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_km: float = Query(default=50, description="Search radius in kilometers"),
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db)
):
    """Hybrid search combining AI semantic search and geospatial filtering"""
    try:
        logger.info(
            f"Hybrid search - query: '{q}', lat: {lat}, lon: {lon}, "
            f"radius: {radius_km}km, limit: {limit}"
        )
        
        # Import AI search
        try:
            from app.ai_search import hybrid_search_posts
        except ImportError as e:
            logger.error(f"Failed to import AI search module: {str(e)}")
            raise AISearchException("Hybrid search service is currently unavailable")
        
        results = await hybrid_search_posts(
            db=db,
            query=q,
            user_lat=lat,
            user_lon=lon,
            radius_km=radius_km,
            limit=limit
        )
        
        logger.info(f"Hybrid search completed - found {len(results)} results")
        return results
        
    except AISearchException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error in hybrid_search: {str(e)}")
        raise DatabaseConnectionException("Failed to perform hybrid search")
    except Exception as e:
        logger.error(f"Unexpected error in hybrid_search: {str(e)}", exc_info=True)
        raise AISearchException(f"Hybrid search failed: {str(e)}")

@app.get("/posts/nearby")
@limiter.limit("60/minute")  # Geospatial query
async def get_nearby_posts(
    request: Request,
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_km: float = Query(default=10, description="Search radius in kilometers"),
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get post offices within a radius from coordinates"""
    try:
        logger.info(
            f"Nearby search - lat: {lat}, lon: {lon}, "
            f"radius: {radius_km}km, limit: {limit}"
        )
        
        posts = await crud.get_posts_within_radius(
            db=db,
            lat=lat,
            lon=lon,
            radius_km=radius_km,
            limit=limit
        )
        
        logger.info(f"Found {len(posts)} posts within {radius_km}km radius")
        return posts
        
    except SQLAlchemyError as e:
        logger.error(f"Database error in get_nearby_posts: {str(e)}")
        raise DatabaseConnectionException("Failed to query nearby posts")
    except Exception as e:
        logger.error(f"Unexpected error in get_nearby_posts: {str(e)}", exc_info=True)
        raise

# ========================================
# STATS & MONITORING ENDPOINTS
# ========================================
@app.get("/stats")
@limiter.limit("20/minute")
async def get_stats(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get database statistics"""
    try:
        logger.info("Fetching database statistics")
        stats = await crud.get_database_stats(db)
        logger.info("Successfully fetched database statistics")
        return stats
    except SQLAlchemyError as e:
        logger.error(f"Database error in get_stats: {str(e)}")
        raise DatabaseConnectionException("Failed to fetch statistics")
    except Exception as e:
        logger.error(f"Unexpected error in get_stats: {str(e)}", exc_info=True)
        raise

@app.get("/cache/stats")
@limiter.limit("20/minute")
async def get_cache_statistics(request: Request):
    """Get Redis cache statistics"""
    try:
        logger.info("Fetching cache statistics")
        stats = get_cache_stats()
        return stats
    except Exception as e:
        logger.error(f"Error fetching cache stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/locations/states/")
@cache_response(ttl=3600, key_prefix="states")
async def get_states(db: AsyncSession = Depends(get_db)):
    """Get list of all unique states"""
    try:
        result = await db.execute(
            select(DeliveryPost.state_name).distinct().order_by(DeliveryPost.state_name)  
        )
        states = result.scalars().all()
        return {"states": states}
    except Exception as e:
        logger.error(f"Error fetching states: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/locations/districts/")
async def get_districts(state: str, db: AsyncSession = Depends(get_db)):
    """Get districts for a specific state"""
    try:
        result = await db.execute(
            select(DeliveryPost.district)  
            .where(DeliveryPost.state_name == state)  
            .distinct()
            .order_by(DeliveryPost.district)  
        )
        districts = result.scalars().all()
        return {"districts": districts}
    except Exception as e:
        logger.error(f"Error fetching districts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/locations/posts/")
async def get_posts_by_district(
    district: str, 
    skip: int = 0, 
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all post offices in a specific district"""
    try:
        result = await db.execute(
            select(DeliveryPost)  
            .where(DeliveryPost.district == district)  
            .offset(skip)
            .limit(limit)
        )
        posts = result.scalars().all()
        return {"posts": [
            {
                "id": p.id,
                "name": p.office_name,  
                "pincode": p.pincode,
                "district": p.district,
                "state": p.state_name,  
                "latitude": p.latitude,
                "longitude": p.longitude
            } for p in posts
        ], "count": len(posts)}
    except Exception as e:
        logger.error(f"Error fetching posts by district: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))