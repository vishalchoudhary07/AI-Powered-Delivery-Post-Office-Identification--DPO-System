# 🏤 AI-Powered Delivery Post Office Identification System

An intelligent full-stack application for finding Indian postal delivery offices using **semantic search**, **geospatial queries**, and **interactive mapping**. Built with modern technologies and AI-powered search capabilities.

![Python](https://img.shields.io/badge/Python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.116.1-green)
![Next.js](https://img.shields.io/badge/Next.js-15.5.3-black)
![React](https://img.shields.io/badge/React-19.1.0-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-316192)

## ✨ Features

- 🔍 **Semantic Search**: AI-powered natural language search using Sentence Transformers
- 📍 **Geospatial Queries**: Fast location-based search with PostGIS spatial indexing
- 🎯 **Hybrid Search**: Combines semantic similarity with geographical distance for optimal results
- 🗺️ **Interactive Maps**: Real-time visualization with Mapbox GL / MapTiler
- 🏛️ **Hierarchical Browse**: Navigate by State → District → Post Office
- 📊 **Multiple Map Styles**: Switch between Streets, Satellite, and Terrain views
- ⚡ **High Performance**: Optimized queries with spatial indexing and pre-computed embeddings

## 🏗️ Architecture

### Tech Stack

**Backend:**
- FastAPI (Python)
- PostgreSQL with PostGIS extension
- SQLAlchemy ORM
- Sentence Transformers (`all-MiniLM-L6-v2`)
- NumPy for efficient embedding storage

**Frontend:**
- Next.js 15 (App Router)
- React 19
- Mapliber/ MapTiler
- TailwindCSS 4

### System Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Next.js App   │────────▶│  FastAPI Backend │────────▶│   PostgreSQL    │
│   (Frontend)    │  HTTP   │   (REST API)     │  SQL    │   + PostGIS     │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  SearchService   │
                            │  (AI Embeddings) │
                            └──────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL 15+ with PostGIS extension
- npm or yarn

### Backend Setup

1. **Navigate to backend directory**
```powershell
cd backend
```

2. **Create virtual environment**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows PowerShell
# source venv/bin/activate    # Linux/Mac
```

3. **Install dependencies**
```powershell
pip install -r requirements.txt
```

4. **Configure environment variables**

Create `backend\.env`:
```env
DB_USER=your_postgres_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dpo_system
```

5. **Setup PostgreSQL database**
```sql
CREATE DATABASE dpo_system;
\c dpo_system
CREATE EXTENSION postgis;
```

6. **Load initial data**
```powershell
python scripts\load_data.py
```

7. **Generate AI embeddings**
```powershell
python generate_embeddings.py
```

8. **Start the server**
```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
```powershell
cd frontend
```

2. **Install dependencies**
```powershell
npm install
```

3. **Configure environment variables**

Create `frontend\.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAPTILER_KEY=your_maptiler_api_key
```

Get a free MapTiler API key at: https://www.maptiler.com/

4. **Start development server**
```powershell
npm run dev
```

Frontend will be available at `http://localhost:3000`

## 📚 API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

#### Search Endpoints

**Hybrid Search** (AI + Geospatial)
```http
GET /posts/hybrid-search/?q={query}&lat={latitude}&lon={longitude}
```
Returns top 15 results ranked by semantic similarity and distance.

**Semantic Search Only**
```http
GET /posts/search/?q={query}
```
Returns results based on AI semantic similarity.

**Nearby Posts**
```http
GET /posts/nearby/?lat={latitude}&lon={longitude}&max_distance_km={radius}
```
Returns posts within specified radius.

#### Location Hierarchy

**Get All States**
```http
GET /locations/states/
```

**Get Districts by State**
```http
GET /locations/districts/?state={state_name}
```

**Get Posts by District**
```http
GET /locations/posts/?district={district_name}
```

#### List All Posts
```http
GET /posts/?skip=0&limit=100
```

## 🧠 How It Works

### Hybrid Search Algorithm

The system uses a unique hybrid scoring mechanism:

1. **Semantic Similarity**: Query is encoded using Sentence Transformers and compared against pre-computed embeddings using cosine similarity
2. **Geospatial Distance**: PostGIS calculates great-circle distance from user location
3. **Hybrid Score**: `score = text_similarity × (1 / (distance_km + 1))`

This ensures results are both semantically relevant and geographically convenient.

### Data Flow

```
User Query → Frontend (debounced 500ms)
    ↓
Hybrid Search API (/posts/hybrid-search/)
    ↓
SearchService.find_similar() → Top 100 semantically similar IDs
    ↓
crud.get_posts_by_ids() → Fetch full records from PostgreSQL
    ↓
Hybrid Scoring → Combine text rank × geo distance
    ↓
Top 15 Results → Frontend → Map Markers + List
```

## 📁 Project Structure

```
dpo-system/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app & endpoints
│   │   ├── database.py          # Database connection
│   │   ├── db_models.py         # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── crud.py              # Database operations
│   │   └── ai_search.py         # SearchService (AI)
│   ├── scripts/
│   │   ├── load_data.py         # Data loading script
│   │   └── dpo_data.csv         # Source data
│   ├── generate_embeddings.py  # Generate AI embeddings
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js          # Main application
│   │   │   └── layout.js
│   │   └── components/
│   │       └── MapComponent.js  # Interactive map
│   ├── package.json
│   └── next.config.mjs
├── WARP.md                      # AI agent documentation
├── README.md
└── .gitignore
```

## 🎯 Use Cases

- 📮 Find nearest post offices based on your location
- 🔎 Search for post offices by name, district, or state
- 🗺️ Visualize postal network on interactive maps
- 📊 Browse hierarchical structure: State → District → Post Office
- 🎯 Discover post offices matching natural language queries

## 🛠️ Development

### Running Tests
```powershell
# Backend (when implemented)
cd backend
pytest

# Frontend (when implemented)
cd frontend
npm test
```

### Code Formatting
```powershell
# Python
black backend/
flake8 backend/

# JavaScript
cd frontend
npm run lint
```

## 📊 Database Schema

**Table: `delivery_posts`**

| Column          | Type        | Description                          |
|-----------------|-------------|--------------------------------------|
| id              | Integer     | Primary key                          |
| office_name     | String      | Post office name                     |
| pincode         | Integer     | PIN code                             |
| office_type     | String      | Head Office / Sub Office / Branch    |
| district        | String      | District name                        |
| state_name      | String      | State name                           |
| latitude        | Double      | Latitude coordinate                  |
| longitude       | Double      | Longitude coordinate                 |
| location        | Geography   | PostGIS POINT (for spatial queries)  |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- India Post for providing the postal data
- Sentence Transformers for the AI model
- PostGIS for geospatial capabilities
- FastAPI and Next.js communities

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

⭐ If you find this project useful, please consider giving it a star!
