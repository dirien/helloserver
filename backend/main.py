import random
import string
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI()

# In-memory store: code -> {original_url, clicks, created_at}
db: dict[str, dict] = {}


def _gen_code(length: int = 6) -> str:
    chars = string.ascii_letters + string.digits
    while True:
        code = "".join(random.choices(chars, k=length))
        if code not in db:
            return code


# ── API routes ────────────────────────────────────────────────────────────────

class ShortenRequest(BaseModel):
    url: str


class ShortenResponse(BaseModel):
    short_code: str


class LinkStat(BaseModel):
    short_code: str
    original_url: str
    clicks: int
    created_at: str


@app.post("/api/shorten", response_model=ShortenResponse)
def shorten(body: ShortenRequest) -> ShortenResponse:
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=422, detail="url must not be empty")
    code = _gen_code()
    db[code] = {
        "original_url": url,
        "clicks": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return ShortenResponse(short_code=code)


@app.get("/api/stats", response_model=list[LinkStat])
def stats() -> list[LinkStat]:
    return [
        LinkStat(short_code=code, **entry)
        for code, entry in db.items()
    ]


@app.get("/r/{code}")
def redirect(code: str):
    entry = db.get(code)
    if entry is None:
        raise HTTPException(status_code=404, detail="short code not found")
    entry["clicks"] += 1
    return RedirectResponse(url=entry["original_url"], status_code=302)


# ── Serve built frontend (production) ────────────────────────────────────────

_dist = Path(__file__).parent / "frontend" / "dist"

if _dist.is_dir():
    # Serve all static assets under /assets, then fall back to index.html
    app.mount("/assets", StaticFiles(directory=str(_dist / "assets")), name="assets")

    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        # Let known API/redirect prefixes bubble up as 404 rather than serving HTML
        if full_path.startswith("api/") or full_path.startswith("r/"):
            raise HTTPException(status_code=404)
        return FileResponse(str(_dist / "index.html"))
