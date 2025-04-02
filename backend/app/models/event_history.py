from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class EventHistory(Base):
    __tablename__ = "event_history"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action_type = Column(String, nullable=False)  # 'create', 'status_change', 'type_change', 'comment', 'edit'
    previous_value = Column(String, nullable=True)  # Previous status/type/etc.
    new_value = Column(String, nullable=True)  # New status/type/etc.
    additional_data = Column(JSON, nullable=True)  # Additional data like comment ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    event = relationship("Event", back_populates="history")
    user = relationship("User", back_populates="event_history")

    def __repr__(self):
        return f"<EventHistory(id={self.id}, event_id={self.event_id}, action_type={self.action_type})>" 