"""LEO core: streaming chat with structured memory, daily brief, activity, system status."""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from lib.activity import log
from lib.auth import require_session
from lib.db import db
from lib.dates import today_iso
from lib.llm import (
    LLMUnavailable,
    StreamDone,
    TextDelta,
    UserMessage,
    build_chat,
    capability_status,
    complete,
    lang_rule,
)
from models.schemas import (
    Activity,
    Capability,
    ChatMessage,
    ChatSend,
    DailyBrief,
    Memory,
    MemoryCreate,
)

router = APIRouter(tags=["LEO"], dependencies=[Depends(require_session)])

MEMORY_MARK = "###HAFIZA###"

BASE_PERSONA = """Sen LEO'sun — LeoHoca'nın (Q8Ka By Leohoca) kişisel yapay zeka iş asistanısın.
LeoHoca bir yazılımcı, web tasarımcısı, IT ve sistem uzmanı, sosyal medya ve dijital proje geliştiricisidir.

Davranış kuralların:
- Profesyonel, net ve kısa konuş. Gereksiz dolgu cümlesi kurma.
- Teknik derinliğe sahipsin: frontend, backend, database, API, hosting, güvenlik, otomasyon.
- Elindeki GERÇEK sistem verisine (görevler, projeler, işlem geçmişi, hafıza) dayan. Veri yoksa
  "bu konuda kayıtlı veri yok" de; asla veri uydurma.
- Bir işlemi yapamıyorsan veya bir entegrasyon bağlı değilse bunu açıkça söyle.
- Ara sıra "Efendim" diyebilirsin ama sürekli kullanma.

Kalıcı hafıza: Konuşmada LeoHoca hakkında kalıcı olarak saklanmaya değer yeni bir bilgi
(tercih, çalışma şekli, müşteri, proje detayı, talimat) öğrenirsen, cevabının EN SONUNA
tek satır olarak `%s` yaz ve altına her satıra bir tane `anahtar: değer` ekle.
Bu bloğu sadece gerçekten yeni ve kalıcı bilgi varsa yaz; yoksa hiç yazma.
""" % MEMORY_MARK


async def _context() -> str:
    try:
        mems = await db.memories.find().sort("created_at", -1).to_list(60)
        tasks = await db.tasks.find({"status": {"$ne": "tamam"}}).sort("created_at", -1).to_list(60)
        projects = await db.projects.find().sort("created_at", -1).to_list(40)
        acts = await db.activities.find().sort("created_at", -1).to_list(15)
        leads = await db.leads.find().sort("created_at", -1).to_list(40)
    except Exception:
        mems, tasks, projects, acts, leads = [], [], [], [], []
    lines = [f"Bugünün tarihi: {today_iso()}"]
    lines.append("KALICI HAFIZA:")
    lines += [f"- {m['key']}: {m['value']}" for m in mems] or ["- (boş)"]
    lines.append("AKTİF PROJELER:")
    lines += [f"- {p['name']} ({p['status']}) müşteri: {p.get('client') or '-'}" for p in projects] or ["- (yok)"]
    lines.append("AÇIK GÖREVLER:")
    lines += [
        f"- [{t['priority']}] {t['title']} (durum: {t['status']}, termin: {t.get('due_date') or '-'})"
        for t in tasks
    ] or ["- (yok)"]
    lines.append("POTANSİYEL MÜŞTERİLER (CRM):")
    lines += [
        f"- {l['name']} ({l.get('company') or '-'}) aşama: {l['stage']} ihtiyaç: {l.get('need') or '-'}"
        for l in leads
    ] or ["- (yok)"]
    lines.append("SON İŞLEMLER:")
    lines += [f"- {a['kind']}: {a['message']}" for a in acts] or ["- (yok)"]
    return "\n".join(lines)


async def _store_memories(block: str) -> int:
    count = 0
    for line in block.splitlines():
        line = line.strip().lstrip("-").strip()
        if not line or ":" not in line:
            continue
        key, value = line.split(":", 1)
        key, value = key.strip(), value.strip()
        if not key or not value:
            continue
        m = Memory(key=key, value=value, source="otomatik")
        await db.memories.update_one(
            {"key": key}, {"$set": m.model_dump()}, upsert=True
        )
        count += 1
    return count


# --- chat --------------------------------------------------------------------
@router.get("/chat/messages", response_model=list[ChatMessage])
async def chat_messages():
    docs = await db.messages.find().sort("created_at", 1).to_list(400)
    return [ChatMessage(**d) for d in docs]


@router.delete("/chat/messages")
async def clear_chat():
    await db.messages.delete_many({})
    await log("sohbet", "Sohbet geçmişi temizlendi.")
    return {"cleared": True}


