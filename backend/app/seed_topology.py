"""Topology link seeder creating explicitly labeled demonstration network connections."""
from __future__ import annotations

import random
from typing import List, Tuple

from sqlalchemy import select

from backend.app.db import SessionLocal, init_db
from backend.app.models import Asset, NetworkLink


def seed_topology_links_if_empty(db: Optional[Session] = None) -> int:
    """Seed demonstration network links if network_links table is empty.

    CRITICAL DATA-INTEGRITY RULE: All generated links are explicitly flagged
    is_synthetic=True and labeled 'Demonstration Topology'.
    """
    if db is not None:
        return _seed_links_internal(db)

    init_db()
    with SessionLocal() as local_db:
        return _seed_links_internal(local_db)


def _seed_links_internal(db: Session) -> int:
    existing_count = db.scalar(select(NetworkLink.id).limit(1))
    if existing_count is not None:
        return 0

    # Query key gateway and router nodes in major hubs
    hubs = ["Mumbai", "Pune", "Delhi", "Bengaluru", "Hyderabad", "Chennai"]
    hub_assets = {}
    for hub in hubs:
        assets = db.scalars(
            select(Asset)
            .where(Asset.city == hub, Asset.latitude.is_not(None), Asset.longitude.is_not(None))
            .limit(10)
        ).all()
        if assets:
            hub_assets[hub] = assets

    if len(hub_assets) < 2:
        print("[WARN] Not enough hub assets found for topology seeding.")
        return 0

    created_links = []
    link_seq = 1

    # Inter-city backbone fiber trunks
    intercity_pairs = [
        ("Mumbai", "Pune", "fiber", 100.0, 68.4, "up"),
        ("Mumbai", "Delhi", "fiber", 200.0, 78.2, "up"),
        ("Delhi", "Hyderabad", "fiber", 100.0, 62.5, "up"),
        ("Hyderabad", "Bengaluru", "fiber", 100.0, 71.0, "up"),
        ("Bengaluru", "Chennai", "fiber", 100.0, 59.3, "up"),
        ("Chennai", "Mumbai", "microwave", 40.0, 84.5, "degraded"),
        ("Pune", "Hyderabad", "microwave", 40.0, 48.0, "up"),
        ("Mumbai", "Bengaluru", "fiber", 100.0, 75.1, "up"),
        ("Delhi", "Chennai", "satellite", 10.0, 89.2, "degraded"),
    ]

    for city_a, city_b, l_type, cap, util, stat in intercity_pairs:
        if city_a in hub_assets and city_b in hub_assets:
            src = hub_assets[city_a][0]
            dst = hub_assets[city_b][0]
            link = NetworkLink(
                link_id=f"LINK-BACKBONE-{link_seq:04d}",
                source_asset_id=src.asset_id,
                destination_asset_id=dst.asset_id,
                link_type=l_type,
                capacity_gbps=cap,
                utilization_pct=util,
                status=stat,
                is_synthetic=True,
            )
            db.add(link)
            created_links.append(link)
            link_seq += 1

    # Intra-city distribution links (between gateways, base stations, and routers)
    for hub, assets in hub_assets.items():
        if len(assets) >= 3:
            # Connect primary node to second and third nodes in hub
            src = assets[0]
            for dst in assets[1:4]:
                l_type = "fiber" if dst.asset_type in ["Network Gateway", "Router"] else "microwave"
                util = round(random.uniform(40.0, 85.0), 1)
                stat = "degraded" if util > 80.0 else "up"
                link = NetworkLink(
                    link_id=f"LINK-METRO-{link_seq:04d}",
                    source_asset_id=src.asset_id,
                    destination_asset_id=dst.asset_id,
                    link_type=l_type,
                    capacity_gbps=40.0 if l_type == "fiber" else 10.0,
                    utilization_pct=util,
                    status=stat,
                    is_synthetic=True,
                )
                db.add(link)
                created_links.append(link)
                link_seq += 1

    # International subsea links if Singapore, Paris, New York are available
    intl_hubs = ["Singapore", "Paris", "New York"]
    for intl in intl_hubs:
        intl_asset = db.scalars(
            select(Asset)
            .where(Asset.city == intl, Asset.latitude.is_not(None), Asset.longitude.is_not(None))
            .limit(1)
        ).first()
        if intl_asset and "Mumbai" in hub_assets:
            link = NetworkLink(
                link_id=f"LINK-SUBSEA-{link_seq:04d}",
                source_asset_id=hub_assets["Mumbai"][0].asset_id,
                destination_asset_id=intl_asset.asset_id,
                link_type="fiber",
                capacity_gbps=500.0,
                utilization_pct=64.2,
                status="up",
                is_synthetic=True,
            )
            db.add(link)
            created_links.append(link)
            link_seq += 1

    db.commit()
    print(f"[SEED] Seeded {len(created_links)} demonstration network topology links.")
    return len(created_links)


if __name__ == "__main__":
    seed_topology_links_if_empty()
