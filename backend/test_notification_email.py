import os
import sys
import logging
from sqlalchemy.orm import Session

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("test_notification")

# Add app directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import services and DB
from app.db.database import get_db
from app.services.notification import NotificationService
from app.schemas.notification import NotificationCreate

def test_notification_email():
    """Test sending a notification email with project information"""
    # Get database session
    db = next(get_db())
    
    # Get a test username and event ID
    username = input("Enter recipient username: ")
    event_id = input("Enter event ID (or leave blank): ")
    
    # Look up user by username
    from app.models.user import User
    user = db.query(User).filter(User.username == username).first()
    
    if not user:
        logger.error(f"User '{username}' not found")
        return
    
    logger.info(f"Found user: {user.username} (ID: {user.id}, Email: {user.email})")
    
    # Create a notification link
    link = f"/dashboard/notifications"
    if event_id:
        link = f"/events/{event_id}"
    
    # Create notification message
    message = "Este es una prueba de notificación con información del proyecto"
    
    # Create notification
    notification_data = NotificationCreate(
        user_id=user.id,
        message=message,
        link=link,
        notification_type="test",
        event_id=int(event_id) if event_id else None
    )
    
    # Send notification
    logger.info(f"Creating notification for user {user.username}")
    notification = NotificationService.create_notification(db, notification_data)
    
    if notification:
        logger.info(f"Successfully created notification (ID: {notification.id})")
    else:
        logger.error("Failed to create notification")

if __name__ == "__main__":
    test_notification_email() 