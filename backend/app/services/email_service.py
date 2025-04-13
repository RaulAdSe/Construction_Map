import logging
from typing import List, Optional, Union
import os
import traceback

try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Content, HtmlContent
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False
    logging.warning("SendGrid package not installed. Email functionality will be limited.")

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
            sender = from_email or os.environ.get("EMAIL_SENDER", "noreply@servitec.com")
            
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
        subject = "Welcome to Construction Map!"
        message = f"Hello {username},\n\nWelcome to Construction Map! We're glad to have you on board.\n\nYour account has been created successfully."
        
        body_html = f"""
        <html>
            <body>
                <h2>Welcome to Construction Map!</h2>
                <p>Hello {username},</p>
                <p>Welcome to Construction Map! We're glad to have you on board.</p>
                <p>Your account has been created successfully.</p>
                <p><a href="http://localhost:3000/dashboard">Visit your dashboard</a></p>
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
        recipients = [to_email] if isinstance(to_email, str) else to_email
        
        return EmailService.send_email(
            recipients=recipients,
            subject=subject,
            body_text=message,
            body_html=html_message
        )
    
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
        subject = f"New Event: {event_title}"
        message = f"A new event has been created: {event_title}\n\n{event_description}"
        
        body_html = f"""
        <html>
            <body>
                <h2>New Event: {event_title}</h2>
                <p>{event_description}</p>
                <p><a href="{event_link}">View event details</a></p>
            </body>
        </html>
        """
        
        recipient_list = [recipients] if isinstance(recipients, str) else recipients
        return EmailService.send_email(recipient_list, subject, message, body_html) 