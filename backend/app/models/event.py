from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    map_id = Column(Integer, ForeignKey("maps.id"), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    status = Column(String, default="open", nullable=False)
    state = Column(String, default="green", nullable=False)  # Values: red, yellow, green
    active_maps = Column(JSON, nullable=True)  # JSON data of active map layers when event was created
    tags = Column(JSON, nullable=True)  # JSON field for storing tags or mentions
    x_coordinate = Column(Float, nullable=False)
    y_coordinate = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="events")
    map = relationship("Map", back_populates="events")
    created_by_user = relationship("User", back_populates="events")
    comments = relationship("EventComment", back_populates="event", cascade="all, delete-orphan") 