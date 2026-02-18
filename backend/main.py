import random
import string
from datetime import datetime
from typing import Dict, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl


# Data models
class URLRequest(BaseModel):
    url: HttpUrl


class URLResponse(BaseModel):
    short_code: str
    short_url: str
    original_url: str


class StatsResponse(BaseModel):
    short_code: str
    original_url: str
    clicks: int
    created_at: str


# In-memory storage
class URLStore:
    def __init__(self):
        self.urls: Dict[str, dict] = {}

    def generate_short_code(self) -> str:
        """Generate a random 6-character short code."""
        characters = string.ascii_letters + string.digits
        while True:
            code = ''.join(random.choice(characters) for _ in range(6))
            if code not in self.urls:
                return code

    def store_url(self, short_code: str, original_url: str) -> None:
        """Store a URL with its short code."""
        self.urls[short_code] = {
            'original_url': original_url,
            'clicks': 0,
            'created_at': datetime.utcnow().isoformat()
        }

    def get_url(self, short_code: str) -> Optional[dict]:
        """Retrieve URL data by short code."""
        return self.urls.get(short_code)

    def increment_clicks(self, short_code: str) -> None:
        """Increment the click count for a short code."""
        if short_code in self.urls:
            self.urls[short_code]['clicks'] += 1


# Initialize FastAPI app and storage
app = FastAPI(title="URL Shortener API", version="1.0.0")
url_store = URLStore()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/shorten", response_model=URLResponse, status_code=201)
async def shorten_url(request: Request, url_request: URLRequest):
    """
    Shorten a URL and return the short code and full short URL.

    Args:
        url_request: JSON payload with 'url' field

    Returns:
        JSON with 'short_code' and 'short_url'
    """
    # Generate unique short code
    short_code = url_store.generate_short_code()

    # Store the URL with metadata
    url_store.store_url(short_code, str(url_request.url))

    # Build the full short URL
    base_url = f"{request.url.scheme}://{request.url.netloc}"
    short_url = f"{base_url}/{short_code}"

    return URLResponse(
        short_code=short_code,
        short_url=short_url,
        original_url=str(url_request.url)
    )


@app.get("/{short_code}")
async def redirect_to_url(short_code: str):
    """
    Redirect to the original URL associated with the short code.

    Args:
        short_code: The 6-character short code

    Returns:
        HTTP 307 redirect to the original URL

    Raises:
        HTTPException: 404 if short code not found
    """
    url_data = url_store.get_url(short_code)

    if not url_data:
        raise HTTPException(
            status_code=404,
            detail=f"Short code '{short_code}' not found"
        )

    # Increment click count
    url_store.increment_clicks(short_code)

    # Redirect to original URL
    return RedirectResponse(
        url=url_data['original_url'],
        status_code=307
    )


@app.get("/api/stats/{short_code}", response_model=StatsResponse)
async def get_stats(short_code: str):
    """
    Get statistics for a shortened URL.

    Args:
        short_code: The 6-character short code

    Returns:
        JSON with click count and creation timestamp

    Raises:
        HTTPException: 404 if short code not found
    """
    url_data = url_store.get_url(short_code)

    if not url_data:
        raise HTTPException(
            status_code=404,
            detail=f"Short code '{short_code}' not found"
        )

    return StatsResponse(
        short_code=short_code,
        original_url=url_data['original_url'],
        clicks=url_data['clicks'],
        created_at=url_data['created_at']
    )


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "message": "URL Shortener API is running",
        "endpoints": {
            "POST /shorten": "Shorten a URL",
            "GET /{short_code}": "Redirect to original URL",
            "GET /api/stats/{short_code}": "Get URL statistics"
        }
    }


# Mount static files (frontend) - this should be last
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
