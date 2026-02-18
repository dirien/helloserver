# URL Shortener Backend

A FastAPI-based URL shortener service with in-memory storage.

## Installation

```bash
cd backend
pip install -r requirements.txt
```

## Running the Server

```bash
# Using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000

# Or using Python
python3 main.py
```

The API will be available at `http://localhost:8000`

## API Endpoints

### POST /shorten
Shorten a URL and get a short code.

**Request:**
```json
{
  "url": "https://www.example.com"
}
```

**Response:**
```json
{
  "short_code": "abc123",
  "short_url": "http://localhost:8000/abc123"
}
```

### GET /{short_code}
Redirect to the original URL. Returns HTTP 307 redirect and increments the click counter.

**Example:**
```bash
curl -L http://localhost:8000/abc123
```

### GET /api/stats/{short_code}
Get statistics for a shortened URL.

**Response:**
```json
{
  "short_code": "abc123",
  "original_url": "https://www.example.com",
  "clicks": 5,
  "created_at": "2026-02-18T00:22:45.067528"
}
```

### GET /
Health check endpoint showing API status and available endpoints.

## Testing

```bash
# Create a short URL
curl -X POST http://localhost:8000/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com"}'

# Use the short code from the response
curl -L http://localhost:8000/{short_code}

# Check statistics
curl http://localhost:8000/api/stats/{short_code}
```

## Features

- 6-character alphanumeric short codes
- In-memory storage (data persists only while server is running)
- Click tracking
- Timestamp for URL creation
- CORS enabled for all origins
- Proper error handling with 404 responses for invalid codes
- Python 3.11+ compatible
