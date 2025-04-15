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

def fix_user_email():
    db = SessionLocal()
    try:
        # Find the admin user
        admin_user = db.query(User).filter(User.username == "admin").first()
        
        if not admin_user:
            print("Admin user not found!")
            return
            
        print(f"Found admin user: {admin_user.username}")
        print(f"Current email: {admin_user.email}")
        
        # Fix the email
        old_email = admin_user.email
        admin_user.email = "servitec.ingenieria.rd@gmail.com"
        
        # Commit the change
        db.commit()
        
        print(f"Updated email from '{old_email}' to '{admin_user.email}'")
        
    finally:
        db.close()

if __name__ == "__main__":
    fix_user_email() 