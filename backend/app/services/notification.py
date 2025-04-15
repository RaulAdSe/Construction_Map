from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import re

from app.models.notification import Notification
from app.models.user import User
from app.models.event import Event
from app.models.user_preference import UserPreference
from app.schemas.notification import NotificationCreate, NotificationUpdate
from app.services.email_service import EmailService


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
        
        # Send email notification if enabled for user
        NotificationService.send_email_if_enabled(
            db, 
            notification.user_id, 
            notification.message, 
            notification.link
        )
        
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
    def send_email_if_enabled(db: Session, user_id: int, message: str, link: str) -> bool:
        """
        Send an email notification if the user has email notifications enabled
        
        Parameters:
        - db: Database session
        - user_id: User ID to send notification to
        - message: The notification message
        - link: Link to the notification
        
        Returns:
        - True if email was sent, False otherwise
        """
        try:
            print(f"[DEBUG] Attempting to send email notification to user {user_id}")
            
            # Get user
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not user.email:
                print(f"[DEBUG] User {user_id} not found or has no email address")
                return False
            
            print(f"[DEBUG] User found: {user.username}, email: {user.email}")
            
            # Check if user has preferences set
            preferences = db.query(UserPreference).filter(
                UserPreference.user_id == user_id
            ).first()
            
            # Create preferences if they don't exist
            if not preferences:
                print(f"[DEBUG] No preferences found for user {user_id}, creating default with email_notifications=True")
                preferences = UserPreference(user_id=user_id, email_notifications=True)
                db.add(preferences)
                db.commit()
                db.refresh(preferences)
            
            # Check if email notifications are enabled
            if not preferences.email_notifications:
                print(f"[DEBUG] Email notifications are disabled for user {user_id}")
                return False
            
            print(f"[DEBUG] Email notifications are enabled for user {user_id}")
            
            # Construct full link URL
            base_url = "http://localhost:3000"  # This should come from config
            full_link = f"{base_url}{link}" if not link.startswith("http") else link
            
            # Get project name if event_id is available
            project_name = "Servitec Planos"
            
            # Initialize event variable to None before using it
            event = None
            
            # Extract event_id from link if available (e.g., /events/123)
            event_id = None
            event_match = re.search(r'/events/(\d+)', link)
            if event_match:
                event_id = int(event_match.group(1))
                
                # Query the event to get the project name
                event = db.query(Event).filter(Event.id == event_id).first()
                if event and event.title:
                    project_name = event.title
            
            # Define notification types in Spanish with more descriptive titles
            notification_type_map = {
                "event_interaction": "Actividad en tu evento",
                "comment": "Nuevo comentario en tu evento",
                "mention": "Te han mencionado en una conversación",
                "admin_notification": "Notificación administrativa",
                "test": "Prueba de notificación del sistema"
            }
            
            # Determine notification type based on message content
            notification_type = "Nueva notificación"
            
            if "mentioned" in message:
                notification_type = notification_type_map.get("mention", "Te han mencionado")
            elif "comment" in message:
                notification_type = notification_type_map.get("comment", "Nuevo comentario")
            elif "interaction" in message or "on your event" in message:
                notification_type = notification_type_map.get("event_interaction", "Actividad en tu evento")
            elif "test notification" in message.lower() or "prueba de notificación" in message.lower():
                notification_type = notification_type_map.get("test", "Prueba de notificación")
            
            # More detailed subject with app name and notification type
            subject = f"Servitec Planos: {notification_type}"
            if event and event.title:
                # Add event title to subject if available
                subject = f"Servitec Planos: {notification_type} - {event.title}"
            
            # Translate the message to Spanish with more context
            spanish_message = message
            
            # More detailed translations based on message content
            if "You were mentioned in a comment" in message:
                spanish_message = "Has sido mencionado en un comentario"
                if event and event.title:
                    spanish_message += f" del evento '{event.title}'"
                spanish_message += ". Alguien ha incluido tu nombre en una conversación y podría estar esperando tu respuesta."
            elif "New comment on your event" in message:
                spanish_message = "Se ha añadido un nuevo comentario en tu evento"
                if event and event.title:
                    spanish_message += f" '{event.title}'"
                spanish_message += ". Revisa este comentario para mantenerte al día con la conversación."
            elif "Someone" in message and "on your event" in message:
                # For event interactions
                action = "ha interactuado con"
                if "viewed" in message:
                    action = "ha visto"
                elif "updated" in message:
                    action = "ha actualizado"
                elif "uploaded" in message:
                    action = "ha subido un archivo a"
                elif "downloaded" in message:
                    action = "ha descargado un archivo de"
                elif "liked" in message:
                    action = "le ha gustado"
                
                spanish_message = f"Un usuario {action} tu evento"
                if event and event.title:
                    spanish_message += f" '{event.title}'"
                spanish_message += ". Mantente informado de la actividad en tus eventos."
            elif "test notification" in message.lower() or "prueba de notificación" in message.lower():
                spanish_message = "Esta es una notificación de prueba para verificar que el sistema de emails de Servitec Planos está funcionando correctamente. No se requiere ninguna acción."
            
            # Add a greeting with username
            greeting = f"Hola {user.username},"
            
            # Add a call to action
            call_to_action = "Haz clic en el botón de abajo para ver más detalles:"
            
            # Add current date in Spanish
            import datetime
            today = datetime.datetime.now()
            date_str = today.strftime("%d de %B de %Y").replace('January', 'enero').replace('February', 'febrero').replace('March', 'marzo').replace('April', 'abril').replace('May', 'mayo').replace('June', 'junio').replace('July', 'julio').replace('August', 'agosto').replace('September', 'septiembre').replace('October', 'octubre').replace('November', 'noviembre').replace('December', 'diciembre')
            
            # Construct HTML message with improved styling - in Spanish
            html_message = f"""
            <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <div style="background-color: #3a51cc; padding: 20px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Servitec Planos</h1>
                            <p style="color: #ffffff; opacity: 0.9; margin: 5px 0 0 0; font-size: 16px;">{date_str}</p>
                        </div>
                        
                        <!-- Notification Content -->
                        <div style="padding: 30px 20px;">
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #3a51cc; margin-bottom: 20px;">
                                <h2 style="margin-top: 0; color: #3a51cc; font-size: 20px;">{notification_type}</h2>
                                <p style="font-size: 16px; margin-top: 0;">{greeting}</p>
                                <p style="font-size: 16px;">{spanish_message}</p>
                                <p style="font-size: 16px; margin-bottom: 0;">{call_to_action}</p>
                            </div>
                            
                            <!-- Event details if available -->
                            {f'''
                            <div style="padding: 15px; background-color: #f0f4ff; border-radius: 6px; margin-bottom: 20px;">
                                <h3 style="margin-top: 0; color: #3a51cc;">Detalles del evento:</h3>
                                <p style="margin: 0;"><strong>Título:</strong> {event.title}</p>
                                {f'<p><strong>Fecha:</strong> {event.start_date.strftime("%d/%m/%Y") if hasattr(event, "start_date") and event.start_date else "No especificada"}</p>' if event else ''}
                            </div>
                            ''' if event else ''}
                            
                            <!-- Call to Action Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{full_link}" style="display: inline-block; background-color: #3a51cc; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px; transition: background-color 0.3s;">Ver en Servitec Planos</a>
                            </div>
                        </div>
                        
                        <!-- Footer -->
                        <div style="background-color: #f0f4ff; padding: 20px; text-align: center; font-size: 14px; color: #666;">
                            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
                            <p>Para dejar de recibir estas notificaciones, ajuste sus <a href="{base_url}/settings" style="color: #3a51cc; text-decoration: none;">preferencias de notificación</a> en la aplicación.</p>
                            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                                <p style="margin: 0;">&copy; {today.year} Servitec Planos. Todos los derechos reservados.</p>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
            """
            
            # Prepare plain text version (fallback for email clients that don't support HTML)
            plain_text = f"""
            Servitec Planos - {notification_type}
            
            {greeting}
            
            {spanish_message}
            
            Para ver más detalles, visite: {full_link}
            
            ---
            Este es un mensaje automático, por favor no responda a este correo.
            Para dejar de recibir estas notificaciones, ajuste sus preferencias de notificación en la aplicación.
            """
            
            print(f"[DEBUG] Sending email notification to {user.email} with subject: {subject}")
            
            # Send email notification with Spanish text and improved HTML
            result = EmailService.send_notification_email(
                user.email,
                subject,
                plain_text,
                html_message
            )
            
            if result:
                print(f"[DEBUG] Email sent successfully to {user.email}")
            else:
                print(f"[DEBUG] Failed to send email to {user.email}")
                
            return result
        except Exception as e:
            print(f"Error sending email notification: {str(e)}")
            import traceback
            print(f"[DEBUG] Traceback: {traceback.format_exc()}")
            return False
    
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
        print(f"[DEBUG] Checking for mentions in text: '{text}'")
        mentions = NotificationService.extract_mentions(text)
        notifications = []
        
        if not mentions:
            print(f"[DEBUG] No mentions found in text")
            return notifications
            
        print(f"[DEBUG] Found mentions: {mentions}")
            
        event = None
        if event_id:
            event = db.query(Event).filter(Event.id == event_id).first()
            print(f"[DEBUG] Found event: {event.id if event else None}")
            
        # Get all mentioned users that exist in the database
        mentioned_users = db.query(User).filter(User.username.in_(mentions)).all()
        
        print(f"[DEBUG] Found mentioned users in database: {[user.username for user in mentioned_users]}")
        
        for user in mentioned_users:
            print(f"[DEBUG] Processing notification for user: {user.username} (ID: {user.id})")
            # Allow self-mentions for testing purposes
            # if user.id == author_id:
            #     # Skip self-mentions
            #     continue
                
            context = "a comment" if comment_id else "an event"
            title_context = f" '{event.title}'" if event else ""
            
            message = f"You were mentioned in {context}{title_context}"
            
            print(f"[DEBUG] Creating notification for user {user.username} (id: {user.id})")
            
            notification_data = NotificationCreate(
                user_id=user.id,
                message=message,
                link=link,
                notification_type="mention",
                event_id=event_id,
                comment_id=comment_id
            )
            
            print(f"[DEBUG] Calling create_notification with message: {message}")
            
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