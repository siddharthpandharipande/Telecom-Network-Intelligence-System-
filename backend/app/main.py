"""
NEXUSNET Backend App Wrapper
Re-exports FastAPI app from backend.main for compatibility with commands referencing
`backend.app.main:app`.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir.parent) not in sys.path:
    sys.path.insert(0, str(backend_dir.parent))

from backend.main import (  # noqa: E402
    app,
    ASSET_RECORDS,
    MODEL_SUMMARY,
    load_backend_data,
    resolve_file_paths,
)
from backend.app.core.config import settings

__all__ = ["app", "ASSET_RECORDS", "MODEL_SUMMARY", "load_backend_data", "resolve_file_paths", "settings"]

if __name__ == "__main__":
    import uvicorn
    port = settings.BACKEND_PORT if settings else 8000
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=port, reload=True)
