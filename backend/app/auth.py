"""Authentication, password security, session handling, and Role-Based Access Control (RBAC)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets
from typing import Callable, List, Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from backend.app.db import get_db
from backend.app.models import User, UserSession

SESSION_DURATION_HOURS = 24

# Role hierarchy: admin > network_engineer > noc_analyst
ROLES = {
    "noc_analyst": "NOC Analyst",
    "network_engineer": "Network Engineer",
    "admin": "System Administrator",
}


def hash_password(password: str) -> str:
    """Hash password using scrypt."""
    return generate_password_hash(password, method="scrypt")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return check_password_hash(hashed_password, plain_password)


def create_user_session(db: Session, user: User) -> UserSession:
    """Generate a secure cryptographic session token for authenticated user."""
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    expires_at = now + timedelta(hours=SESSION_DURATION_HOURS)

    session = UserSession(
        token=token,
        user_id=user.id,
        expires_at=expires_at,
        created_at=now,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def revoke_session(db: Session, token: str) -> bool:
    """Revoke session token on logout."""
    session = db.scalar(select(UserSession).where(UserSession.token == token))
    if session:
        db.delete(session)
        db.commit()
        return True
    return False


def get_token_from_header(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Extract bearer token from Authorization header."""
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def get_current_user_optional(
    token: Optional[str] = Depends(get_token_from_header),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Return authenticated user if valid token present, otherwise None."""
    if not token:
        return None
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    session = db.scalar(
        select(UserSession).where(
            UserSession.token == token,
            UserSession.expires_at > now,
        )
    )
    if not session:
        return None
    user = db.get(User, session.user_id)
    if not user or not user.is_active:
        return None
    return user


def get_current_user(
    user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Enforce authentication; raise 401 if not authenticated."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "detail": "Authentication credentials were not provided or have expired.",
                "code": "UNAUTHORIZED",
                "errors": ["Valid Bearer token required in Authorization header."],
            },
        )
    return user


def require_roles(allowed_roles: List[str]) -> Callable:
    """Dependency factory enforcing backend Role-Based Access Control."""

    def role_dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "detail": f"Access denied. User role '{user.role}' lacks required permissions.",
                    "code": "FORBIDDEN",
                    "errors": [f"Allowed roles: {allowed_roles}"],
                },
            )
        return user

    return role_dependency
