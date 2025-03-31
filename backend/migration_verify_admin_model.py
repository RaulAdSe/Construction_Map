"""
Migration verification script for the simplified admin model.
This script verifies that all users have the is_admin field correctly set
and ensures no outdated role fields remain in the database.
"""

from app.db.database import SessionLocal
from sqlalchemy import text, inspect
import sys


def verify_admin_model():
    """Verify that all users have the is_admin field properly set."""
    db = SessionLocal()
    try:
        print("🔍 Verifying admin model migration...")
        
        # Check if the is_admin column exists on the users table
        inspector = inspect(db.bind)
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'is_admin' not in columns:
            print("❌ ERROR: is_admin column is missing from users table")
            return False
        
        # Check if the role column still exists (it should have been removed)
        if 'role' in columns:
            print("❌ ERROR: role column still exists in users table")
            return False
        
        # Verify that at least one admin user exists using raw SQL
        result = db.execute(text("SELECT COUNT(*) FROM users WHERE is_admin = true"))
        admin_count = result.scalar()
        
        if admin_count == 0:
            print("⚠️ WARNING: No admin users found in the database")
            print("Consider running the create_admin.py script to create an admin user")
        else:
            print(f"✅ Found {admin_count} admin users")
        
        # Verify the project_users table structure
        project_users_columns = [col['name'] for col in inspector.get_columns('project_users')]
        if 'role' in project_users_columns:
            print("❌ ERROR: role column still exists in project_users table")
            return False
        
        print("✅ Database structure is correctly migrated to simplified admin model")
        return True
    
    except Exception as e:
        print(f"❌ ERROR during verification: {str(e)}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = verify_admin_model()
    sys.exit(0 if success else 1) 