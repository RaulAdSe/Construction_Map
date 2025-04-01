from fastapi import APIRouter

from app.api.v1.endpoints import auth, projects, maps, events, map_events, event_comments, users, monitoring, notifications

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
# Don't use path parameters with forms - use query params instead
# api_router.include_router(maps.router, prefix="/projects/{project_id}/maps", tags=["maps"])
api_router.include_router(maps.router, prefix="/maps", tags=["maps"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
# Use dedicated router for nested map events
api_router.include_router(map_events.router, prefix="/maps/{map_id}/events", tags=["map-events"])
api_router.include_router(event_comments.router, prefix="/events", tags=["event-comments"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["monitoring"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"]) 