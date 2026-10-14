"""SQLAlchemy database engine and session management."""
from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app.models import Base
from backend.app.settings import settings

# SQLite connection with thread checking disabled for FastAPI concurrent requests
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    connect_args={"check_same_thread": False},
    echo=False,
)


# Enforce foreign key constraints in SQLite
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db(engine_override: Engine = None) -> None:
    """Create all database tables."""
    target_engine = engine_override or engine
    Base.metadata.create_all(bind=target_engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency to yield a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
