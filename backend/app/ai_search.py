import numpy as np
from sentence_transformers import SentenceTransformer, util
import torch
from typing import Set, List, Optional

class SearchService:
    def __init__(self):
        """
        Initializes the search service by loading the AI model and the embeddings data.
        This is done only once when the API server starts up.
        """
        self.model_name = 'all-MiniLM-L6-v2'
        self.embeddings_file = 'post_embeddings.npz'
        
        print("Loading AI model and embeddings data...")
        
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f"Using device: {self.device}")
        
        self.model = SentenceTransformer(self.model_name, device=self.device)
        
        data = np.load(self.embeddings_file)
        self.post_ids = data['ids']
        self.corpus_embeddings = torch.from_numpy(data['embeddings']).to(self.device)
        
        # <--- NEW: Create a mapping from post ID to its index in the embeddings tensor.
        # This is a crucial optimization that allows us to quickly find the right embeddings
        # for a given list of post IDs from the database.
        self.id_to_corpus_idx = {pid: i for i, pid in enumerate(self.post_ids)}
        
        print("AI Search Service is ready.")

    def find_similar(self, query: str, top_k: int = 10, allowed_ids: Optional[Set[int]] = None) -> List[int]:
        """
        Finds the most similar post offices for a given text query.

        Args:
            query (str): The user's search text.
            top_k (int): The number of results to return.
            allowed_ids (Optional[Set[int]]): A set of post IDs to restrict the search to.
                                              If None, searches the entire corpus.
        
        Returns:
            list[int]: A list of post IDs for the most similar results.
        """
        if not query:
            return []
        
        query_embedding = self.model.encode(query, convert_to_tensor=True, device=self.device)

        if allowed_ids:
            # 1. Filter the corpus to only include allowed IDs
            allowed_corpus_indices = [self.id_to_corpus_idx[pid] for pid in allowed_ids if pid in self.id_to_corpus_idx]
            
            if not allowed_corpus_indices:
                return [] 

            sub_corpus = self.corpus_embeddings[allowed_corpus_indices]
            
            # 2. Perform semantic search on this much smaller subset
            hits = util.semantic_search(query_embedding, sub_corpus, top_k=top_k)
            hits = hits[0] 

            # 3. Map the results from the sub-corpus back to the original post IDs
            original_corpus_indices = [allowed_corpus_indices[hit['corpus_id']] for hit in hits]
            # THE FIX: Explicitly convert numpy.int64 to standard python int
            top_post_ids = [int(self.post_ids[idx]) for idx in original_corpus_indices]

        else:
            # This is the original logic, for a non-geospatial search
            hits = util.semantic_search(query_embedding, self.corpus_embeddings, top_k=top_k)
            hits = hits[0]
            top_post_indices = [hit['corpus_id'] for hit in hits]
            top_post_ids = self.post_ids[top_post_indices].tolist()

        return top_post_ids