@router.post("/chat/stream")
async def chat_stream(body: ChatSend):
    if not body.message.strip():
        raise HTTPException(status_code=422, detail="Boş mesaj gönderilemez.")

    user_msg = ChatMessage(role="user", content=body.message)
    try:
        await db.messages.insert_one(user_msg.model_dump())
        history = await db.messages.find().sort("created_at", 1).to_list(60)
    except Exception:
        history = []
    transcript = "\n".join(
        f"{'LeoHoca' if h['role'] == 'user' else 'LEO'}: {h['content']}" for h in history[-20:-1]
    )
    system = BASE_PERSONA + "\nDİL KURALI: " + lang_rule(body.lang) + "\n\nSİSTEM VERİSİ:\n" + await _context()
    if transcript:
        system += "\n\nÖNCEKİ KONUŞMA:\n" + transcript

    async def gen():
        try:
            chat = build_chat(session_id=f"LEO-{user_msg.id}", system_message=system)
            full, emitted, stopped = "", 0, False
            async for ev in chat.stream_message(UserMessage(text=body.message)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    if stopped:
                        continue
                    idx = full.find(MEMORY_MARK)
                    if idx >= 0:
                        stopped = True
                        visible = full[:idx]
                    else:
                        visible = full[: max(0, len(full) - len(MEMORY_MARK))]
                    if len(visible) > emitted:
                        chunk = visible[emitted:]
                        emitted = len(visible)
                        yield f"data: {_enc(chunk)}\n\n"
                elif isinstance(ev, StreamDone):
                    break
            if not stopped and len(full) > emitted:
                yield f"data: {_enc(full[emitted:])}\n\n"

            answer, _, mem_block = full.partition(MEMORY_MARK)
            answer = answer.strip()
            try:
                await db.messages.insert_one(
                    ChatMessage(role="assistant", content=answer).model_dump()
                )
                saved = await _store_memories(mem_block) if mem_block.strip() else 0
            except Exception:
                saved = 0
            await log("sohbet", f"LEO yanıt üretti ({len(answer)} karakter).")
            if saved:
                await log("hafiza", f"{saved} yeni bilgi kalıcı hafızaya kaydedildi.")
            yield "event: done\ndata: {}\n\n"
        except LLMUnavailable as exc:
            await log("sohbet", f"AI servisi kullanılamıyor: {exc}", status="error")
            yield f"event: error\ndata: {_enc(str(exc))}\n\n"
        except Exception as exc:  # noqa: BLE001 — surfaced to the user, never swallowed
            await log("sohbet", f"Yanıt üretilemedi: {exc}", status="error")
            yield f"event: error\ndata: {_enc(f'İşlem başarısız oldu: {exc}')}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _enc(text: str) -> str:
    import json

    return json.dumps(text, ensure_ascii=False)


# --- memory ------------------------------------------------------------------
@router.get("/memory", response_model=list[Memory])
async def list_memory():
    docs = await db.memories.find().sort("created_at", -1).to_list(500)
    return [Memory(**d) for d in docs]


@router.post("/memory", response_model=Memory)
async def add_memory(body: MemoryCreate):
    m = Memory(**body.model_dump())
    await db.memories.update_one({"key": m.key}, {"$set": m.model_dump()}, upsert=True)
    await log("hafiza", f"Hafızaya eklendi: {m.key}")
    return m


@router.delete("/memory/{memory_id}")
async def delete_memory(memory_id: str):
    res = await db.memories.delete_one({"id": memory_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Hafıza kaydı bulunamadı.")
    await log("hafiza", "Hafıza kaydı silindi.")
    return {"deleted": True}


# --- activity ----------------------------------------------------------------
@router.get("/activity", response_model=list[Activity])
async def list_activity(limit: int = 60):
    docs = await db.activities.find().sort("created_at", -1).to_list(min(limit, 300))
    return [Activity(**d) for d in docs]


# --- daily brief -------------------------------------------------------------
@router.post("/brief", response_model=DailyBrief)
async def daily_brief(lang: str = "auto"):
    day = today_iso()
    open_tasks = await db.tasks.count_documents({"status": {"$ne": "tamam"}})
    critical = await db.tasks.count_documents({"status": {"$ne": "tamam"}, "priority": "kritik"})
    start = datetime.fromisoformat(day).replace(tzinfo=timezone.utc)
    completed_today = await db.tasks.count_documents(
        {"status": "tamam", "created_at": {"$gte": start}}
    )
    try:
        summary = await complete(
            session_id=f"brief-{day}",
            system_message=BASE_PERSONA.split("Kalıcı hafıza:")[0]
            + "\nGünlük yönetici özeti yazıyorsun. Maddeler halinde, en fazla 8 satır.\n"
            + lang_rule(lang),
            prompt=(
                "Aşağıdaki gerçek sistem verisine bakarak günlük özet ver: bugün ne oldu, ne bekliyor, "
                "hangi iş öncelikli, şimdi ne yapılmalı.\n\n" + await _context()
            ),
        )
        await log("brief", "Günlük yönetici özeti oluşturuldu.")
    except LLMUnavailable as exc:
        await log("brief", f"Özet üretilemedi: {exc}", status="error")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        await log("brief", f"Özet üretilemedi: {exc}", status="error")
        raise HTTPException(status_code=502, detail=f"Özet üretilemedi: {exc}") from exc

    return DailyBrief(
        date=day,
        summary=re.sub(r"\n{3,}", "\n\n", summary.strip()),
        open_tasks=open_tasks,
        critical_tasks=critical,
        completed_today=completed_today,
    )


# --- system ------------------------------------------------------------------
@router.get("/system/capabilities", response_model=list[Capability])
async def capabilities():
    return [Capability(**c) for c in capability_status()]
