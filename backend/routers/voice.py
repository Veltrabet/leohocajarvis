"""Voice — ElevenLabs premium seslendirme (anahtar backend'de kalır)."""

from fastapi import APIRouter, Depends, HTTPException

from lib.activity import log
from lib.auth import require_session
from lib.tts import PRESETS, DEFAULT_VOICE, TTSUnavailable, configured, synthesize
from models.schemas import SpeakRequest, SpeakResponse, VoicePreset

router = APIRouter(prefix="/voice", tags=["voice"], dependencies=[Depends(require_session)])


@router.get("/presets", response_model=list[VoicePreset])
async def presets():
    return [
        VoicePreset(**p, default=p["id"] == DEFAULT_VOICE, available=configured()) for p in PRESETS
    ]


@router.post("/speak", response_model=SpeakResponse)
async def speak(body: SpeakRequest):
    try:
        out = await synthesize(body.text, body.voice_id)
    except TTSUnavailable as exc:
        await log("ses", f"Seslendirme yapılamadı: {exc}", status="error")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    await log("ses", f"Premium ses üretildi ({out['characters']} karakter).")
    return SpeakResponse(
        audio_base64=out["audio_base64"],
        mime_type=out["mime_type"],
        characters=out["characters"],
        provider="elevenlabs",
    )
