import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from lib.db import client, db, ensure_indexes  # noqa: E402
from routers import auth as auth_router  # noqa: E402
from routers import jarvis as jarvis_router  # noqa: E402
from routers import crm as crm_router  # noqa: E402
from routers import social as social_router  # noqa: E402
from routers import studio as studio_router  # noqa: E402
from routers import work as work_router  # noqa: E402
from routers import voice as voice_router  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())
    yield
    client.close()


app = FastAPI(title="LEO — Q8Ka By Leohoca", lifespan=lifespan)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "LEO online", "system": "Q8Ka By Leohoca"}


@api_router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "degraded", "database": f"error: {exc}"}


api_router.include_router(auth_router.router)
api_router.include_router(jarvis_router.router)
api_router.include_router(work_router.router)
api_router.include_router(studio_router.router)
api_router.include_router(crm_router.router)
api_router.include_router(social_router.router)
api_router.include_router(voice_router.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Include the router in the main app — must stay the last statement.
app.include_router(api_router)
