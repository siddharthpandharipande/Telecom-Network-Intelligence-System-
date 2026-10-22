"""User and Administrator management CLI script for NEXUSNET."""
from __future__ import annotations

import argparse
import sys
from typing import Optional

from sqlalchemy import select

from backend.app.auth import hash_password
from backend.app.db import SessionLocal, init_db
from backend.app.models import User

DEMO_USERS = [
    {
        "username": "admin",
        "password": "NocAdmin@2026",
        "full_name": "NOC Administrator",
        "role": "admin",
    },
    {
        "username": "engineer",
        "password": "Engineer@2026",
        "full_name": "Field Network Engineer",
        "role": "network_engineer",
    },
    {
        "username": "analyst",
        "password": "Analyst@2026",
        "full_name": "NOC Analyst",
        "role": "noc_analyst",
    },
]


def create_user(
    username: str,
    password: str,
    full_name: str,
    role: str = "noc_analyst",
) -> User:
    """Create a user with hashed password."""
    init_db()
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.username == username))
        if existing:
            print(f"[WARN] User '{username}' already exists. Updating password and role...")
            existing.password_hash = hash_password(password)
            existing.full_name = full_name
            existing.role = role
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            return existing

        user = User(
            username=username,
            password_hash=hash_password(password),
            full_name=full_name,
            role=role,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"[SUCCESS] User '{username}' created with role '{role}'.")
        return user


def seed_demo_users_if_empty(db: Optional[Session] = None) -> int:
    """Seed initial demo accounts if no users exist in database."""
    if db is not None:
        count = 0
        for u in DEMO_USERS:
            existing = db.scalar(select(User).where(User.username == u["username"]))
            if not existing:
                user = User(
                    username=u["username"],
                    password_hash=hash_password(u["password"]),
                    full_name=u["full_name"],
                    role=u["role"],
                    is_active=True,
                )
                db.add(user)
                count += 1
        db.commit()
        return count

    init_db()
    count = 0
    with SessionLocal() as local_db:
        for u in DEMO_USERS:
            existing = local_db.scalar(select(User).where(User.username == u["username"]))
            if not existing:
                user = User(
                    username=u["username"],
                    password_hash=hash_password(u["password"]),
                    full_name=u["full_name"],
                    role=u["role"],
                    is_active=True,
                )
                local_db.add(user)
                count += 1
        local_db.commit()
    if count > 0:
        print(f"[SEED] Seeded {count} initial operational accounts.")
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NEXUSNET User Management CLI")
    subparsers = parser.add_subparsers(dest="command")

    # create-user command
    create_parser = subparsers.add_parser("create-user", help="Create or update user account")
    create_parser.add_argument("--username", required=True, help="Unique username")
    create_parser.add_argument("--password", required=True, help="Password (plain text, will be hashed)")
    create_parser.add_argument("--full-name", default="Operational Staff", help="Full display name")
    create_parser.add_argument(
        "--role",
        choices=["noc_analyst", "network_engineer", "admin"],
        default="noc_analyst",
        help="Access control role",
    )

    # seed command
    subparsers.add_parser("seed-demo-users", help="Seed default demo accounts if absent")

    args = parser.parse_args()
    if args.command == "create-user":
        create_user(args.username, args.password, args.full_name, args.role)
    elif args.command == "seed-demo-users":
        seed_demo_users_if_empty()
    else:
        parser.print_help()
        sys.exit(1)
