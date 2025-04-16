#!/usr/bin/env python3
from sqlalchemy.orm import Session
import bcrypt
import sys

# Import the necessary models and database functions
from app.db.database import SessionLocal
from app.models.user import User

def create_admin_user(username, email, password):
    """Create a new admin user in the database"""
    # Create a database session
    db = SessionLocal()
    
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            print(f"User '{username}' already exists!")
            return
        
        # Hash the password
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        
        # Create a new user
        user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            is_admin=True,
            is_active=True
        )
        
        # Add to database
        db.add(user)
        db.commit()
        print(f"Admin user '{username}' created successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error creating user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # Check command-line arguments
    if len(sys.argv) != 4:
        print("Usage: python create_admin_user.py <username> <email> <password>")
        sys.exit(1)
    
    username = sys.argv[1]
    email = sys.argv[2]
    password = sys.argv[3]
    
    # Create the user
    create_admin_user(username, email, password) 