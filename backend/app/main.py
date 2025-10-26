from sqlalchemy import distinct
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import FastAPI, Depends, HTTPException, Request
from typing import List
from geopy.distance import great_circle

# --- CORS MIDDLEWARE ---
from fastapi.middleware.cors import CORSMiddleware

# --- RATE LIMITING ---
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from . import crud, db_models, schemas
from .database import get_db
from .ai_search import SearchService

# Initialize search service
search_service = SearchService()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="AI-Powered Delivery Post Identification System API")

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS CONFIGURATION ---
origins = [
    "http://localhost:3000",  # React frontend
    "http://localhost:3001",  # Backup port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- END OF CORS CONFIGURATION ---


@app.get("/")
async def read_root():
    return {"message": "Welcome to the Delivery Post Identification API!"}


@app.get("/posts/", response_model=List[schemas.DeliveryPost])
@limiter.limit("100/minute")
async def read_posts(
    request: Request,
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db)
):
    posts = await crud.get_posts(db, skip=skip, limit=limit)
    return posts


@app.get("/posts/nearby/", response_model=List[schemas.DeliveryPost])
@limiter.limit("60/minute")
async def read_nearby_posts(
    request: Request,
    lat: float, 
    lon: float, 
    max_distance_km: int = 5, 
    db: AsyncSession = Depends(get_db)
):
    posts = await crud.get_nearest_posts(db, lat=lat, lon=lon, max_distance_km=max_distance_km)
    return posts


@app.get("/posts/search/", response_model=List[schemas.DeliveryPost])
@limiter.limit("30/minute")
async def search_posts(
    request: Request,
    q: str, 
    db: AsyncSession = Depends(get_db)
):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")
    
    post_ids = search_service.find_similar(query=q)
    if not post_ids:
        return []
    
    results = await crud.get_posts_by_ids(db, ids=post_ids)
    id_to_result_map = {result.id: result for result in results}
    sorted_results = [id_to_result_map[id] for id in post_ids if id in id_to_result_map]
    return sorted_results


@app.get("/posts/hybrid-search/", response_model=List[schemas.HybridSearchResult])
@limiter.limit("30/minute")
async def search_posts_hybrid(
    request: Request,
    q: str, 
    lat: float, 
    lon: float, 
    db: AsyncSession = Depends(get_db)
):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")

    # 1. Get candidate IDs from AI search
    candidate_ids = search_service.find_similar(query=q, top_k=100)
    if not candidate_ids:
        return []

    # 2. Fetch the full post objects from the database
    candidates = await crud.get_posts_by_ids(db, ids=candidate_ids)
    user_location = (lat, lon)
    
    ranked_results = []
    for post in candidates:
        if post.latitude and post.longitude:
            post_location = (post.latitude, post.longitude)
            distance = great_circle(user_location, post_location).kilometers

            # Calculate hybrid score
            distance_score = 1 / (distance + 1)
            try:
                text_rank = candidate_ids.index(post.id)
                text_score = 1 / (text_rank + 1)
            except ValueError:
                text_score = 0
            hybrid_score = text_score * distance_score

            ranked_results.append({
                "post": post,
                "score": hybrid_score,
                "distance": distance
            })

    ranked_results.sort(key=lambda x: x["score"], reverse=True)

    # 3. Format the final result to match the HybridSearchResult schema
    final_results = []
    for item in ranked_results[:15]:
        post_data = item["post"]
        result_with_distance = schemas.HybridSearchResult(
            **post_data.__dict__,
            distance_km=item["distance"]
        )
        final_results.append(result_with_distance)

    return final_results


@app.get("/locations/states/", response_model=List[str])
@limiter.limit("100/minute")
async def get_all_states(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns a sorted list of all unique states in the database.
    """
    from sqlalchemy import select
    
    result = await db.execute(
        select(db_models.DeliveryPost.state_name)
        .distinct()
        .order_by(db_models.DeliveryPost.state_name)
    )
    states = result.scalars().all()
    return [state for state in states if state is not None]


@app.get("/locations/districts/", response_model=List[str])
@limiter.limit("100/minute")
async def get_districts_for_state(
    request: Request,
    state: str, 
    db: AsyncSession = Depends(get_db)
):
    """
    Returns a sorted list of unique districts for a given state.
    """
    from sqlalchemy import select
    
    result = await db.execute(
        select(db_models.DeliveryPost.district)
        .where(db_models.DeliveryPost.state_name == state)
        .distinct()
        .order_by(db_models.DeliveryPost.district)
    )
    districts = result.scalars().all()
    return [district for district in districts if district is not None]


@app.get("/locations/posts/", response_model=List[schemas.DeliveryPost])
@limiter.limit("100/minute")
async def get_posts_for_district(
    request: Request,
    district: str, 
    db: AsyncSession = Depends(get_db)
):
    """
    Returns a sorted list of all post offices for a given district.
    """
    from sqlalchemy import select
    
    result = await db.execute(
        select(db_models.DeliveryPost)
        .where(db_models.DeliveryPost.district == district)
        .order_by(db_models.DeliveryPost.office_name)
    )
    posts = result.scalars().all()
    return posts
