from sentence_transformers import SentenceTransformer
import pickle
import numpy as np
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

def generate_embeddings():
    """
    Generate and save embeddings for all posts with optimization.
    Uses FP16 for smaller file size and faster loading.
    """
    print("=" * 60)
    print("GENERATING OPTIMIZED EMBEDDINGS FOR DPO SYSTEM")
    print("=" * 60)
    
    # Database connection
    DATABASE_URL = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    
    print("\n1. Connecting to database...")
    engine = create_engine(DATABASE_URL)
    
    print("2. Fetching posts from database...")
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT id, office_name, district, state_name FROM delivery_posts ORDER BY id")
        )
        posts = result.fetchall()
    
    print(f"✓ Found {len(posts)} posts")
    
    print("\n3. Loading Sentence Transformer model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Enable FP16 for faster encoding
    try:
        model = model.half()
        print("✓ FP16 optimization enabled")
    except Exception as e:
        print(f"⚠ FP16 optimization failed, using FP32: {e}")
    
    print("\n4. Preparing text for embedding generation...")
    # Combine relevant fields for better search results
    texts = [
        f"{post.office_name} {post.district} {post.state_name}" 
        for post in posts
    ]
    post_ids = [post.id for post in posts]
    
    print(f"✓ Prepared {len(texts)} text entries")
    
    print("\n5. Generating embeddings (this may take a few minutes)...")
    embeddings = model.encode(
        texts,
        batch_size=32,              # Process 32 texts at a time
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True   # Normalize for cosine similarity
    )
    
    # Convert to FP16 to reduce file size by 50%
    print("\n6. Converting to FP16 for storage optimization...")
    embeddings_fp16 = embeddings.astype(np.float16)
    
    # Calculate size reduction
    original_size = embeddings.nbytes / 1024 / 1024
    compressed_size = embeddings_fp16.nbytes / 1024 / 1024
    
    print(f"✓ Original size: {original_size:.2f} MB")
    print(f"✓ Compressed size: {compressed_size:.2f} MB")
    print(f"✓ Space saved: {original_size - compressed_size:.2f} MB ({(1 - compressed_size/original_size)*100:.1f}%)")
    
    print("\n7. Saving embeddings to disk...")
    with open('post_embeddings.pkl', 'wb') as f:
        pickle.dump({
            'embeddings': embeddings_fp16,
            'post_ids': post_ids,
            'model_name': 'all-MiniLM-L6-v2',
            'embedding_dim': embeddings.shape[1]
        }, f)
    
    file_size = os.path.getsize('post_embeddings.pkl') / 1024 / 1024
    
    print("\n" + "=" * 60)
    print("✅ EMBEDDINGS GENERATED SUCCESSFULLY!")
    print("=" * 60)
    print(f"📊 Total posts: {len(post_ids)}")
    print(f"📐 Embedding dimension: {embeddings.shape[1]}")
    print(f"💾 File size: {file_size:.2f} MB")
    print(f"📁 Saved to: post_embeddings.pkl")
    print("=" * 60)

if __name__ == "__main__":
    try:
        generate_embeddings()
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
