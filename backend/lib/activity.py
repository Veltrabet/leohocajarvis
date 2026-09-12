"""Activity log helper — every meaningful JARVIS operation lands here."""

from lib.db import db
from models.schemas import Activity


async def log(kind: str, message: str, status: str = "ok") -> Activity:
    act = Activity(kind=kind, message=message, status=status)  # type: ignore[arg-type]
    try:
        await db.activities.insert_one(act.model_dump())
    except Exception:
        pass
    return act
