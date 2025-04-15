from sqlalchemy.orm import Session
from typing import Optional

from app.models.user_preference import UserPreference
from app.schemas.user_preference import UserPreferenceCreate, UserPreferenceUpdate


class UserPreferenceService:
    @staticmethod
    def get_user_preference(db: Session, user_id: int) -> Optional[UserPreference]:
        """Get user preference by user_id"""
        return db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
    
    @staticmethod
    def create_user_preference(db: Session, preference: UserPreferenceCreate) -> UserPreference:
        """Create a new user preference"""
        db_preference = UserPreference(
            user_id=preference.user_id,
            email_notifications=preference.email_notifications
        )
        db.add(db_preference)
        db.commit()
        db.refresh(db_preference)
        return db_preference
    
    @staticmethod
    def update_user_preference(
        db: Session, 
        user_id: int, 
        preference: UserPreferenceUpdate
    ) -> Optional[UserPreference]:
        """Update user preference"""
        db_preference = UserPreferenceService.get_user_preference(db, user_id)
        if not db_preference:
            return None
        
        # Update preference fields
        for key, value in preference.dict().items():
            setattr(db_preference, key, value)
        
        db.commit()
        db.refresh(db_preference)
        return db_preference
    
    @staticmethod
    def delete_user_preference(db: Session, user_id: int) -> bool:
        """Delete user preference"""
        db_preference = UserPreferenceService.get_user_preference(db, user_id)
        if not db_preference:
            return False
        
        db.delete(db_preference)
        db.commit()
        return True
    
    @staticmethod
    def get_or_create_user_preference(db: Session, user_id: int) -> UserPreference:
        """Get user preference or create it if it doesn't exist"""
        db_preference = UserPreferenceService.get_user_preference(db, user_id)
        if not db_preference:
            db_preference = UserPreference(
                user_id=user_id,
                email_notifications=True  # Default value
            )
            db.add(db_preference)
            db.commit()
            db.refresh(db_preference)
        
        return db_preference

    @staticmethod
    def has_email_notifications_enabled(db: Session, user_id: int) -> bool:
        """Check if user has email notifications enabled"""
        preference = UserPreferenceService.get_user_preference(db, user_id)
        
        # If no preference exists, default to True (enabled)
        if not preference:
            return True
            
        return preference.email_notifications

    @staticmethod
    def toggle_email_notifications(db: Session, user_id: int) -> UserPreference:
        """Toggle email notifications setting for a user"""
        preference = UserPreferenceService.get_or_create_user_preference(db, user_id)
        
        # Toggle the setting
        preference.email_notifications = not preference.email_notifications
        db.commit()
        db.refresh(preference)
        
        return preference 