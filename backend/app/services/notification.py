from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import re

from app.models.notification import Notification
from app.models.user import User
from app.models.event import Event
from app.schemas.notification import NotificationCreate, NotificationUpdate


class NotificationService:
    @staticmethod
    def create_notification(db: Session, notification: NotificationCreate) -> Notification:
        """Create a new notification"""
        db_notification = Notification(
            user_id=notification.user_id,
            message=notification.message,
            link=notification.link,
            notification_type=notification.notification_type,
            event_id=notification.event_id,
            comment_id=notification.comment_id,
            read=False
        )
        db.add(db_notification)
        db.commit()
        db.refresh(db_notification)
        return db_notification
    
    @staticmethod
    def get_user_notifications(db: Session, user_id: int, skip: int = 0, limit: int = 20) -> List[Notification]:
        """Get notifications for a specific user"""
        return db.query(Notification).filter(
            Notification.user_id == user_id
        ).order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_unread_count(db: Session, user_id: int) -> int:
        """Get count of unread notifications for a user"""
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.read == False
        ).count()
    
    @staticmethod
    def mark_as_read(db: Session, notification_id: int, user_id: int) -> Optional[Notification]:
        """Mark a notification as read"""
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if notification:
            notification.read = True
            db.commit()
            db.refresh(notification)
        
        return notification
    
    @staticmethod
    def mark_all_as_read(db: Session, user_id: int) -> int:
        """Mark all notifications as read for a user"""
        result = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.read == False
        ).update({"read": True})
        
        db.commit()
        return result
    
    @staticmethod
    def delete_notification(db: Session, notification_id: int, user_id: int) -> bool:
        """Delete a notification"""
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if notification:
            db.delete(notification)
            db.commit()
            return True
        
        return False
    
    @staticmethod
    def notify_event_interaction(
        db: Session, 
        event_id: int, 
        actor_id: int, 
        action: str, 
        link: str
    ) -> Optional[Notification]:
        """Notify event creator about an interaction with their event"""
        event = db.query(Event).filter(Event.id == event_id).first()
        
        if not event or event.created_by_user_id == actor_id:
            # Don't notify if event doesn't exist or if actor is the event creator
            return None
        
        message = f"Someone {action} on your event '{event.title}'"
        
        notification_data = NotificationCreate(
            user_id=event.created_by_user_id,
            message=message,
            link=link,
            notification_type="event_interaction",
            event_id=event_id
        )
        
        return NotificationService.create_notification(db, notification_data)
    
    @staticmethod
    def notify_comment(
        db: Session, 
        event_id: int, 
        comment_id: int, 
        commenter_id: int, 
        event_creator_id: int,
        link: str
    ) -> Optional[Notification]:
        """Notify event creator about a new comment"""
        if commenter_id == event_creator_id:
            # Don't notify if commenter is the event creator
            return None
        
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            return None
        
        message = f"New comment on your event '{event.title}'"
        
        notification_data = NotificationCreate(
            user_id=event_creator_id,
            message=message,
            link=link,
            notification_type="comment",
            event_id=event_id,
            comment_id=comment_id
        )
        
        return NotificationService.create_notification(db, notification_data)
    
    @staticmethod
    def extract_mentions(text: str) -> List[str]:
        """Extract @username mentions from text"""
        # Find all @username patterns
        # Updated regex to match a wider range of username formats
        # Supports usernames with letters, numbers, underscores, dots and dashes
        mentions = re.findall(r'@([\w\.-]+)', text)
        print(f"Extracted mentions from text: {mentions}")
        return mentions
    
    @staticmethod
    def notify_mentions(
        db: Session, 
        text: str, 
        author_id: int, 
        event_id: Optional[int] = None,
        comment_id: Optional[int] = None,
        link: str = ""
    ) -> List[Notification]:
        """Create notifications for all users mentioned in the text"""
        mentions = NotificationService.extract_mentions(text)
        notifications = []
        
        if not mentions:
            return notifications
            
        event = None
        if event_id:
            event = db.query(Event).filter(Event.id == event_id).first()
            
        # Get all mentioned users that exist in the database
        mentioned_users = db.query(User).filter(User.username.in_(mentions)).all()
        
        print(f"Found mentioned users in database: {[user.username for user in mentioned_users]}")
        
        for user in mentioned_users:
            # Allow self-mentions for testing purposes
            # if user.id == author_id:
            #     # Skip self-mentions
            #     continue
                
            context = "a comment" if comment_id else "an event"
            title_context = f" '{event.title}'" if event else ""
            
            message = f"You were mentioned in {context}{title_context}"
            
            print(f"Creating notification for user {user.username} (id: {user.id})")
            
            notification_data = NotificationCreate(
                user_id=user.id,
                message=message,
                link=link,
                notification_type="mention",
                event_id=event_id,
                comment_id=comment_id
            )
            
            notification = NotificationService.create_notification(db, notification_data)
            notifications.append(notification)
            
        return notifications
        
    @staticmethod
    def notify_admins(
        db: Session, 
        action: str, 
        actor_id: int, 
        event_id: Optional[int] = None,
        comment_id: Optional[int] = None,
        link: str = ""
    ) -> List[Notification]:
        """Notify all admin users about an action"""
        # Skip notifying the actor if they are an admin
        admins = db.query(User).filter(User.is_admin == True, User.id != actor_id).all()
        notifications = []
        
        actor = db.query(User).filter(User.id == actor_id).first()
        actor_name = actor.username if actor else "Someone"
        
        event = None
        if event_id:
            event = db.query(Event).filter(Event.id == event_id).first()
        
        message_context = ""
        if event:
            message_context = f" on event '{event.title}'"
            
        message = f"{actor_name} {action}{message_context}"
        
        for admin in admins:
            notification_data = NotificationCreate(
                user_id=admin.id,
                message=message,
                link=link,
                notification_type="admin_notification",
                event_id=event_id,
                comment_id=comment_id
            )
            
            notification = NotificationService.create_notification(db, notification_data)
            notifications.append(notification)
            
        return notifications 