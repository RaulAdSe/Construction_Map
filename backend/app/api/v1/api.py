from fastapi import APIRouter

from app.api.v1.endpoints import auth, projects, maps, events

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
# Fix: remove the nested route with path parameter to avoid Form validation issue
# api_router.include_router(maps.router, prefix="/projects/{project_id}/maps", tags=["maps"])
api_router.include_router(maps.router, prefix="/maps", tags=["maps"])
api_router.include_router(events.router, prefix="/events", tags=["events"]) 