"""Authentication and User Management Routes."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.auth import (
    create_user_session,
    get_current_user,
    get_token_from_header,
    hash_password,
    require_roles,
    revoke_session,
    verify_password,
)
from backend.app.db import get_db
from backend.app.models import User
from backend.app.schemas import (
    CreateUserRequest,
    LoginRequest,
    LoginResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with username and password, returning session bearer token."""
    user = db.scalar(select(User).where(User.username == req.username.strip()))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "detail": "Invalid username or password.",
                "code": "INVALID_CREDENTIALS",
                "errors": ["Check your username and password and try again."],
            },
        )

    if not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "detail": "Invalid username or password.",
                "code": "INVALID_CREDENTIALS",
                "errors": ["Check your username and password and try again."],
            },
        )

    session = create_user_session(db, user)

    return LoginResponse(
        token=session.token,
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        expires_at=session.expires_at,
    )


@router.post("/logout")
def logout(
    token: str = Depends(get_token_from_header),
    db: Session = Depends(get_db),
):
    """Revoke session token on logout."""
    if token:
        revoke_session(db, token)
    return {"message": "Logged out successfully", "status": "ok"}


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    """Retrieve authenticated user profile and assigned role."""
    return user


@router.get("/users", response_model=List[UserResponse])
def list_users(
    _admin: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    """List all user accounts (Administrator role required)."""
    users = db.scalars(select(User).order_by(User.id.asc())).all()
    return users


@router.post("/users", response_model=UserResponse)
def create_new_user(
    req: CreateUserRequest,
    _admin: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    """Create a new user account with specified role (Administrator role required)."""
    existing = db.scalar(select(User).where(User.username == req.username.strip()))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": f"Username '{req.username}' is already in use.",
                "code": "USERNAME_EXISTS",
                "errors": ["Choose a different username."],
            },
        )

    if req.role not in ["noc_analyst", "network_engineer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": f"Invalid role '{req.role}'.",
                "code": "INVALID_ROLE",
                "errors": ["Allowed roles: noc_analyst, network_engineer, admin"],
            },
        )

    new_user = User(
        username=req.username.strip(),
        password_hash=hash_password(req.password),
        full_name=req.full_name.strip(),
        role=req.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
