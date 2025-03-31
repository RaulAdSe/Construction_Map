from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from sqlalchemy.sql import func

from api.db.database import Base


class Metric(Base):
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    value = Column(Float, nullable=False)
    tags = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<Metric(name='{self.name}', value={self.value}, timestamp='{self.timestamp}')>" 