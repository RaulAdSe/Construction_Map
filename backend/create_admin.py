from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy.orm import Session
import sys


def create_admin_user(db: Session):
    # Check if admin user already exists
    admin = db.query(User).filter(User.username == "admin").first()
    
    if admin:
        print("Admin user already exists")
        return
    
    # Create admin user
    hashed_password = get_password_hash("admin")
    admin_user = User(
        username="admin",
        email="admin@example.com",
        password_hash=hashed_password,
        role="admin",
        is_active=True
    )
    
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    print("Admin user created successfully!")


if __name__ == "__main__":
    try:
        db = SessionLocal()
        create_admin_user(db)
    except Exception as e:
        print(f"Error creating admin user: {e}")
        sys.exit(1)
    finally:
        db.close() 