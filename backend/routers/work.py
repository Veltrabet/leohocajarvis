from fastapi import APIRouter, Depends, HTTPException

from lib.activity import log
from lib.auth import require_session
from lib.db import db
from models.schemas import Project, ProjectCreate, ProjectUpdate, Task, TaskCreate, TaskUpdate

router = APIRouter(tags=["work"], dependencies=[Depends(require_session)])


# --- projects ----------------------------------------------------------------
@router.get("/projects", response_model=list[Project])
async def list_projects():
    docs = await db.projects.find().sort("created_at", -1).to_list(500)
    return [Project(**d) for d in docs]


@router.post("/projects", response_model=Project)
async def create_project(body: ProjectCreate):
    p = Project(**body.model_dump())
    await db.projects.insert_one(p.model_dump())
    await log("proje", f"Yeni proje oluşturuldu: {p.name}")
    return p


@router.patch("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, body: ProjectUpdate):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    doc = await db.projects.find_one_and_update(
        {"id": project_id}, {"$set": patch}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Proje bulunamadı.")
    await log("proje", f"Proje güncellendi: {doc['name']}")
    return Project(**doc)


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    res = await db.projects.delete_one({"id": project_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Proje bulunamadı.")
    await db.tasks.update_many({"project_id": project_id}, {"$set": {"project_id": None}})
    await log("proje", "Proje silindi.")
    return {"deleted": True}


# --- tasks -------------------------------------------------------------------
@router.get("/tasks", response_model=list[Task])
async def list_tasks():
    docs = await db.tasks.find().sort("created_at", -1).to_list(1000)
    return [Task(**d) for d in docs]


@router.post("/tasks", response_model=Task)
async def create_task(body: TaskCreate):
    t = Task(**body.model_dump())
    await db.tasks.insert_one(t.model_dump())
    await log("gorev", f"Görev oluşturuldu: {t.title}")
    return t


@router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, body: TaskUpdate):
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    doc = await db.tasks.find_one_and_update(
        {"id": task_id}, {"$set": patch}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Görev bulunamadı.")
    await log("gorev", f"Görev güncellendi: {doc['title']} → {doc['status']}")
    return Task(**doc)


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    res = await db.tasks.delete_one({"id": task_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Görev bulunamadı.")
    await log("gorev", "Görev silindi.")
    return {"deleted": True}
