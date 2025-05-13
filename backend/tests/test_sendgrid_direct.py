import os
from dotenv import load_dotenv
import logging
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("test_sendgrid_direct")

# Load .env file
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

# Import SendGrid's Python Library
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def test_sendgrid_direct():
    recipient = input("Enter recipient email address: ")
    
    message = Mail(
        from_email='servitec.ingenieria.rd@gmail.com',
        to_emails=recipient,
        subject='Sending with Twilio SendGrid is Fun',
        html_content='<strong>and easy to do anywhere, even with Python</strong>')
    
    try:
        print(f"Using API key: {os.environ.get('SENDGRID_API_KEY')[:10]}...")
        sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
        response = sg.send(message)
        logger.info(f"Status Code: {response.status_code}")
        logger.info(f"Body: {response.body}")
        logger.info(f"Headers: {response.headers}")
        logger.info("Email sent successfully!")
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        logger.error(traceback.format_exc())
        try:
            # Try to get the response detail
            if hasattr(e, 'body'):
                logger.error(f"Error response body: {e.body}")
        except:
            pass

if __name__ == "__main__":
    test_sendgrid_direct() 