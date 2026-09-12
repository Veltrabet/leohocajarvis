"""Instagram İçerik Ajansı — gerçek AI ile içerik üretimi (gönderim yapılmaz).

Instagram'a otomatik gönderi/DM atma bu sürümde BAĞLI DEĞİL. Resmi yol Instagram
Graph API + Meta Business hesabıdır; token tanımlıysa /system/capabilities bunu
'BAĞLI' gösterir, aksi halde açıkça 'BAĞLI DEĞİL' der.
"""

from fastapi import APIRouter, Depends, HTTPException

from lib.activity import log
from lib.auth import require_session
from lib.db import db
from lib.llm import LLMUnavailable, complete, lang_rule
from models.schemas import GeneratedText, SocialRequest

router = APIRouter(prefix="/social", tags=["social"], dependencies=[Depends(require_session)])

BRIEFS = {
    "post": "Instagram feed gönderisi: kanca (1. satır), 3-5 satır gövde, net bir CTA, en sonda 12-18 hashtag.",
    "reels": "Reels senaryosu: 0-3sn kanca, sahne sahne çekim planı (görüntü + ekran metni), seslendirme metni, süre ~20sn, sonunda CTA.",
    "caption": "Sadece gönderi açıklaması (caption): kısa, güçlü, 2-3 satır + 1 CTA.",
    "hashtags": "30 hashtag; 10 geniş, 10 niş, 10 yerel/sektörel olarak gruplandır.",
    "takvim": "7 günlük içerik takvimi tablosu: gün | format (post/reels/story) | konu | kanca | CTA.",
    "dm": "Instagram DM taslağı: 2-4 satır, satış baskısı yok, değer önerisi net, tek soru ile bitir.",
    "biyografi": "Instagram profil biyografisi: 3 alternatif, her biri 150 karakter altı, emoji dengeli.",
}


@router.get("/items", response_model=list[GeneratedText])
async def list_items():
    docs = await db.generated_texts.find().sort("created_at", -1).to_list(120)
    return [GeneratedText(**d) for d in docs]


@router.delete("/items/{item_id}")
async def delete_item(item_id: str):
    res = await db.generated_texts.delete_one({"id": item_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
    return {"deleted": True}


@router.post("/generate", response_model=GeneratedText)
async def generate(body: SocialRequest):
    if not body.topic.strip():
        raise HTTPException(status_code=422, detail="Konu boş olamaz.")

    mems = await db.memories.find().sort("created_at", -1).to_list(40)
    style = "\n".join(f"- {m['key']}: {m['value']}" for m in mems) or "- (kayıt yok)"

    system = (
        "Sen LEO'sun — Q8Ka By Leohoca dijital ajansının sosyal medya direktörüsün. "
        "Gerçekten yayınlanabilir, klişesiz, yüksek dönüşümlü içerik yazarsın. "
        "Asılsız iddia ve sahte sosyal kanıt kullanmazsın.\n" + lang_rule(body.lang)
    )
    prompt = (
        f"Görev: {BRIEFS[body.kind]}\nKonu: {body.topic}\nTon: {body.tone}\n\n"
        f"Marka bağlamı ve operatör tercihleri:\n{style}\n\n"
        "Doğrudan içeriği ver, ön açıklama yazma."
    )
    try:
        content = await complete(f"social-{body.kind}", system, prompt)
    except LLMUnavailable as exc:
        await log("sosyal", f"İçerik üretilemedi: {exc}", status="error")
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    item = GeneratedText(kind=body.kind, topic=body.topic, content=content.strip(), lang=body.lang)
    await db.generated_texts.insert_one(item.model_dump())
    await log("sosyal", f"Instagram içeriği üretildi ({body.kind}): {body.topic[:60]}")
    return item
