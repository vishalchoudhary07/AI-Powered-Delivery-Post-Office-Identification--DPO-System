# backend/app/ai_search.py

from sentence_transformers import SentenceTransformer
import numpy as np
from functools import lru_cache
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.functions import ST_DWithin
from sqlalchemy import func
from app.db_models import DeliveryPost
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


class SearchService:
    def __init__(self, model_name='all-MiniLM-L6-v2', use_fp16=True):
        """
        Initialize the search service with optimized settings.
        
        Args:
            model_name: The sentence transformer model to use
            use_fp16: Use half precision (FP16) for 2x speed with minimal accuracy loss
        """
        print(f"Loading Sentence Transformer model: {model_name}")
        self.model = SentenceTransformer(model_name)
        
        # Enable FP16 for faster inference (2x speed improvement)
        if use_fp16:
            try:
                self.model = self.model.half()
                print("✓ FP16 optimization enabled")
            except Exception as e:
                print(f"⚠ FP16 optimization failed, using FP32: {e}")
        
        # Load pre-computed embeddings
        self.embeddings = None
        self.post_ids = None
        self.load_embeddings()
    
    def load_embeddings(self):
        """Load pre-computed embeddings from disk"""
        embeddings_file = 'post_embeddings.npz'  
        
        if not os.path.exists(embeddings_file):
            raise FileNotFoundError(
                f"❌ Embeddings file '{embeddings_file}' not found!\n"
                "Please run 'python generate_embeddings.py' first to create embeddings."
            )
        
        try:
            print(f"Loading embeddings from {embeddings_file}...")
            
            data = np.load(embeddings_file)
            self.embeddings = data['embeddings']
            self.post_ids = data['ids']
            
            print(f"✓ Loaded {len(self.post_ids)} post embeddings")
            print(f"✓ Embedding shape: {self.embeddings.shape}")
            print(f"✓ Memory usage: {self.embeddings.nbytes / 1024 / 1024:.2f} MB")
        except Exception as e:
            raise Exception(f"❌ Failed to load embeddings: {e}")
    
    @lru_cache(maxsize=1000)
    def get_query_embedding(self, query: str):
        """
        Get embedding for a query with caching.
        Frequently searched queries are cached for instant results.
        """
        return self.model.encode(query, convert_to_tensor=False)
    
    def find_similar(self, query: str, top_k: int = 100):
        """
        Find most similar posts using cosine similarity.
        
        Args:
            query: The search query text
            top_k: Number of results to return
            
        Returns:
            List of post IDs sorted by similarity
        """
        if not query or not query.strip():
            return []
        
        # Get query embedding (cached if seen before)
        query_embedding = self.get_query_embedding(query.strip())
        
        # Ensure both embeddings use same dtype for comparison
        if self.embeddings.dtype != query_embedding.dtype:
            query_embedding = query_embedding.astype(self.embeddings.dtype)
        
        # Calculate cosine similarity efficiently
        # similarity = (A · B) / (||A|| × ||B||)
        similarities = np.dot(self.embeddings, query_embedding) / (
            np.linalg.norm(self.embeddings, axis=1) * np.linalg.norm(query_embedding)
        )
        
        # Get top K indices (highest similarity first)
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        # Return list of post IDs
        return [int(self.post_ids[i]) for i in top_indices]
    
    def clear_cache(self):
        """Clear the query embedding cache"""
        self.get_query_embedding.cache_clear()
        print("✓ Query cache cleared")


# ========================================
# Initialize search service (singleton)
# ========================================
try:
    search_service = SearchService(use_fp16=True)
    logger.info("✓ AI Search Service initialized successfully")
except Exception as e:
    search_service = None
    logger.error(f"⚠ Failed to initialize AI Search: {e}")


# ========================================
# API Functions for FastAPI endpoints
# ========================================

async def search_posts_by_query(db: AsyncSession, query: str, limit: int = 10) -> List[Dict]:
    """
    AI-powered semantic search for post offices.
    
    Args:
        db: Database session
        query: Search query text
        limit: Maximum number of results
        
    Returns:
        List of post office dictionaries
    """
    if not search_service:
        raise Exception("AI search service is not available. Please generate embeddings first.")
    
    try:
        # Get similar post IDs using AI
        similar_post_ids = search_service.find_similar(query, top_k=limit)
        
        if not similar_post_ids:
            return []
        
        # Fetch posts from database
        result = await db.execute(
            select(DeliveryPost)
            .where(DeliveryPost.id.in_(similar_post_ids))
        )
        posts = result.scalars().all()
        
        # Convert to dict and maintain order
        post_dict = {post.id: post for post in posts}
        ordered_posts = [post_dict[post_id] for post_id in similar_post_ids if post_id in post_dict]
        
        # Convert to response format
        return [
            {
                "id": p.id,
                "office_name": p.office_name,
                "name": p.office_name,
                "pincode": p.pincode,
                "district": p.district,
                "state": p.state_name,
                "state_name": p.state_name,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "office_type": p.office_type,
                "delivery_status": p.delivery_status
            }
            for p in ordered_posts
        ]
    except Exception as e:
        logger.error(f"AI search failed: {e}")
        raise


async def hybrid_search_posts(
    db: AsyncSession,
    query: str,
    user_lat: float,
    user_lon: float,
    radius_km: float = 50,
    limit: int = 10
) -> List[Dict]:
    """
    Hybrid search: AI semantic search + client-side distance filtering.
    """
    if not search_service:
        raise Exception("AI search service is not available.")
    
    try:
        # Get more candidates from AI search
        similar_post_ids = search_service.find_similar(query, top_k=limit * 5)
        
        print(f"🔍 AI found {len(similar_post_ids)} similar post IDs")
        
        if not similar_post_ids:
            return []
        
        # Fetch posts from database (without geospatial filtering)
        result = await db.execute(
            select(DeliveryPost)
            .where(DeliveryPost.id.in_(similar_post_ids))
        )
        posts = result.scalars().all()
        
        print(f"🔍 Database returned {len(posts)} posts")
        
        # Calculate distances and filter client-side
        results_with_distance = []
        for post in posts:
            if post.latitude and post.longitude:
                # Calculate distance using Haversine formula
                from math import radians, cos, sin, asin, sqrt
                
                lon1, lat1, lon2, lat2 = map(radians, [user_lon, user_lat, post.longitude, post.latitude])
                dlon = lon2 - lon1
                dlat = lat2 - lat1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                c = 2 * asin(sqrt(a))
                km = 6371 * c  # Earth radius in kilometers
                
                if km <= radius_km:
                    results_with_distance.append({
                        "id": post.id,
                        "office_name": post.office_name,
                        "name": post.office_name,
                        "pincode": post.pincode,
                        "district": post.district,
                        "state": post.state_name,
                        "state_name": post.state_name,
                        "latitude": post.latitude,
                        "longitude": post.longitude,
                        "office_type": post.office_type,
                        "delivery_status": post.delivery_status,
                        "distance_km": km
                    })
        
        # Sort by distance and return top results
        results_with_distance.sort(key=lambda x: x['distance_km'])
        
        print(f"🔍 After distance filtering: {len(results_with_distance)} posts within {radius_km}km")
        
        return results_with_distance[:limit]
        
    except Exception as e:
        logger.error(f"Hybrid search failed: {e}")
        import traceback
        traceback.print_exc()
        raise

