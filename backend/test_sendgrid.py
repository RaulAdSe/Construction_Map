import os
import sys
import logging
import traceback
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("test_sendgrid")

# Add app directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import EmailService
from app.services.email_service import EmailService

def test_sendgrid():
    recipient = input("Enter recipient email address: ")
    
    logger.info(f"Sending test email to {recipient}")
    logger.info(f"Using from email: {os.environ.get('EMAIL_SENDER')}")
    
    result = EmailService.send_email(
        recipients=recipient,
        subject="Test Email from Servitec Map",
        body_text="This is a test email from the Servitec Map application.",
        body_html="<h1>Test Email</h1><p>This is a test email from the <strong>Servitec Map</strong> application.</p>"
    )
    
    if result:
        logger.info("Email sent successfully!")
    else:
        logger.error("Failed to send email.")

if __name__ == "__main__":
    test_sendgrid() 