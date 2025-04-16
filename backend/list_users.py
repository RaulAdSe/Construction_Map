#!/usr/bin/env python3
"""
List all users in the database
"""

import os
import sys
import logging
from tabulate import tabulate

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the current directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

try:
    # Import application modules
    from app.db.database import SessionLocal
    from app.models.user import User
    from sqlalchemy.orm import Session
except ImportError as e:
    logger.error(f"Error importing application modules: {e}")
    logger.error("Make sure you're running this script from the backend directory")
    sys.exit(1)

def list_users(db: Session):
    """List all users in the database"""
    
    # Get all users
    users = db.query(User).all()
    
    if not users:
        logger.info("No users found in the database")
        return
    
    # Prepare user data for display
    user_data = []
    for user in users:
        # Mask the password hash to avoid exposing sensitive data
        masked_password = user.password_hash[:10] + "..." if user.password_hash else None
        
        user_data.append([
            user.id,
            user.username,
            user.email,
            masked_password,
            user.is_admin,
            user.is_active
        ])
    
    # Print table
    headers = ["ID", "Username", "Email", "Password Hash (masked)", "Admin", "Active"]
    print("\nUSERS IN DATABASE:\n")
    print(tabulate(user_data, headers=headers, tablefmt="grid"))
    print(f"\nTotal users: {len(users)}\n")

if __name__ == "__main__":
    try:
        logger.info("Connecting to database...")
        db = SessionLocal()
        list_users(db)
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)
    finally:
        logger.info("Closing database connection")
        db.close()
        
    logger.info("Script completed successfully") 