from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import router
from app.core.config import settings
from app.db.session import SessionLocal, engine
from app.models.base import Base
from app.models import entities  # noqa: F401
from app.services.schema import ensure_runtime_schema
from app.services.scheduler import start_scheduler, stop_scheduler
from app.services.seed import seed_demo_data, seed_system_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()
    with SessionLocal() as db:
        seed_system_data(db)
        seed_demo_data(db)
    start_scheduler()
    try:
        yield
    finally:
        stop_scheduler()


app = FastAPI(title=settings.app_name, version=__version__, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
