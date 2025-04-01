from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel


class MetricCreate(BaseModel):
    name: str
    value: float
    tags: Optional[Dict[str, Any]] = None


class Metric(MetricCreate):
    id: int
    timestamp: datetime
    
    class Config:
        orm_mode = True


class MetricsList(BaseModel):
    metrics: List[Metric]
    total: int


class SystemMetrics(BaseModel):
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    api_requests_per_minute: float
    error_rate_percent: float
    active_users: int
    timestamp: datetime 