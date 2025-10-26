import torch
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import sessionmaker
import numpy as np
# We don't need the json library anymore

# It's okay to have a separate import section for your own modules
from app.database import engine
from app.db_models import DeliveryPost

# --- Configuration ---
MODEL_NAME = 'all-MiniLM-L6-v2'
# We change the output file to the more efficient .npz format
EMBEDDINGS_FILE_PATH = 'post_embeddings.npz'

def generate_and_save_embeddings():
    """
    Connects to the database, generates embeddings, and saves them efficiently.
    """
    print("Connecting to the database...")
    Session = sessionmaker(bind=engine)
    db_session = Session()

    print("Loading the Sentence-Transformer model...")
    model = SentenceTransformer(MODEL_NAME)

    print("Fetching all delivery posts from the database...")
    all_posts = db_session.query(DeliveryPost).all()

    if not all_posts:
        print("No posts found in the database. Exiting.")
        db_session.close() # Close session before exiting
        return

    print(f"Found {len(all_posts)} posts. Preparing text for embedding...")
    
    texts_to_embed = [
        f"Post Office: {post.office_name}, District: {post.district}, State: {post.state_name}"
        for post in all_posts
    ]

    print("Generating embeddings... (This might take a while, as before)")
    embeddings = model.encode(texts_to_embed, show_progress_bar=True)

    # We need to map each embedding back to its post ID
    post_ids = np.array([post.id for post in all_posts])
    
    print(f"Saving embeddings to {EMBEDDINGS_FILE_PATH} using NumPy...")
    
    # --- THIS IS THE NEW, RELIABLE SAVING METHOD ---
    # np.savez_compressed is designed for saving large arrays efficiently.
    # It saves multiple arrays into a single compressed file.
    np.savez_compressed(
        EMBEDDINGS_FILE_PATH, 
        ids=post_ids, 
        embeddings=embeddings
    )

    db_session.close()
    print("Process complete. Embeddings have been generated and saved successfully!")

if __name__ == "__main__":
    generate_and_save_embeddings()