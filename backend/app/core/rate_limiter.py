from datetime import datetime, timedelta
import logging
from typing import Dict, Tuple, Optional
import time
from fastapi import HTTPException, status, Request

logger = logging.getLogger(__name__)

# Store login attempts in memory
# In a production environment, you might want to use Redis or another distributed cache
# Structure: {ip_address: [(timestamp, username), ...]}
login_attempts: Dict[str, list] = {}
# Structure: {ip_address: block_until_timestamp}
blocked_ips: Dict[str, float] = {}

# Configuration
MAX_ATTEMPTS = 5  # Maximum failed attempts before blocking
BLOCK_DURATION = 15 * 60  # Block duration in seconds (15 minutes)
ATTEMPT_WINDOW = 60 * 60  # Time window to consider for attempts (1 hour)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Get the first IP in the list (the original client)
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def record_failed_attempt(request: Request, username: str) -> None:
    """Record a failed login attempt."""
    ip = get_client_ip(request)
    current_time = time.time()
    
    # Initialize if this is the first attempt from this IP
    if ip not in login_attempts:
        login_attempts[ip] = []
    
    # Add the new attempt
    login_attempts[ip].append((current_time, username))
    
    # Clean up old attempts outside the window
    window_start = current_time - ATTEMPT_WINDOW
    login_attempts[ip] = [
        attempt for attempt in login_attempts[ip]
        if attempt[0] >= window_start
    ]
    
    # Log the attempt
    attempt_count = len(login_attempts[ip])
    logger.warning(
        f"Failed login attempt {attempt_count}/{MAX_ATTEMPTS} for user '{username}' "
        f"from IP {ip}"
    )
    
    # Block IP if too many attempts
    if attempt_count >= MAX_ATTEMPTS:
        block_until = current_time + BLOCK_DURATION
        blocked_ips[ip] = block_until
        logger.warning(
            f"IP {ip} blocked until {datetime.fromtimestamp(block_until).isoformat()} "
            f"due to {attempt_count} failed login attempts"
        )


def check_ip_blocked(request: Request) -> None:
    """Check if the IP is blocked and raise an exception if it is."""
    ip = get_client_ip(request)
    current_time = time.time()
    
    # Clean up expired blocks
    expired_blocks = [ip for ip, block_until in blocked_ips.items() if block_until <= current_time]
    for expired_ip in expired_blocks:
        del blocked_ips[expired_ip]
    
    # Check if IP is blocked
    if ip in blocked_ips:
        block_until = blocked_ips[ip]
        remaining = int(block_until - current_time)
        minutes, seconds = divmod(remaining, 60)
        
        logger.warning(f"Blocked login attempt from IP {ip}")
        
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please try again in {minutes} minutes and {seconds} seconds."
        )


def clear_failed_attempts(request: Request, username: str) -> None:
    """Clear failed attempts after a successful login."""
    ip = get_client_ip(request)
    
    if ip in login_attempts:
        # Only clear attempts for this specific username from this IP
        login_attempts[ip] = [
            attempt for attempt in login_attempts[ip]
            if attempt[1] != username
        ]
        
        # If no attempts left, clean up the entry
        if not login_attempts[ip]:
            del login_attempts[ip] 