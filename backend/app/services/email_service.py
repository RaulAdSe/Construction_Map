import logging
from typing import List, Optional, Union
import os
import traceback

try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Content, HtmlContent
    SENDGRID_AVAILABLE = True
except ImportError as e:
    SENDGRID_AVAILABLE = False
    logging.warning(f"SendGrid package not installed. Error: {str(e)}")
    logging.warning(f"Import error traceback: {traceback.format_exc()}")
    logging.warning("Email functionality will be limited.")

logger = logging.getLogger(__name__)

class EmailService:
    @staticmethod
    def send_email(
        recipients: Union[str, List[str]],
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        from_email: Optional[str] = None
    ) -> bool:
        """
        Send an email using SendGrid
        
        Parameters:
        - recipients: Email address or list of email addresses
        - subject: Email subject
        - body_text: Plain text version of the email body
        - body_html: HTML version of the email body (optional)
        - from_email: Sender email address (optional)
        
        Returns:
        - True if email was sent successfully, False otherwise
        """
        try:
            if not SENDGRID_AVAILABLE:
                logger.error("SendGrid package is not installed. Cannot send email.")
                return False
                
            sendgrid_api_key = os.environ.get("SENDGRID_API_KEY")
            if not sendgrid_api_key:
                logger.error("SENDGRID_API_KEY not found in environment variables")
                return False
                
            # Normalize recipients to list
            recipient_list = [recipients] if isinstance(recipients, str) else recipients
            
            # Get default sender from environment or use provided one
            sender = from_email or os.environ.get("EMAIL_SENDER", "servitec.ingenieria.rd@gmail.com")
            
            # Create mail content
            message = Mail(
                from_email=sender,
                to_emails=recipient_list,
                subject=subject,
                plain_text_content=body_text,
                html_content=body_html or f"<p>{body_text}</p>"
            )
            
            # Send the email
            sg = SendGridAPIClient(sendgrid_api_key)
            response = sg.send(message)
            
            # Log response
            logger.info(f"SendGrid response code: {response.status_code}")
            if response.status_code not in (200, 201, 202):
                logger.error(f"SendGrid error: {response.body}")
                return False
                
            logger.info(f"Successfully sent email to {', '.join(recipient_list)}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            logger.error(traceback.format_exc())
            return False
            
    @staticmethod
    def send_welcome_email(
        to_email: str,
        username: str
    ) -> bool:
        """
        Send a welcome email to a new user
        
        Parameters:
        - to_email: Email address of the new user
        - username: Username of the new user
        
        Returns:
        - True if email was sent successfully, False otherwise
        """
        subject = "Bienvenido a Servitec Planos"
        message = f"Hola {username},\n\nBienvenido a Servitec Planos. Su cuenta ha sido creada exitosamente."
        
        body_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #3a51cc; margin: 0;">Servitec Planos</h1>
                        <p style="font-size: 18px; color: #666;">Gestión de proyectos</p>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                        <h2 style="margin-top: 0; color: #3a51cc;">¡Bienvenido!</h2>
                        <p style="font-size: 16px;">Hola {username},</p>
                        <p style="font-size: 16px;">Bienvenido a Servitec Planos. Su cuenta ha sido creada exitosamente.</p>
                        <p style="font-size: 16px;">Ya puede acceder a la plataforma y comenzar a utilizar todas sus funcionalidades.</p>
                    </div>
                    <div style="text-align: center;">
                        <a href="http://localhost:3000/dashboard" style="display: inline-block; background-color: #3a51cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Ir al panel de control</a>
                    </div>
                    <div style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                        <p>Este es un mensaje automático, por favor no responda a este correo.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        return EmailService.send_email(to_email, subject, message, body_html)

    @staticmethod
    def send_notification_email(
        to_email: Union[str, List[str]],
        subject: str,
        message: str,
        html_message: Optional[str] = None
    ) -> bool:
        """
        Send a notification email to one or more recipients
        
        Parameters:
        - to_email: Email address or list of email addresses to send to
        - subject: Email subject
        - message: Plain text message
        - html_message: Optional HTML message
        
        Returns:
        - True if email was sent successfully, False otherwise
        """
        print(f"[EMAIL_SERVICE] Attempting to send notification email to: {to_email}")
        print(f"[EMAIL_SERVICE] Subject: {subject}")
        print(f"[EMAIL_SERVICE] Message: {message[:100]}...")  # First 100 chars
        
        recipients = [to_email] if isinstance(to_email, str) else to_email
        
        result = EmailService.send_email(
            recipients=recipients,
            subject=subject,
            body_text=message,
            body_html=html_message
        )
        
        if result:
            print(f"[EMAIL_SERVICE] Successfully sent notification email to: {to_email}")
        else:
            print(f"[EMAIL_SERVICE] Failed to send notification email to: {to_email}")
            
        return result
    
    @staticmethod
    def send_event_notification(
        recipients: Union[str, List[str]],
        event_title: str,
        event_description: str,
        event_link: str
    ) -> bool:
        """
        Send an event notification email
        
        Parameters:
        - recipients: Email address or list of email addresses to send to
        - event_title: Title of the event
        - event_description: Description of the event
        - event_link: Link to the event details
        
        Returns:
        - True if email was sent successfully, False otherwise
        """
        subject = f"Servitec Planos - Nuevo Evento: {event_title}"
        message = f"Se ha creado un nuevo evento: {event_title}\n\n{event_description}"
        
        body_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #3a51cc; margin: 0;">Servitec Planos</h1>
                        <p style="font-size: 18px; color: #666;">Gestión de proyectos</p>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                        <h2 style="margin-top: 0; color: #3a51cc;">Nuevo Evento: {event_title}</h2>
                        <p style="font-size: 16px;">{event_description}</p>
                    </div>
                    <div style="text-align: center;">
                        <a href="{event_link}" style="display: inline-block; background-color: #3a51cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Ver detalles del evento</a>
                    </div>
                    <div style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                        <p>Este es un mensaje automático, por favor no responda a este correo.</p>
                        <p>Para dejar de recibir estas notificaciones, ajuste sus preferencias de notificación en la aplicación.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        
        recipient_list = [recipients] if isinstance(recipients, str) else recipients
        return EmailService.send_email(recipient_list, subject, message, body_html) 