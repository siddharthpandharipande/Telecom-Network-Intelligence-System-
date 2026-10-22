"""WebSocket Real-Time Streaming for Telemetry and Ingestion Updates."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
from typing import Any, Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["Streaming"])


class ConnectionManager:
    """Thread-safe WebSocket connection manager with heartbeat and broadcast handling."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        # Send initial connection handshake
        await websocket.send_json(
            {
                "type": "connection_status",
                "status": "connected",
                "message": "Connected — awaiting new telemetry",
                "client_count": len(self.active_connections),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self.active_connections.discard(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast event to all connected clients, pruning stale sockets."""
        async with self._lock:
            stale_connections = set()
            for connection in self.active_connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    stale_connections.add(connection)

            for stale in stale_connections:
                self.active_connections.discard(stale)


manager = ConnectionManager()


def broadcast_telemetry_event_sync(event_data: Dict[str, Any]):
    """Synchronous helper callable from standard request handlers to broadcast via event loop."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(
                manager.broadcast(
                    {
                        "type": "telemetry_ingested",
                        "data": event_data,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
            )
    except RuntimeError:
        pass


@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """Real-time WebSocket endpoint streaming telemetry ingestion events to NOC dashboard."""
    await manager.connect(websocket)
    try:
        while True:
            # Receive client ping or heartbeat messages
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                if msg.get("type") == "ping":
                    await websocket.send_json(
                        {
                            "type": "pong",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
            except Exception:
                pass
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
