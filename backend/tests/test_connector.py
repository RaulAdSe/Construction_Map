#!/usr/bin/env python3
import os
import sys
import logging
from google.cloud.sql.connector import Connector
import pg8000

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Connection details 
INSTANCE_CONNECTION_NAME = "deep-responder-444017-h2:us-central1:construction-map-db"
DB_USER = "postgres"
DB_NAME = "construction_map"
DB_IAM_USER = "servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com"

print(f"Testing connection to Cloud SQL instance: {INSTANCE_CONNECTION_NAME}")
print(f"Database: {DB_NAME}")
print(f"User: {DB_USER}")
print(f"IAM User: {DB_IAM_USER}")

# initialize Cloud SQL Python Connector
connector = Connector()

def getconn():
    try:
        print("Attempting to connect using Cloud SQL Python Connector...")
        conn = connector.connect(
            instance_connection_name=INSTANCE_CONNECTION_NAME,
            driver="pg8000",
            user=DB_USER,
            db=DB_NAME,
            enable_iam_auth=True
        )
        print("Connection successful!")
        return conn
    except Exception as e:
        print(f"Error connecting: {e}")
        import traceback
        traceback.print_exc()
        return None

try:
    # Get connection
    conn = getconn()
    if conn:
        # Test a simple query
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        print(f"Query result: {result}")
        
        conn.close()
        print("Connection closed.")
    
    # Close the connector
    connector.close()
except Exception as e:
    print(f"Error during execution: {e}")
    import traceback
    traceback.print_exc()

print("\nThis script needs to be run in the Cloud Run environment with proper IAM permissions.")
print("It is meant to be a diagnostic tool that you can deploy and test separately.") 