from sentence_transformers import SentenceTransformer
import numpy as np
from functools import lru_cache
import pickle
import os

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
        embeddings_file = 'post_embeddings.pkl'
        
        if not os.path.exists(embeddings_file):
            raise FileNotFoundError(
                f"❌ Embeddings file '{embeddings_file}' not found!\n"
                "Please run 'python generate_embeddings.py' first to create embeddings."
            )
        
        try:
            print(f"Loading embeddings from {embeddings_file}...")
            with open(embeddings_file, 'rb') as f:
                data = pickle.load(f)
                self.embeddings = data['embeddings']
                self.post_ids = data['post_ids']
            
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
