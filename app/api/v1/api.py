from fastapi import APIRouter

from app.api.v1.endpoints import auth, projects, maps, events

api_router = APIRouter()

# Authentication routes
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Project routes
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])

# Maps routes
api_router.include_router(maps.router, prefix="/maps", tags=["maps"])

# Events routes
api_router.include_router(events.router, prefix="/events", tags=["events"]) 