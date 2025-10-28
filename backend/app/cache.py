import redis
import json
import logging
from typing import Optional, Any
from functools import wraps

logger = logging.getLogger(__name__)

# Create Redis client
redis_client = redis.Redis(
    host='localhost',
    port=6379,
    db=0,
    decode_responses=True  # Automatically decode responses to strings
)

def test_redis_connection():
    """Test if Redis is connected"""
    try:
        redis_client.ping()
        logger.info("✅ Redis connection successful")
        return True
    except redis.ConnectionError:
        logger.error("❌ Redis connection failed")
        return False

def cache_response(ttl: int = 300, key_prefix: str = "api"):
    """
    Caching decorator for FastAPI endpoints.
    
    Args:
        ttl: Time to live in seconds (default: 5 minutes)
        key_prefix: Prefix for cache keys
    
    Usage:
        @cache_response(ttl=600, key_prefix="pincode")
        async def get_by_pincode(...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract only cacheable query parameters (exclude db, request objects)
            cacheable_params = {
                k: v for k, v in kwargs.items() 
                if k not in ['db', 'request'] and not k.startswith('_')
            }
            
            # Generate cache key from function name and query parameters
            cache_key = f"{key_prefix}:{func.__name__}:{json.dumps(cacheable_params, sort_keys=True)}"
            
            try:
                # Try to get cached response
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"🎯 Cache HIT for key: {cache_key}")
                    return json.loads(cached)
                
                logger.info(f"❌ Cache MISS for key: {cache_key}")
                
            except Exception as e:
                logger.warning(f"Cache GET error: {str(e)}, proceeding without cache")
            
            # Call function if cache miss or error
            response = await func(*args, **kwargs)
            
            try:
                # Store in cache
                redis_client.setex(
                    cache_key,
                    ttl,
                    json.dumps(response, default=str)
                )
                logger.info(f"💾 Cached response for key: {cache_key} (TTL: {ttl}s)")
            except Exception as e:
                logger.warning(f"Cache SET error: {str(e)}, continuing without caching")
            
            return response
        return wrapper
    return decorator


def clear_cache_by_pattern(pattern: str):
    """
    Clear all cache keys matching a pattern.
    
    Args:
        pattern: Redis key pattern (e.g., "pincode:*", "api:*")
    """
    try:
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
            logger.info(f"🗑️ Cleared {len(keys)} cache keys matching pattern: {pattern}")
        return len(keys)
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        return 0

def get_cache_stats():
    """Get Redis cache statistics"""
    try:
        info = redis_client.info()
        return {
            "connected": True,
            "used_memory": info.get('used_memory_human', 'N/A'),
            "total_keys": redis_client.dbsize(),
            "hits": info.get('keyspace_hits', 0),
            "misses": info.get('keyspace_misses', 0),
        }
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        return {"connected": False, "error": str(e)}
