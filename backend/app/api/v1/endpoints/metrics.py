from fastapi import APIRouter, Response
import psutil
import os
from app.core.metrics import collect_metrics, update_system_metrics

router = APIRouter()

@router.get("/", summary="Prometheus metrics")
async def metrics():
    """Expose application metrics in Prometheus format."""
    # Update system metrics before collecting
    memory = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=0.1)
    
    # Update system metrics
    update_system_metrics(memory.used, cpu_percent)
    
    # Return metrics in Prometheus format
    return Response(
        content=collect_metrics(),
        media_type="text/plain"
    ) 