"""Configuration loader for NEXUSNET ML subsystem.
Single source of truth for all thresholds, label clauses, and feature configurations.
"""
from pathlib import Path
import json
from typing import Any, Dict

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"


def load_config() -> Dict[str, Any]:
    """Load the canonical ML configuration dictionary from config.json."""
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Configuration file not found at: {CONFIG_PATH}")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_config(config: Dict[str, Any]) -> None:
    """Save an updated configuration dictionary back to config.json with formatting."""
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
