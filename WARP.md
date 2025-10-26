# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

AI-Powered Delivery Post Identification System - A full-stack application for finding Indian postal delivery offices using semantic search, geospatial queries, and interactive mapping.

**Stack:**
- **Backend:** FastAPI (Python), PostgreSQL with PostGIS extension, SQLAlchemy ORM
- **Frontend:** Next.js 15 (React 19), Mapbox GL / MapTiler
- **AI/ML:** Sentence Transformers (`all-MiniLM-L6-v2` model) for semantic search

## Development Commands

### Backend (Python/FastAPI)

```powershell
# Navigate to backend
cd backend

# Create and activate virtual environment (first time)
python -m venv venv
.\venv\Scripts\Activate.ps1  # On Windows PowerShell
# source venv/bin/activate    # On Unix/Linux

# Install dependencies
pip install -r requirements.txt

# Start development server (from backend directory)
# Note: Uses uvicorn with auto-reload
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Load initial data into PostgreSQL
python scripts\load_data.py

# Generate embeddings for semantic search
python generate_embeddings.py
```

### Frontend (Next.js)

```powershell
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev  # Runs on http://localhost:3000

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Environment Setup

**Backend** requires `backend\.env`:
```
DB_USER=your_postgres_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
```

**Frontend** requires `frontend\.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAPTILER_KEY=your_maptiler_api_key
```

## Architecture

### Backend Architecture

**Layer Structure:**
- **API Layer** (`app/main.py`): FastAPI endpoints with CORS middleware
- **Database Layer** (`app/database.py`): SQLAlchemy engine and session management
- **Models Layer**: 
  - `app/db_models.py`: SQLAlchemy ORM models (e.g., `DeliveryPost`)
  - `app/schemas.py`: Pydantic models for request/response validation
- **Business Logic** (`app/crud.py`): Database operations including PostGIS spatial queries
- **AI Search Service** (`app/ai_search.py`): Singleton service for semantic similarity search

**Key Backend Patterns:**

1. **Geospatial Queries**: Uses PostGIS `Geography` type with SRID 4326 for accurate distance calculations. The `location` column enables spatial indexing via `ST_DWithin` for efficient radius searches.

2. **Semantic Search Flow**:
   - Embeddings are pre-generated offline (`generate_embeddings.py`) and stored as `.npz` files
   - `SearchService` loads embeddings into memory on startup and uses sentence-transformers for query encoding
   - Similarity computed using cosine similarity via `util.semantic_search`
   - Supports filtering by allowed IDs for hybrid search scenarios

3. **Hybrid Search**: Combines semantic similarity (via AI embeddings) with geospatial distance to rank results. Formula: `hybrid_score = text_score * distance_score` where `distance_score = 1/(distance + 1)`.

4. **Database Session Management**: Uses FastAPI's dependency injection (`Depends(get_db)`) for proper session lifecycle.

### Frontend Architecture

**Component Structure:**
- `src/app/page.js`: Main application with two modes (Search/Browse)
- `src/components/MapComponent.js`: Interactive map with Mapbox GL, dynamic markers, and style switching

**Key Frontend Patterns:**

1. **Dynamic Imports**: `MapComponent` loaded client-side only (`ssr: false`) due to Mapbox GL requiring browser APIs.

2. **State Management**:
   - Search mode: Real-time debounced queries (500ms) to hybrid search endpoint
   - Browse mode: Hierarchical navigation (State → District → Post offices)
   - Both modes calculate client-side distance if user location available

3. **API Integration**: All backend calls use `NEXT_PUBLIC_API_URL` environment variable. Endpoints return Pydantic-validated schemas.

4. **Map Features**:
   - Multiple base map styles (Streets/Satellite/Terrain)
   - Dynamic marker colors (selected post is red, others blue)
   - Auto-generated popups with all post office details
   - Flyto animation on selection

### Data Flow

1. **Initial Setup**:
   - CSV data loaded via `scripts/load_data.py` with coordinate cleaning/validation
   - PostGIS geography column created using `ST_SetSRID(ST_MakePoint(lon, lat), 4326)`
   - Embeddings generated for all posts: `"Post Office: {name}, District: {district}, State: {state}"`

2. **Search Request**:
   ```
   User Query → Frontend debounce → /posts/hybrid-search/ endpoint
   → SearchService.find_similar() (returns top 100 IDs)
   → crud.get_posts_by_ids() (fetches full records)
   → Hybrid scoring (text rank × geo distance)
   → Top 15 results → Frontend renders + map markers
   ```

3. **Browse Request**:
   ```
   State selection → /locations/districts/?state={state}
   → District selection → /locations/posts/?district={district}
   → Frontend calculates distances (if location available)
   → Render list + map markers
   ```

### Database Schema

**Table: `delivery_posts`**
- Primary key: `id` (Integer, indexed)
- Text fields: `office_name`, `office_type`, `district`, `state_name`, etc.
- Numeric: `pincode` (Integer), `latitude`, `longitude` (Double)
- **Spatial**: `location` (PostGIS Geography with POINT geometry, SRID 4326) - enables spatial indexing

**Important**: The `location` column is critical for performance - PostGIS spatial index makes radius queries extremely fast even on large datasets.

## Project-Specific Notes

- **Coordinate Cleaning**: The `load_data.py` script removes directional indicators (N/S/E/W) from coordinates using regex before conversion to numeric type
- **Embeddings are Precomputed**: Changes to post office data require regenerating embeddings via `generate_embeddings.py`
- **AI Model Device**: `SearchService` automatically uses CUDA if available, falls back to CPU
- **CORS**: Backend explicitly allows `http://localhost:3000` for local development
- **Windows-Specific**: Commands shown use PowerShell syntax; adjust for other shells/OS as needed
