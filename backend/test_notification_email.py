import os
import sys
import logging
import traceback
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("test_notification_email")

# Add app directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import services
from app.services.notification import NotificationService
from app.db.database import get_db
from app.models.user import User

def test_notification_email():
    """
    Test sending a notification email with improved formatting
    """
    try:
        # Get database session
        db_session = next(get_db())
        
        # Get username from input or use a default
        username = input("Enter username to send test notification to (or press Enter for admin): ") or "admin"
        
        # Get notification type from input
        print("\nSelect notification type:")
        print("1. Event interaction (view, update, like)")
        print("2. New comment")
        print("3. User mention")
        print("4. General test notification")
        
        choice = input("Enter your choice (1-4): ") or "4"
        
        # Look up the user
        user = db_session.query(User).filter(User.username == username).first()
        
        if not user:
            logger.error(f"User {username} not found in database")
            return
            
        logger.info(f"Found user: {user.username} (ID: {user.id})")
        
        # Create notification message based on choice
        message = "This is a test notification."
        link = "/dashboard"
        
        if choice == "1":
            # Event interaction - we'll create a fake event ID
            event_id = 123
            interaction_type = input("Enter interaction type (view/update/upload/download/like): ") or "view"
            message = f"Someone {interaction_type}ed your event"
            link = f"/events/{event_id}"
        elif choice == "2":
            # New comment on an event
            event_id = 123
            message = "New comment on your event"
            link = f"/events/{event_id}#comments"
        elif choice == "3":
            # User mention
            event_id = 123
            message = "You were mentioned in a comment"
            link = f"/events/{event_id}#comments"
        else:
            # Test notification
            message = "This is a test notification from Servitec Planos"
        
        logger.info(f"Sending notification: '{message}' to {user.username} with link: {link}")
        
        # Create notification data
        from app.schemas.notification import NotificationCreate
        
        notification_data = NotificationCreate(
            user_id=user.id,
            message=message,
            link=link,
            notification_type="test"
        )
        
        # Create notification
        result = NotificationService.create_notification(
            db=db_session,
            notification=notification_data
        )
        
        if result:
            logger.info(f"Notification email sent successfully to {user.email}")
        else:
            logger.error(f"Failed to send notification email to {user.email}")
            
    except Exception as e:
        logger.error(f"Error testing notification email: {str(e)}")
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    test_notification_email() 