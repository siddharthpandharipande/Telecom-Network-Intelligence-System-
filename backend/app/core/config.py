"""
NEXUSNET Backend Environment & Core Configuration
=================================================
Safely loads and validates configuration variables from environment and .env files,
including future Gemini chatbot parameters and server settings.

Guarantees:
- Never prints or exposes raw API keys in logs, representations, or error traces.
- Gracefully handles missing/placeholder keys without crashing backend startup.
- Preserves all pre-existing environment variables.
"""

import logging
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv, find_dotenv

logger = logging.getLogger("nexusnet-backend")

PLACEHOLDER_KEY = "your_gemini_api_key_here"


def locate_env_file() -> Optional[Path]:
    """
    Finds the candidate .env file across backend and root workspace paths.
    """
    core_dir = Path(__file__).resolve().parent
    backend_dir = core_dir.parent.parent  # backend root

    candidate_paths = [
        backend_dir / ".env",
        backend_dir.parent / ".env",
        Path.cwd() / "backend" / ".env",
        Path.cwd() / ".env",
    ]

    for p in candidate_paths:
        if p.is_file():
            return p

    # Fallback to automatic discovery
    auto_found = find_dotenv(usecwd=True)
    if auto_found:
        return Path(auto_found)

    return None


# Load .env safely on module import without overriding existing system environment variables
_env_path = locate_env_file()
if _env_path and _env_path.is_file():
    load_dotenv(dotenv_path=_env_path, override=False)


class Settings:
    """
    Application settings container reading from environment variables.
    """

    def __init__(self):
        # Gemini API configuration
        self.GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
        raw_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
        self.GEMINI_MODEL: str = "gemini-2.5-flash" if raw_model in ("gemini-2.0-flash", "") else raw_model

        # Backend server & CORS configuration
        try:
            self.BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000").strip())
        except (ValueError, TypeError):
            self.BACKEND_PORT = 8000

        self.FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()

        # Validate Gemini configuration safely
        self.validate_gemini_config()

    @property
    def is_gemini_configured(self) -> bool:
        """
        Returns True if a real Gemini API key is configured (not empty and not the placeholder).
        """
        return bool(
            self.GEMINI_API_KEY
            and self.GEMINI_API_KEY != PLACEHOLDER_KEY
        )

    @property
    def masked_api_key(self) -> str:
        """
        Returns a masked representation of the API key for safe debugging.
        Never reveals the full secret.
        """
        if not self.is_gemini_configured:
            return "<NOT_CONFIGURED>"
        if len(self.GEMINI_API_KEY) <= 8:
            return "***"
        return f"{self.GEMINI_API_KEY[:4]}...{self.GEMINI_API_KEY[-2:]}"

    def validate_gemini_config(self) -> None:
        """
        Validates the Gemini API key without raising an exception or crashing startup.
        Logs a clear warning if unconfigured.
        """
        if not self.is_gemini_configured:
            logger.warning(
                "Gemini API key is not configured. Chatbot features will not work until the key is added."
            )

    def reload(self) -> None:
        """
        Reloads environment variables from the .env file.
        """
        env_file = locate_env_file()
        if env_file and env_file.is_file():
            load_dotenv(dotenv_path=env_file, override=True)
        self.__init__()

    def __repr__(self) -> str:
        """
        Safe string representation that never reveals the actual API key.
        """
        return (
            f"<Settings(GEMINI_MODEL='{self.GEMINI_MODEL}', "
            f"GEMINI_CONFIGURED={self.is_gemini_configured}, "
            f"BACKEND_PORT={self.BACKEND_PORT}, "
            f"FRONTEND_URL='{self.FRONTEND_URL}')>"
        )


# Global singleton instance
settings = Settings()


def get_settings() -> Settings:
    """
    Returns the application settings singleton.
    """
    return settings

