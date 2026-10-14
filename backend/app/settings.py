"""Application configuration and settings for NEXUSNET Backend."""
import os
from pathlib import Path
from typing import List

# Repository Root is the parent of the backend directory (DSCP/)
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = REPO_ROOT / "backend"


class Settings:
    """Settings loaded from environment variables with safe defaults."""

    # File and Directory Paths
    REPO_ROOT: Path = REPO_ROOT
    BACKEND_DIR: Path = BACKEND_DIR
    DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(BACKEND_DIR / "data")))
    DB_PATH: Path = Path(os.getenv("DB_PATH", str(BACKEND_DIR / "data" / "nexusnet.db")))
    DATASET_PATH: Path = Path(
        os.getenv(
            "DATASET_PATH",
            str(REPO_ROOT / "dataset" / "nexusnet_worldwide_network_assets_6000.csv"),
        )
    )

    # Ingestion & Seeding Constraints
    MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", 10 * 1024 * 1024))  # 10 MB
    MAX_ROWS: int = int(os.getenv("MAX_ROWS", 50000))
    SEED_INCIDENT_LIMIT: int = int(os.getenv("SEED_INCIDENT_LIMIT", 30))

    # CORS Origins
    @property
    def CORS_ORIGINS(self) -> List[str]:
        env_origins = os.getenv("CORS_ORIGINS")
        if env_origins:
            return [o.strip() for o in env_origins.split(",") if o.strip()]
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    # Database URL
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Ensure SQLite path is formatted properly
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{self.DB_PATH.as_posix()}"


settings = Settings()
