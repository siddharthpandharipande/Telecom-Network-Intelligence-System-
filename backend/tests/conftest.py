"""Pytest configuration and fixtures for NEXUSNET Backend API tests."""
import os
from pathlib import Path
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db import get_db
from backend.app.main import app
from backend.app.models import Base
from backend.app.seed import seed_database


@pytest.fixture(scope="session")
def test_engine(tmp_path_factory):
    """Create a temporary isolated SQLite database engine for testing."""
    tmp_dir = tmp_path_factory.mktemp("db")
    db_file = tmp_dir / "test_nexusnet.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="session")
def TestingSessionLocal(test_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session")
def test_db(test_engine, TestingSessionLocal) -> Generator[Session, None, None]:
    """Yield a database session and seed it initially."""
    session = TestingSessionLocal()
    # Initial seed for testing
    seed_database(session=session, force_reseed=True)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="session")
def client(test_db, TestingSessionLocal) -> Generator[TestClient, None, None]:
    """Provide a TestClient with dependency override for get_db."""
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
