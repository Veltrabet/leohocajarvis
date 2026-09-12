"""Pydantic v2 models. Each has a hand-written TS mirror in frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return str(uuid.uuid4())


# --- auth --------------------------------------------------------------------
class PinLogin(BaseModel):
    pin: str


class Me(BaseModel):
    authenticated: bool
    operator: str


# --- projects ----------------------------------------------------------------
class ProjectCreate(BaseModel):
    name: str
    client: str = ""
    description: str = ""


class Project(BaseModel):
    id: str = Field(default_factory=_id)
    name: str
    client: str = ""
    description: str = ""
    status: Literal["aktif", "beklemede", "tamamlandi"] = "aktif"
    created_at: datetime = Field(default_factory=_now)


class ProjectUpdate(BaseModel):
    name: str | None = None
    client: str | None = None
    description: str | None = None
    status: Literal["aktif", "beklemede", "tamamlandi"] | None = None


# --- tasks -------------------------------------------------------------------
class TaskCreate(BaseModel):
    title: str
    project_id: str | None = None
    priority: Literal["kritik", "yuksek", "normal", "dusuk"] = "normal"
    due_date: str | None = None
    notes: str = ""


class Task(BaseModel):
    id: str = Field(default_factory=_id)
    title: str
    project_id: str | None = None
    priority: Literal["kritik", "yuksek", "normal", "dusuk"] = "normal"
    status: Literal["bekliyor", "devam", "tamam"] = "bekliyor"
    due_date: str | None = None
    notes: str = ""
    created_at: datetime = Field(default_factory=_now)


class TaskUpdate(BaseModel):
    title: str | None = None
    project_id: str | None = None
    priority: Literal["kritik", "yuksek", "normal", "dusuk"] | None = None
    status: Literal["bekliyor", "devam", "tamam"] | None = None
    due_date: str | None = None
    notes: str | None = None


# --- activity ----------------------------------------------------------------
class Activity(BaseModel):
    id: str = Field(default_factory=_id)
    kind: str
    message: str
    status: Literal["ok", "error", "pending"] = "ok"
    created_at: datetime = Field(default_factory=_now)


# --- memory ------------------------------------------------------------------
class MemoryCreate(BaseModel):
    key: str
    value: str
    category: str = "genel"


class Memory(BaseModel):
    id: str = Field(default_factory=_id)
    key: str
    value: str
    category: str = "genel"
    source: Literal["manuel", "otomatik"] = "manuel"
    created_at: datetime = Field(default_factory=_now)


# --- chat --------------------------------------------------------------------
class ChatMessage(BaseModel):
    id: str = Field(default_factory=_id)
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime = Field(default_factory=_now)


class ChatSend(BaseModel):
    message: str
    lang: Literal["auto", "tr", "sq", "en"] = "auto"


# --- studio ------------------------------------------------------------------
class ImageRequest(BaseModel):
    prompt: str
    source_image_base64: str | None = None


class StudioItem(BaseModel):
    id: str = Field(default_factory=_id)
    prompt: str
    mime_type: str
    data_url: str
    edited: bool = False
    created_at: datetime = Field(default_factory=_now)


# --- crm ---------------------------------------------------------------------
class LeadCreate(BaseModel):
    name: str
    company: str = ""
    channel: str = "instagram"
    handle: str = ""
    email: str = ""
    phone: str = ""
    need: str = ""


class Lead(BaseModel):
    id: str = Field(default_factory=_id)
    name: str
    company: str = ""
    channel: str = "instagram"
    handle: str = ""
    email: str = ""
    phone: str = ""
    need: str = ""
    stage: Literal["yeni", "iletisimde", "teklif", "kazanildi", "kaybedildi"] = "yeni"
    notes: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_now)


class LeadUpdate(BaseModel):
    name: str | None = None
    company: str | None = None
    channel: str | None = None
    handle: str | None = None
    email: str | None = None
    phone: str | None = None
    need: str | None = None
    stage: Literal["yeni", "iletisimde", "teklif", "kazanildi", "kaybedildi"] | None = None


class LeadNote(BaseModel):
    note: str


class OutreachRequest(BaseModel):
    goal: str = "ilk temas"
    tone: Literal["profesyonel", "samimi", "kisa", "ikna edici"] = "profesyonel"
    channel: Literal["instagram_dm", "eposta", "whatsapp"] = "instagram_dm"
    lang: Literal["auto", "tr", "sq", "en"] = "tr"


class GeneratedText(BaseModel):
    id: str = Field(default_factory=_id)
    kind: str
    topic: str
    content: str
    lang: str = "tr"
    created_at: datetime = Field(default_factory=_now)


# --- social content agency ---------------------------------------------------
class SocialRequest(BaseModel):
    kind: Literal["post", "reels", "caption", "hashtags", "takvim", "dm", "biyografi"] = "post"
    topic: str
    tone: Literal["profesyonel", "samimi", "enerjik", "prestijli"] = "profesyonel"
    lang: Literal["auto", "tr", "sq", "en"] = "tr"


# --- brief / system ----------------------------------------------------------
class DailyBrief(BaseModel):
    date: str
    summary: str
    open_tasks: int
    critical_tasks: int
    completed_today: int
    generated_at: datetime = Field(default_factory=_now)


class Capability(BaseModel):
    capability: str
    provider: str
    model: str
    configured: bool
    key_source: str


# --- voice ------------------------------------------------------------------
class SpeakRequest(BaseModel):
    text: str
    voice_id: str | None = None


class SpeakResponse(BaseModel):
    audio_base64: str
    mime_type: str
    characters: int
    provider: str


class VoicePreset(BaseModel):
    id: str
    name: str
    desc: str
    default: bool
    available: bool
