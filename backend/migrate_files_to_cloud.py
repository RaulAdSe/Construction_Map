import os
import sys
import glob
from google.cloud import storage
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Get storage bucket from environment or use default
CLOUD_STORAGE_BUCKET = os.getenv("CLOUD_STORAGE_BUCKET", "construction-map-storage-deep-responder-444017-h2")

# Local upload directories 
UPLOAD_FOLDERS = ['events', 'comments']
BASE_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')

def init_storage_client():
    """Initialize and return Google Cloud Storage client"""
    try:
        client = storage.Client()
        logger.info(f"Initialized Google Cloud Storage client")
        return client
    except Exception as e:
        logger.error(f"Failed to initialize Cloud Storage client: {e}")
        sys.exit(1)

def migrate_files(client, folder):
    """Migrate files from local folder to Cloud Storage"""
    bucket = client.bucket(CLOUD_STORAGE_BUCKET)
    local_folder = os.path.join(BASE_UPLOAD_DIR, folder)
    
    # Check if local folder exists
    if not os.path.exists(local_folder):
        logger.warning(f"Local folder {local_folder} does not exist. Skipping.")
        return 0
    
    count = 0
    # Get all files in the folder
    file_paths = glob.glob(os.path.join(local_folder, '*'))
    
    logger.info(f"Found {len(file_paths)} files in {local_folder}")
    
    for file_path in file_paths:
        if not os.path.isfile(file_path):
            continue
            
        filename = os.path.basename(file_path)
        destination_blob_name = f"{folder}/{filename}"
        
        try:
            # Check if file already exists in Cloud Storage
            blob = bucket.blob(destination_blob_name)
            if blob.exists():
                logger.info(f"File {destination_blob_name} already exists in Cloud Storage. Skipping.")
                continue
                
            # Determine content type
            content_type = "application/octet-stream"  # Default
            if filename.lower().endswith('.pdf'):
                content_type = "application/pdf"
            elif filename.lower().endswith(('.jpg', '.jpeg')):
                content_type = "image/jpeg"
            elif filename.lower().endswith('.png'):
                content_type = "image/png"
            elif filename.lower().endswith('.gif'):
                content_type = "image/gif"
            
            # Upload file
            blob.upload_from_filename(file_path, content_type=content_type)
            logger.info(f"Migrated {file_path} to {destination_blob_name}")
            count += 1
        except Exception as e:
            logger.error(f"Error uploading {file_path}: {e}")
    
    return count

def main():
    """Main function to migrate files"""
    logger.info(f"Starting migration to bucket: {CLOUD_STORAGE_BUCKET}")
    
    # Initialize storage client
    client = init_storage_client()
    
    total_migrated = 0
    for folder in UPLOAD_FOLDERS:
        logger.info(f"Migrating files from {folder}")
        migrated = migrate_files(client, folder)
        total_migrated += migrated
        logger.info(f"Migrated {migrated} files from {folder}")
    
    logger.info(f"Migration complete. Total files migrated: {total_migrated}")

if __name__ == "__main__":
    main() 