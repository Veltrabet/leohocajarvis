"""CRM — potansiyel müşteri takibi + AI ile iletişim metni üretimi.

Etik sınır: burada sadece OPERATÖRÜN KENDİ girdiği müşteri kayıtları tutulur ve
onun adına mesaj TASLAĞI üretilir. Üçüncü kişiler hakkında açık kaynak istihbaratı
(telefon/isimden kişi araştırma) veya otomatik kitlesel mesaj gönderimi yapılmaz.
"""

from fastapi import APIRouter, Depends, HTTPException

from lib.activity import log
from lib.auth import require_session
from lib.db import db
from lib.llm import LLMUnavailable, complete, lang_rule
from models.schemas import (
    GeneratedText,
    Lead,
    LeadCreate,
    LeadNote,
    LeadUpdate,
    OutreachRequest,
)

router = APIRouter(prefix="/crm", tags=["crm"], dependencies=[Depends(require_session)])

CHANNEL_LABEL = {
    "instagram_dm": "Instagram DM (kısa, samimi, emoji az)",
    "eposta": "E-posta (konu satırı + gövde, resmi)",
    "whatsapp": "WhatsApp mesajı (kısa, doğal)",
}


@router.get("/leads", response_model=list[Lead])
async def list_leads():
    docs = await db.leads.find().sort("created_at", -1).to_list(500)
    return [Lead(**d) for d in docs]


@router.post("/leads", response_model=Lead)
async def create_lead(body: LeadCreate):
    lead = Lead(**body.model_dump())
    await db.leads.insert_one(lead.model_dump())
    await log("crm", f"Yeni potansiyel müşteri: {lead.name}")
    return lead


@router.patch("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, body: LeadUpdate):
    patch = body.model_dump(exclude_unset=True, exclude_none=True)
    doc = await db.leads.find_one_and_update({"id": lead_id}, {"$set": patch}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Müşteri kaydı bulunamadı.")
    await log("crm", f"Müşteri güncellendi: {doc['name']} → {doc['stage']}")
    return Lead(**doc)


@router.post("/leads/{lead_id}/notes", response_model=Lead)
async def add_note(lead_id: str, body: LeadNote):
    doc = await db.leads.find_one_and_update(
        {"id": lead_id}, {"$push": {"notes": body.note}}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Müşteri kaydı bulunamadı.")
    await log("crm", f"Görüşme notu eklendi: {doc['name']}")
    return Lead(**doc)


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    res = await db.leads.delete_one({"id": lead_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Müşteri kaydı bulunamadı.")
    await log("crm", "Müşteri kaydı silindi.")
    return {"deleted": True}


@router.post("/leads/{lead_id}/outreach", response_model=GeneratedText)
async def outreach(lead_id: str, body: OutreachRequest):
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Müşteri kaydı bulunamadı.")

    mems = await db.memories.find().sort("created_at", -1).to_list(40)
    style = "\n".join(f"- {m['key']}: {m['value']}" for m in mems) or "- (kayıt yok)"

    system = (
        "Sen LEO'sun — LeoHoca'nın (Q8Ka By Leohoca, yazılım/web/IT/sosyal medya ajansı) "
        "kişisel asistanısın. LeoHoca ADINA mesaj TASLAĞI yazıyorsun; taslağı o gözden geçirip "
        "kendisi gönderecek. Kimseyi yanıltma, kimliğini gizleyerek başka biri gibi davranma, "
        "asılsız vaat ve baskı kurma. Spam değil, gerçek değer öneren tek bir mesaj yaz.\n"
        + lang_rule(body.lang)
    )
    prompt = (
        f"Kanal: {CHANNEL_LABEL.get(body.channel, body.channel)}\n"
        f"Ton: {body.tone}\nAmaç: {body.goal}\n\n"
        f"Alıcı: {lead['name']} | Firma: {lead.get('company') or '-'} | "
        f"Kullanıcı adı: {lead.get('handle') or '-'}\n"
        f"İhtiyaç/bağlam: {lead.get('need') or '-'}\n"
        f"Aşama: {lead.get('stage')}\n"
        f"Önceki notlar: {' | '.join(lead.get('notes') or []) or '-'}\n\n"
        f"LeoHoca'nın tarzı ve tercihleri (kalıcı hafıza):\n{style}\n\n"
        "Sadece gönderilmeye hazır mesaj metnini yaz. Açıklama ekleme."
    )
    try:
        content = await complete(f"outreach-{lead_id}", system, prompt)
    except LLMUnavailable as exc:
        await log("crm", f"Mesaj taslağı üretilemedi: {exc}", status="error")
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    item = GeneratedText(kind=f"outreach:{body.channel}", topic=lead["name"], content=content.strip(), lang=body.lang)
    await db.generated_texts.insert_one(item.model_dump())
    await db.leads.update_one(
        {"id": lead_id}, {"$push": {"notes": f"[taslak/{body.channel}] {content.strip()[:180]}"}}
    )
    await log("crm", f"Mesaj taslağı hazırlandı: {lead['name']} ({body.channel}) — gönderim yapılmadı.")
    return item
