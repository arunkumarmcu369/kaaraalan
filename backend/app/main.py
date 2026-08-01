from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import settings
from app.db.seed import seed_admin, seed_dealers, seed_flavours
from app.db.session import AsyncSessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kaaralan")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as db:
        try:
            await seed_admin(db)
            await seed_flavours(db)
            await seed_dealers(db)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error("Seed failed (is the database up?): %s", e)
    yield


app = FastAPI(title="Kaaralan Goli Soda API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok", "app": "Kaaralan Goli Soda"}

