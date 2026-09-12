"""ElevenLabs text-to-speech — premium JARVIS voice. Key stays server-side."""

import base64
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

API = "https://api.elevenlabs.io/v1/text-to-speech"
MODEL = os.environ.get("JARVIS_TTS_MODEL", "eleven_multilingual_v2")

# Curated calm/assistant-grade voices from the ElevenLabs shared library.
PRESETS = [
    {"id": "JBFqnCBsd6RMkjVDRZzb", "name": "George", "desc": "Sakin, güven veren erkek (varsayılan)"},
    {"id": "onwK4e9ZLuTAKqWW03F9", "name": "Daniel", "desc": "Derin, otoriter erkek"},
    {"id": "N2lVS1w4EtoT3dr4eOWO", "name": "Callum", "desc": "Alçak tonlu, gizemli"},
    {"id": "pNInz6obpgDQGcFmaJgB", "name": "Adam", "desc": "Nötr, net erkek"},
    {"id": "XrExE9yKIg1WjnnlVkGX", "name": "Matilda", "desc": "Sakin, sıcak kadın"},
]

DEFAULT_VOICE = os.environ.get("JARVIS_VOICE_ID", PRESETS[0]["id"])


class TTSUnavailable(Exception):
    """Raised when ElevenLabs has no key, no quota, or rejects the request."""


def configured() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY"))


async def synthesize(text: str, voice_id: str | None = None) -> dict:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise TTSUnavailable(
            "Premium ses servisi bağlı değil (ELEVENLABS_API_KEY backend/.env içinde yok)."
        )
    clean = text.replace("**", "").replace("#", "").replace("`", "").strip()
    if not clean:
        raise TTSUnavailable("Seslendirilecek metin boş.")
    clean = clean[:2400]  # quota guard: one request never burns the whole monthly budget

    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{API}/{voice_id or DEFAULT_VOICE}",
            headers={"xi-api-key": key, "Content-Type": "application/json"},
            json={
                "text": clean,
                "model_id": MODEL,
                "voice_settings": {
                    "stability": 0.45,
                    "similarity_boost": 0.8,
                    "style": 0.1,
                    "use_speaker_boost": True,
                },
            },
        )

    if res.status_code == 401:
        raise TTSUnavailable("ElevenLabs anahtarı geçersiz veya yetkisi yok (401).")
    if res.status_code == 429:
        raise TTSUnavailable("ElevenLabs kotası doldu (429). Aylık karakter limitini kontrol edin.")
    if res.status_code >= 400:
        raise TTSUnavailable(f"ElevenLabs hatası {res.status_code}: {res.text[:180]}")

    return {
        "audio_base64": base64.b64encode(res.content).decode(),
        "mime_type": "audio/mpeg",
        "characters": len(clean),
    }
