from fastapi import APIRouter, Depends, HTTPException

from lib.activity import log
from lib.auth import require_session
from lib.db import db
from lib.llm import LLMUnavailable, generate_image
from models.schemas import ImageRequest, StudioItem

router = APIRouter(prefix="/studio", tags=["studio"], dependencies=[Depends(require_session)])


@router.get("/items", response_model=list[StudioItem])
async def list_items():
    docs = await db.studio_items.find().sort("created_at", -1).to_list(100)
    return [StudioItem(**d) for d in docs]


@router.post("/image", response_model=StudioItem)
async def create_image(body: ImageRequest):
    if not body.prompt.strip():
        raise HTTPException(status_code=422, detail="İstem boş olamaz.")
    src = body.source_image_base64
    if src and "," in src[:64] and src.strip().startswith("data:"):
        src = src.split(",", 1)[1]
    try:
        result = await generate_image(body.prompt, src)
    except LLMUnavailable as exc:
        await log("gorsel", f"Görsel üretilemedi: {exc}", status="error")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        await log("gorsel", f"Görsel üretilemedi: {exc}", status="error")
        raise HTTPException(status_code=502, detail=f"Görsel üretilemedi: {exc}") from exc

    item = StudioItem(
        prompt=body.prompt,
        mime_type=result["mime_type"],
        data_url=f"data:{result['mime_type']};base64,{result['data']}",
        edited=bool(src),
    )
    await db.studio_items.insert_one(item.model_dump())
    await log("gorsel", ("Görsel düzenlendi: " if src else "Görsel üretildi: ") + body.prompt[:70])
    return item


@router.delete("/items/{item_id}")
async def delete_item(item_id: str):
    res = await db.studio_items.delete_one({"id": item_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
    await log("gorsel", "Görsel kaydı silindi.")
    return {"deleted": True}
