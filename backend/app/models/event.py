from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.hybrid import hybrid_property
import json

from app.db.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    map_id = Column(Integer, ForeignKey("maps.id"), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)  # Renamed to attachment_url for backward compatibility
    file_type = Column(String, nullable=True)  # 'image' or 'pdf'
    status = Column(String, default="open", nullable=False)
    state = Column(String, default="green", nullable=False)  # Values: red, yellow, green
    _active_maps = Column(JSON, nullable=True, name="active_maps")  # JSON data of active map layers when event was created
    tags = Column(JSON, nullable=True)  # JSON field for storing tags or mentions
    x_coordinate = Column(Float, nullable=False)
    y_coordinate = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Property to ensure active_maps is always a dictionary
    @hybrid_property
    def active_maps(self):
        # If active_maps is None or a list, return an empty dict
        if self._active_maps is None or isinstance(self._active_maps, list):
            return {}
        return self._active_maps
    
    @active_maps.setter
    def active_maps(self, value):
        # Ensure we always store a dictionary
        if value is None or isinstance(value, list):
            self._active_maps = {}
        else:
            self._active_maps = value

    # Relationships
    project = relationship("Project", back_populates="events")
    map = relationship("Map", back_populates="events")
    created_by_user = relationship("User", back_populates="events")
    comments = relationship("EventComment", back_populates="event", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="event")
    history = relationship("EventHistory", back_populates="event", cascade="all, delete-orphan") 