from sqlalchemy import distinct
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from geopy.distance import great_circle

# --- NEW IMPORT FOR CORS ---
from fastapi.middleware.cors import CORSMiddleware

from . import crud, db_models, schemas
from .database import SessionLocal, engine
from .ai_search import SearchService

db_models.Base.metadata.create_all(bind=engine)
search_service = SearchService()
app = FastAPI(title="AI-Powered Delivery Post Identification System API")

# --- NEW: CORS MIDDLEWARE CONFIGURATION ---
# This is the list of origins that are allowed to make requests to our API.
origins = [
    "http://localhost:3000",  # The address of our React frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)
# --- END OF CORS CONFIGURATION ---


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to the Delivery Post Identification API!"}

# ... (the rest of your endpoint functions remain exactly the same) ...

@app.get("/posts/", response_model=List[schemas.DeliveryPost])
def read_posts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    posts = crud.get_posts(db, skip=skip, limit=limit)
    return posts

@app.get("/posts/nearby/", response_model=List[schemas.DeliveryPost])
def read_nearby_posts(lat: float, lon: float, max_distance_km: int = 5, db: Session = Depends(get_db)):
    posts = crud.get_nearest_posts(db, lat=lat, lon=lon, max_distance_km=max_distance_km)
    return posts

@app.get("/posts/search/", response_model=List[schemas.DeliveryPost])
def search_posts(q: str, db: Session = Depends(get_db)):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")
    post_ids = search_service.find_similar(query=q)
    if not post_ids:
        return []
    results = crud.get_posts_by_ids(db, ids=post_ids)
    id_to_result_map = {result.id: result for result in results}
    sorted_results = [id_to_result_map[id] for id in post_ids if id in id_to_result_map]
    return sorted_results

@app.get("/posts/hybrid-search/", response_model=List[schemas.HybridSearchResult])
def search_posts_hybrid(q: str, lat: float, lon: float, db: Session = Depends(get_db)):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")

    # 1. USE THE CORRECT search_service to get candidate IDs
    candidate_ids = search_service.find_similar(query=q, top_k=100)
    if not candidate_ids:
        return []

    # 2. Fetch the full post objects from the database
    candidates = crud.get_posts_by_ids(db, ids=candidate_ids)
    user_location = (lat, lon)
    
    ranked_results = []
    for post in candidates:
        if post.latitude and post.longitude:
            post_location = (post.latitude, post.longitude)
            distance = great_circle(user_location, post_location).kilometers

            # This is your excellent scoring logic from before
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
def get_all_states(db: Session = Depends(get_db)):
    """
    Returns a sorted list of all unique states in the database.
    """
    # CHANGED: db_models.Post -> db_models.DeliveryPost
    states_query = db.query(distinct(db_models.DeliveryPost.state_name)).order_by(db_models.DeliveryPost.state_name).all()
    return [state[0] for state in states_query if state[0] is not None]


@app.get("/locations/districts/", response_model=List[str])
def get_districts_for_state(state: str, db: Session = Depends(get_db)):
    """
    Returns a sorted list of unique districts for a given state.
    """
    # CHANGED: db_models.Post -> db_models.DeliveryPost
    districts_query = db.query(distinct(db_models.DeliveryPost.district)) \
                        .filter(db_models.DeliveryPost.state_name == state) \
                        .order_by(db_models.DeliveryPost.district).all()
    return [district[0] for district in districts_query if district[0] is not None]


@app.get("/locations/posts/", response_model=List[schemas.DeliveryPost])
def get_posts_for_district(district: str, db: Session = Depends(get_db)):
    """
    Returns a sorted list of all post offices for a given district.
    """
    # CHANGED: db_models.Post -> db_models.DeliveryPost
    posts = db.query(db_models.DeliveryPost) \
              .filter(db_models.DeliveryPost.district == district) \
              .order_by(db_models.DeliveryPost.office_name).all()
    return posts