from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class Map(Base):
    __tablename__ = "maps"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    map_type = Column(String, nullable=False)  # 'implantation' or 'overlay'
    filename = Column(String, nullable=False)
    name = Column(String, nullable=False)
    version = Column(Float, nullable=False, default=1.0)  # Add version number field
    transform_data = Column(JSON, nullable=True)  # JSON field for alignment info
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="maps") 