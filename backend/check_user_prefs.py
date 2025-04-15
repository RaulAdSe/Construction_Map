import os
import sys
from dotenv import load_dotenv
from sqlalchemy.orm import Session

# Load environment variables
load_dotenv()

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import database models
from app.db.database import SessionLocal
from app.models.user import User
from app.models.user_preference import UserPreference

def check_user_preferences():
    db = SessionLocal()
    try:
        # Query all users
        users = db.query(User).all()
        print(f"Found {len(users)} users in the database")
        
        for user in users:
            print(f"\nUser ID: {user.id}")
            print(f"Username: {user.username}")
            print(f"Email: {user.email}")
            print(f"Is Admin: {user.is_admin}")
            print(f"Is Active: {user.is_active}")
            
            # Check if user has preferences
            prefs = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
            if prefs:
                print(f"Email Notifications Enabled: {prefs.email_notifications}")
            else:
                print("No preferences found - defaults to email notifications enabled")
    finally:
        db.close()

if __name__ == "__main__":
    check_user_preferences() 