"""
NEXUSNET NOC Chatbot API Route
==============================
Exposes endpoints for the Gemini-powered NOC Assistant to answer operator questions
grounded in the latest manual telemetry analysis.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

try:
    from backend.app.services.gemini_chat_service import get_gemini_chat_service, GeminiChatService
except ImportError:
    from app.services.gemini_chat_service import get_gemini_chat_service, GeminiChatService

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])


class ChatbotAskRequest(BaseModel):
    question: str = Field(
        ...,
        description="Question asked by the NOC engineer",
        json_schema_extra={"example": "Why is this asset flagged for investigation?"}
    )
    sessionId: Optional[str] = Field(
        None,
        description="Optional session ID to maintain conversation turns",
        json_schema_extra={"example": "session-1234-abcd"}
    )
    telemetryContext: Optional[dict] = Field(
        None,
        description="Optional telemetry analysis context sent directly by frontend",
        json_schema_extra={"example": {"asset_id": "TWR-IND-042", "city": "Mumbai"}}
    )



class ChatbotAskResponse(BaseModel):
    answer: str = Field(..., description="Grounded response from Gemini NOC Assistant")
    sessionId: str = Field(..., description="Active session ID for conversation continuity")
    sources: List[str] = Field(..., description="Evidence sources consulted")
    timestamp: str = Field(..., description="ISO UTC timestamp of response generation")


class ClearSessionRequest(BaseModel):
    sessionId: str


@router.post(
    "/ask",
    response_model=ChatbotAskResponse,
    summary="Ask the Gemini-powered NOC Assistant",
    description="Submits a typed or voice-transcribed question to the NOC Assistant with full context of the latest manual telemetry analysis."
)
async def ask_chatbot(
    payload: ChatbotAskRequest,
    chat_service: GeminiChatService = Depends(get_gemini_chat_service)
):
    """
    Evaluates the question against the latest analyzed manual telemetry record,
    injects platform insights, and queries Gemini.
    """
    # 1. Input validation
    clean_q = payload.question.strip() if payload.question else ""
    if not clean_q:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question must not be empty or whitespace only."
        )

    if len(clean_q) > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question exceeds maximum allowed length of 1000 characters."
        )

    # 2. Retrieve latest manual telemetry record
    latest_record = payload.telemetryContext
    if not latest_record:
        import sys
        for mod_name in ("backend.main", "main"):
            mod = sys.modules.get(mod_name)
            if mod:
                if hasattr(mod, "get_last_analyzed_record"):
                    latest_record = mod.get_last_analyzed_record()
                elif getattr(mod, "LAST_ANALYZED_RECORD", None) is not None:
                    latest_record = getattr(mod, "LAST_ANALYZED_RECORD")
                if latest_record is not None:
                    break

    if not latest_record:
        from pathlib import Path
        import json
        for candidate_dir in (
            Path(__file__).resolve().parent.parent.parent / "data",
            Path.cwd() / "backend" / "data",
            Path.cwd() / "data",
        ):
            c_file = candidate_dir / ".latest_analysis_cache.json"
            if c_file.is_file():
                try:
                    with open(c_file, "r", encoding="utf-8") as f:
                        latest_record = json.load(f)
                    if latest_record:
                        break
                except Exception:
                    pass

    # 3. Query Gemini Chat Service
    try:
        result = await chat_service.ask(
            question=clean_q,
            session_id=payload.sessionId,
            analysis_data=latest_record
        )
        return ChatbotAskResponse(
            answer=result["answer"],
            sessionId=result["sessionId"],
            sources=result["sources"],
            timestamp=result["timestamp"]
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the assistant response."
        )


@router.post(
    "/clear",
    summary="Clear Chatbot Conversation Session",
    description="Resets the in-memory rolling dialogue history for a session."
)
async def clear_chatbot_session(
    payload: ClearSessionRequest,
    chat_service: GeminiChatService = Depends(get_gemini_chat_service)
):
    """
    Clears conversation history for the requested session ID.
    """
    chat_service.clear_session(payload.sessionId)
    return {"status": "cleared", "sessionId": payload.sessionId}
