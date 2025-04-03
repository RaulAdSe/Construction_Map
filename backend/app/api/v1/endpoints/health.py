from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
import time
import os
import platform
import psutil
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from app.db.session import get_db
from app.core.storage import storage_service

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory cache for system stats to prevent frequent calculations
_system_stats_cache = {
    "last_update": datetime.now() - timedelta(minutes=5),  # Ensure first call updates
    "data": {}
}

@router.get("/", summary="Basic health check")
def health_check():
    """Basic health check endpoint for load balancers and Cloud Run."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@router.get("/db", summary="Database health check")
def database_health(db: Session = Depends(get_db)):
    """Check database connectivity and performance."""
    try:
        start_time = time.time()
        result = db.execute(text("SELECT 1")).scalar()
        query_time = time.time() - start_time
        
        return {
            "status": "healthy" if result == 1 else "degraded",
            "timestamp": datetime.now().isoformat(),
            "result": result,
            "query_time_ms": round(query_time * 1000, 2),
            "database": os.getenv("POSTGRES_DB", "unknown")
        }
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database health check failed: {str(e)}"
        )

@router.get("/storage", summary="Storage health check")
def storage_health():
    """Check storage system health (local or cloud)."""
    try:
        # Check if uploads directory exists and is writable
        uploads_dir = os.getenv("UPLOAD_FOLDER", "./uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        
        # Check if we can write to the directory
        test_file = os.path.join(uploads_dir, ".health_check_test")
        with open(test_file, "w") as f:
            f.write("health check")
        os.remove(test_file)
        
        # Get storage details
        storage_info = {
            "type": "cloud" if storage_service.cloud_storage_enabled else "local",
            "path": uploads_dir,
            "status": "healthy"
        }
        
        # Add cloud-specific information if using cloud storage
        if storage_service.cloud_storage_enabled:
            storage_info["bucket"] = storage_service.bucket_name
            storage_info["project"] = os.getenv("GOOGLE_CLOUD_PROJECT", "unknown")
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "storage": storage_info
        }
    except Exception as e:
        logger.error(f"Storage health check failed: {str(e)}")
        return {
            "status": "degraded",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

@router.get("/system", summary="System health and resources")
def system_health():
    """Check system resources like CPU, memory, and disk usage."""
    global _system_stats_cache
    
    # Only recalculate system stats every 60 seconds
    if (datetime.now() - _system_stats_cache["last_update"]).total_seconds() > 60:
        try:
            # Get CPU usage
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            # Get memory usage
            memory = psutil.virtual_memory()
            memory_used_mb = round(memory.used / (1024 * 1024), 2)
            memory_total_mb = round(memory.total / (1024 * 1024), 2)
            memory_percent = memory.percent
            
            # Get disk usage for the upload directory
            uploads_dir = os.getenv("UPLOAD_FOLDER", "./uploads")
            disk = psutil.disk_usage(uploads_dir)
            disk_used_gb = round(disk.used / (1024 * 1024 * 1024), 2)
            disk_total_gb = round(disk.total / (1024 * 1024 * 1024), 2)
            disk_percent = disk.percent
            
            # Get system information
            system_info = {
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "hostname": platform.node(),
                "pid": os.getpid(),
                "process_uptime_sec": time.time() - psutil.Process(os.getpid()).create_time()
            }
            
            # Update cache
            _system_stats_cache["data"] = {
                "cpu": {
                    "percent": cpu_percent
                },
                "memory": {
                    "used_mb": memory_used_mb,
                    "total_mb": memory_total_mb,
                    "percent": memory_percent
                },
                "disk": {
                    "used_gb": disk_used_gb,
                    "total_gb": disk_total_gb,
                    "percent": disk_percent
                },
                "system": system_info
            }
            _system_stats_cache["last_update"] = datetime.now()
        except Exception as e:
            logger.error(f"Error collecting system stats: {str(e)}")
            return {
                "status": "degraded",
                "timestamp": datetime.now().isoformat(),
                "error": str(e)
            }
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "last_updated": _system_stats_cache["last_update"].isoformat(),
        **_system_stats_cache["data"]
    }

@router.get("/full", summary="Full health check")
def full_health_check(db: Session = Depends(get_db)):
    """Comprehensive health check that includes all subsystems."""
    db_health = database_health(db)
    storage_health_info = storage_health()
    sys_health = system_health()
    
    # Determine overall status
    overall_status = "healthy"
    if db_health.get("status") != "healthy" or storage_health_info.get("status") != "healthy" or sys_health.get("status") != "healthy":
        overall_status = "degraded"
    
    # Get environment information
    environment = os.getenv("ENVIRONMENT", "development")
    
    return {
        "status": overall_status,
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "environment": environment,
        "database": db_health,
        "storage": storage_health_info,
        "system": sys_health
    } 