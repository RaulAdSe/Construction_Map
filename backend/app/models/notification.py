from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String, nullable=False)
    notification_type = Column(String, nullable=False)  # 'event_interaction', 'comment', 'mention', etc.
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Source references
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    comment_id = Column(Integer, ForeignKey("event_comments.id"), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="notifications")
    event = relationship("Event", back_populates="notifications")
    comment = relationship("EventComment", back_populates="notifications") 