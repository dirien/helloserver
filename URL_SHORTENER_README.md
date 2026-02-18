# URL Shortener Application

A full-stack URL shortener application with React frontend and FastAPI backend.

## Architecture

- **Backend**: Python FastAPI (backend/)
- **Frontend**: React + TypeScript + Vite (frontend/)
- **Deployment**: Multi-stage Docker container

## Quick Start with Docker

Build and run the containerized application:

```bash
# Build the Docker image
docker build -t url-shortener .

# Run the container
docker run -p 8000:8000 url-shortener
```

Access the application at http://localhost:8000

## Development Setup

### Backend (Terminal 1)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Backend API available at http://localhost:8000

### Frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server at http://localhost:5173 (proxies API calls to backend)

## API Endpoints

- **POST /shorten** - Create a shortened URL
  ```json
  Request: {"url": "https://example.com"}
  Response: {
    "short_code": "abc123",
    "short_url": "http://localhost:8000/abc123",
    "original_url": "https://example.com"
  }
  ```

- **GET /{short_code}** - Redirect to original URL (HTTP 307)

- **GET /api/stats/{short_code}** - Get URL statistics
  ```json
  Response: {
    "short_code": "abc123",
    "original_url": "https://example.com",
    "clicks": 5,
    "created_at": "2026-02-18T00:22:45.067528"
  }
  ```

- **GET /health** - Health check endpoint

## Features

- ✅ Generate 6-character alphanumeric short codes
- ✅ Click tracking with statistics
- ✅ Timestamp for URL creation
- ✅ Copy-to-clipboard functionality
- ✅ Real-time stats updates (every 5 seconds)
- ✅ Persistent storage in localStorage
- ✅ Clean, responsive UI
- ✅ CORS enabled for all origins
- ✅ In-memory storage (data persists while server runs)

## Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── test_api.sh         # API test script
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Main React component
│   │   ├── App.css         # Styling
│   │   └── main.tsx        # Entry point
│   ├── package.json        # Node dependencies
│   ├── vite.config.ts      # Vite configuration
│   └── README.md
├── Dockerfile              # Multi-stage build
└── URL_SHORTENER_README.md # This file
```

## Docker Details

The Dockerfile uses a multi-stage build:

1. **Stage 1**: Node.js builds the React frontend
2. **Stage 2**: Python serves both the API and static frontend files

The backend serves:
- Frontend static files at `/` (root)
- API endpoints at `/shorten`, `/{short_code}`, `/api/stats/{short_code}`
- Health check at `/health`

## Testing

### Backend API Test
```bash
cd backend
chmod +x test_api.sh
./test_api.sh
```

### Manual Testing
```bash
# Create short URL
curl -X POST http://localhost:8000/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com"}'

# Get stats
curl http://localhost:8000/api/stats/abc123

# Redirect (will follow)
curl -L http://localhost:8000/abc123
```

## Technologies

**Backend:**
- FastAPI 0.115.12
- Uvicorn 0.34.2
- Pydantic 2.10.6

**Frontend:**
- React 19.2.0
- TypeScript 5.9.3
- Vite 7.3.1

## Notes

- Data is stored in-memory and will be lost when the server restarts
- In production, consider adding a database (Redis, PostgreSQL, etc.)
- The application uses HTTP - add HTTPS/TLS for production
- Short codes are randomly generated with collision detection
