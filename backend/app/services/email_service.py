import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from typing import List, Optional, Union
import os
import traceback

# Try to import SendGrid, but don't fail if not installed
try:
    import sendgrid
    from sendgrid.helpers.mail import (
        Mail, Email, To, Content, HtmlContent, 
        Personalization, Subject, SendGridException
    )
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False
    logging.warning("SendGrid package not installed. Email will use SMTP fallback.")

from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    @staticmethod
    def send_email(
        recipients: List[str],
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        from_email: Optional[str] = None
    ) -> bool:
        """
        Send an email to one or more recipients
        
        Parameters:
        - recipients: List of email addresses to send to
        - subject: Email subject
        - body_text: Plain text version of the email body
        - body_html: Optional HTML version of the email body
        - from_email: Optional sender email override
        
        Returns:
        - True if email was sent successfully, False otherwise
        """
        try:
            # Use SendGrid if API key is provided and library is available
            sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
            
            if sendgrid_api_key and SENDGRID_AVAILABLE:
                logger.info(f"Using SendGrid for email delivery to {len(recipients)} recipients")
                try:
                    sg = sendgrid.SendGridAPIClient(api_key=sendgrid_api_key)
                    
                    from_email_address = from_email or os.getenv("EMAIL_SENDER", settings.EMAIL_FROM)
                    from_email_obj = Email(from_email_address)
                    
                    # Create the base mail object
                    mail = Mail()
                    mail.from_email = from_email_obj
                    
                    # Add plain text content
                    mail.content = Content("text/plain", body_text)
                    
                    # Add HTML content if provided
                    if body_html:
                        mail.add_content(HtmlContent(body_html))
                    
                    # Add all recipients using personalization
                    personalization = Personalization()
                    personalization.subject = Subject(subject)
                    
                    for recipient in recipients:
                        personalization.add_to(To(recipient))
                    
                    mail.add_personalization(personalization)
                    
                    # Send the email
                    try:
                        response = sg.client.mail.send.post(request_body=mail.get())
                        logger.info(f"SendGrid response code: {response.status_code}")
                        
                        if response.status_code not in (200, 201, 202):
                            logger.error(f"SendGrid error: {response.body}")
                            # Fall back to SMTP if SendGrid fails
                            logger.info("Falling back to SMTP delivery...")
                        else:
                            logger.info(f"Successfully sent email via SendGrid to {len(recipients)} recipients")
                            return True
                    except Exception as e:
                        logger.error(f"SendGrid send error: {str(e)}")
                        logger.info("Falling back to SMTP delivery...")
                
                except Exception as sg_error:
                    logger.error(f"SendGrid setup error: {str(sg_error)}")
                    logger.error(traceback.format_exc())
                    logger.info("Falling back to SMTP delivery...")
                    
            # Fall back to SMTP if SendGrid is not configured or if preferred
            # Check if SMTP settings are configured
            if not settings.EMAIL_HOST or not settings.EMAIL_USERNAME or not settings.EMAIL_PASSWORD:
                logger.error("Email settings not properly configured")
                return False

            # Check if we have recipients
            if not recipients:
                logger.error("No recipients provided for email")
                return False
                
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = from_email or settings.EMAIL_FROM
            message["To"] = ", ".join(recipients)
            
            # Plain text version
            part1 = MIMEText(body_text, "plain")
            message.attach(part1)
            
            # HTML version (if provided)
            if body_html:
                part2 = MIMEText(body_html, "html")
                message.attach(part2)
            
            # Create a secure SSL context
            context = ssl.create_default_context()
            
            # Connect to the SMTP server
            if settings.EMAIL_SSL:
                server = smtplib.SMTP_SSL(
                    settings.EMAIL_HOST, 
                    settings.EMAIL_PORT, 
                    context=context
                )
            else:
                server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT)
                server.starttls(context=context)
            
            # Log in to the server
            server.login(settings.EMAIL_USERNAME, settings.EMAIL_PASSWORD)
            
            # Send the email
            server.sendmail(
                settings.EMAIL_FROM, 
                recipients,
                message.as_string()
            )
            
            # Close the connection
            server.quit()
            
            logger.info(f"Email sent successfully via SMTP to {', '.join(recipients)}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            logger.error(traceback.format_exc())
            return False
            
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
        
        return EmailService.send_notification_email(to_email, subject, message, body_html) 