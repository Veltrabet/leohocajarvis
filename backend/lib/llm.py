"""Provider abstraction for LEO. Swap providers/models here only.

No key or model name ever reaches the frontend. If a key is missing, callers get a
clear LLMUnavailable error — never a fake answer.
"""

import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

class ImageContent:
    def __init__(self, image_base64: str | None = None):
        self.image_base64 = image_base64


class UserMessage:
    def __init__(self, text: str = "", file_contents: list[ImageContent] | None = None):
        self.text = text
        self.file_contents = file_contents


class TextDelta:
    def __init__(self, content: str):
        self.content = content


class StreamDone:
    pass


LlmChat = Any


class GeminiChat:
    def __init__(self, api_key: str, system_message: str, model: str):
        self.api_key = api_key
        self.system_message = system_message
        self.model = model

    async def _complete(self, prompt: str) -> str:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload = {
            "system_instruction": {"parts": [{"text": self.system_message}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1200},
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, json=payload)
        if response.is_error:
            raise RuntimeError(f"Gemini HTTP {response.status_code}: {response.text[:300]}")
        data = response.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError("Gemini boş veya geçersiz yanıt döndürdü.") from exc

    async def stream_message(self, message: UserMessage):
        yield TextDelta(await self._complete(message.text))
        yield StreamDone()


class LLMUnavailable(Exception):
    """Raised when the configured provider has no usable credential."""


# --- provider registry -------------------------------------------------------
# Each capability resolves its key from env, in order — first hit wins, the rest are
# fallbacks. Drop a key in backend/.env to switch providers without touching code.
text_provider = os.environ.get("LEO_TEXT_PROVIDER", "gemini")
text_model = os.environ.get("LEO_TEXT_MODEL", "gemini-2.0-flash")
if text_provider == "emergent":
    # Emergent supplies an OpenAI-compatible gateway; LiteLLM has no "emergent" provider.
    text_provider = "openai"
    text_model = "gpt-4o" if text_model == "emergent-llm" else text_model
    text_key_env = ("EMERGENT_LLM_KEY",)
else:
    text_key_env = ("GEMINI_API_KEY", "OPENAI_API_KEY", "EMERGENT_LLM_KEY")

PROVIDERS = {
    "text": {
        "provider": text_provider,
        "model": text_model,
        "key_env": text_key_env,
    },
    "image": {
        # The operator's own Gemini key has no image quota (429), so image generation
        # resolves to the Emergent key first. Set GEMINI_IMAGE_API_KEY to override.
        "provider": os.environ.get("LEO_IMAGE_PROVIDER", "gemini"),
        "model": os.environ.get("LEO_IMAGE_MODEL", "gemini-2.5-flash-image"),
        "key_env": ("GEMINI_IMAGE_API_KEY", "EMERGENT_LLM_KEY", "GEMINI_API_KEY"),
    },
}

# --- language ---------------------------------------------------------------
LANGS: dict[str, str] = {
    "auto": (
        "Kullanıcının yazdığı/konuştuğu dili algıla ve AYNI dilde cevap ver "
        "(Türkçe, Arnavutça/shqip veya İngilizce). Dili asla değiştirme."
    ),
    "tr": "Her zaman Türkçe cevap ver.",
    "sq": "Përgjigju gjithmonë në shqip (gjuha shqipe). Mos përdor gjuhë tjetër.",
    "en": "Always answer in English.",
}


def lang_rule(lang: str | None) -> str:
    return LANGS.get(lang or "auto", LANGS["auto"])


def capability_status() -> list[dict]:
    out = []
    for name, cfg in PROVIDERS.items():
        key, source = _resolve(cfg["key_env"])
        out.append(
            {
                "capability": name,
                "provider": cfg["provider"],
                "model": cfg["model"],
                "configured": key is not None,
                "key_source": source or "",
            }
        )
    out.append(
        {
            "capability": "voice",
            "provider": "browser",
            "model": "Web Speech API (tr-TR / sq-AL / en-US)",
            "configured": True,
            "key_source": "tarayıcı",
        }
    )
    out.append(
        {
            "capability": "instagram",
            "provider": "meta-graph",
            "model": "Instagram Graph API",
            "configured": bool(os.environ.get("INSTAGRAM_ACCESS_TOKEN")),
            "key_source": "INSTAGRAM_ACCESS_TOKEN" if os.environ.get("INSTAGRAM_ACCESS_TOKEN") else "",
        }
    )
    out.append(
        {"capability": "video", "provider": "-", "model": "-", "configured": False, "key_source": ""}
    )
    return out


def _resolve(envs: tuple[str, ...]) -> tuple[str | None, str | None]:
    for e in envs:
        v = os.environ.get(e)
        if v:
            return v, e
    return None, None


def _keys_for(capability: str) -> tuple[list[str], dict]:
    cfg = PROVIDERS[capability]
    keys = [os.environ[e] for e in cfg["key_env"] if os.environ.get(e)]
    if not keys:
        raise LLMUnavailable(
            f"'{capability}' yeteneği için API anahtarı tanımlı değil "
            f"({' veya '.join(cfg['key_env'])} backend/.env içine eklenmeli)."
        )
    return keys, cfg


def build_chat(session_id: str, system_message: str) -> LlmChat:
    keys, cfg = _keys_for("text")
    if cfg["provider"] == "gemini":
        return GeminiChat(keys[0], system_message, cfg["model"])
    raise LLMUnavailable(f"Desteklenmeyen metin sağlayıcısı: {cfg['provider']}")


async def complete(session_id: str, system_message: str, prompt: str) -> str:
    keys, cfg = _keys_for("text")
    if cfg["provider"] == "gemini":
        last: Exception | None = None
        for key in keys:
            try:
                return await GeminiChat(key, system_message, cfg["model"])._complete(prompt)
            except Exception as exc:  # noqa: BLE001
                last = exc
        raise LLMUnavailable(f"Gemini yanıt vermedi: {last}")
    raise LLMUnavailable(f"Desteklenmeyen metin sağlayıcısı: {cfg['provider']}")


async def generate_image(prompt: str, source_image_b64: str | None = None) -> dict:
    """Generate (or edit, when a source image is given) an image. Returns base64 + mime."""
    raise LLMUnavailable("Görsel üretimi için ayrıca bir image provider yapılandırılmalı.")


__all__ = [
    "LLMUnavailable",
    "TextDelta",
    "StreamDone",
    "UserMessage",
    "build_chat",
    "capability_status",
    "complete",
    "generate_image",
    "lang_rule",
]
