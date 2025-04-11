from fastapi import APIRouter

from app.api.v1.endpoints import auth, projects, maps, events, map_events, event_comments, users, monitoring, notifications, event_history

api_router = APIRouter()

# Authentication routes
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Project routes
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])

# Maps routes
api_router.include_router(maps.router, prefix="/maps", tags=["maps"])

# Events routes
api_router.include_router(events.router, prefix="/events", tags=["events"])

# Map Events routes (nested events)
api_router.include_router(map_events.router, prefix="/maps/{map_id}/events", tags=["map-events"])

# Event Comments routes
api_router.include_router(event_comments.router, prefix="/events", tags=["event-comments"])

# Event History routes
api_router.include_router(event_history.router, prefix="/events", tags=["event-history"])

# User routes
api_router.include_router(users.router, prefix="/users", tags=["users"])

# Monitoring routes
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["monitoring"])

# Notifications routes
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"]) 