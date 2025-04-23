import os
import logging
import uuid
from typing import Optional, Tuple, BinaryIO
from fastapi import UploadFile, HTTPException
from google.cloud import storage
from google.cloud.exceptions import GoogleCloudError
from app.core.config import settings

# Initialize logger
logger = logging.getLogger("storage_service")

# Check if running in Cloud Run environment
in_cloud_run = os.getenv("K_SERVICE") is not None

# Force cloud storage in Cloud Run, otherwise use environment variable
USE_CLOUD_STORAGE = in_cloud_run or os.getenv("USE_CLOUD_STORAGE", "false").lower() == "true"

# Get bucket name from environment
CLOUD_STORAGE_BUCKET = os.getenv("CLOUD_STORAGE_BUCKET", "servitec-map-storage")

logger.info(f"Storage configuration: Cloud Storage {'ENABLED' if USE_CLOUD_STORAGE else 'DISABLED'}, Bucket: {CLOUD_STORAGE_BUCKET}")

# Initialize storage client (only if cloud storage is enabled)
_storage_client = None

def get_storage_client():
    """Get or initialize the storage client"""
    global _storage_client
    if USE_CLOUD_STORAGE and _storage_client is None:
        try:
            _storage_client = storage.Client()
            logger.info(f"Initialized Google Cloud Storage client")
        except Exception as e:
            logger.error(f"Failed to initialize Cloud Storage client: {e}")
            raise
    return _storage_client

async def upload_file_to_cloud_storage(
    file_content: bytes, 
    destination_blob_name: str, 
    content_type: str
) -> str:
    """
    Uploads a file to the cloud storage bucket.
    Returns the public URL of the uploaded file.
    """
    if not USE_CLOUD_STORAGE:
        raise ValueError("Cloud storage is not enabled")
    
    try:
        # Get the storage client
        client = get_storage_client()
        bucket = client.bucket(CLOUD_STORAGE_BUCKET)
        
        # Create a new blob and upload the file's content
        blob = bucket.blob(destination_blob_name)
        blob.content_type = content_type
        
        # Upload the file
        blob.upload_from_string(file_content, content_type=content_type)
        
        logger.info(f"File {destination_blob_name} uploaded to {CLOUD_STORAGE_BUCKET}")
        
        # Return the public URL
        return f"https://storage.googleapis.com/{CLOUD_STORAGE_BUCKET}/{destination_blob_name}"
    
    except GoogleCloudError as e:
        logger.error(f"Google Cloud Storage error: {e}")
        raise HTTPException(status_code=500, detail=f"Cloud storage error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error uploading to cloud storage: {e}")
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")

async def save_file(
    upload_file: UploadFile, 
    directory: str = "", 
    allowed_types: Optional[list] = None,
    max_size: int = 10 * 1024 * 1024  # 10MB default
) -> Tuple[str, str]:
    """
    Save a file to either local filesystem or cloud storage.
    
    Args:
        upload_file: The uploaded file
        directory: Subdirectory within the uploads folder or cloud storage bucket
        allowed_types: List of allowed content types (e.g., ['application/pdf', 'image/jpeg'])
        max_size: Maximum file size in bytes
    
    Returns:
        Tuple of (filename, file_url)
    """
    # Validate file type if needed
    if allowed_types and upload_file.content_type not in allowed_types:
        allowed_types_str = ", ".join(allowed_types)
        raise HTTPException(400, detail=f"Only {allowed_types_str} files are allowed")
    
    # Read file content
    content = await upload_file.read()
    
    # Check file size
    if len(content) > max_size:
        max_size_mb = max_size / (1024 * 1024)
        raise HTTPException(400, detail=f"File size exceeds the limit of {max_size_mb}MB")
    
    # Generate a unique filename with proper extension
    original_filename = upload_file.filename
    ext = os.path.splitext(original_filename)[1] if original_filename else ""
    if not ext and upload_file.content_type:
        # Try to get extension from content type
        if upload_file.content_type == "application/pdf":
            ext = ".pdf"
        elif upload_file.content_type.startswith("image/"):
            img_type = upload_file.content_type.split("/")[1]
            ext = f".{img_type}"
    
    # If we still don't have an extension, use a default
    if not ext:
        ext = ".bin"
    
    # Create unique filename
    unique_id = str(uuid.uuid4())
    filename = f"{unique_id}{ext}"
    
    # Add directory prefix if provided
    if directory:
        # Ensure directory doesn't have leading/trailing slashes for cloud storage
        directory = directory.strip("/")
        full_filename = f"{directory}/{filename}" if directory else filename
    else:
        full_filename = filename
    
    # Reset file position to start for reading again if needed
    await upload_file.seek(0)
    
    if USE_CLOUD_STORAGE:
        logger.info(f"Uploading file {filename} to cloud storage")
        try:
            # Upload to Cloud Storage
            file_url = await upload_file_to_cloud_storage(
                content,
                full_filename,
                upload_file.content_type or "application/octet-stream"
            )
            return filename, file_url
        except Exception as e:
            logger.error(f"Cloud storage upload failed, falling back to local: {e}")
            # Fall back to local storage if cloud storage fails
    
    # Local storage fallback or primary method if cloud storage is disabled
    try:
        # Ensure the upload directory exists
        upload_dir = os.path.join(settings.UPLOAD_FOLDER, directory)
        os.makedirs(upload_dir, exist_ok=True)
        
        # Local file path
        filepath = os.path.join(upload_dir, filename)
        
        # Write the file
        with open(filepath, "wb") as buffer:
            buffer.write(content)
        
        logger.info(f"File saved locally at {filepath}")
        
        # For local storage, construct a URL based on the filename
        if directory:
            # Include directory in the path
            file_url = f"/uploads/{directory}/{filename}"
        else:
            file_url = f"/uploads/{filename}"
        
        return filename, file_url
    
    except (PermissionError, OSError) as e:
        logger.error(f"Error saving file locally: {e}")
        raise HTTPException(500, detail=f"Could not save file: {str(e)}")

async def delete_file(filename: str, directory: str = ""):
    """Delete a file from storage"""
    if USE_CLOUD_STORAGE:
        try:
            # Delete from Cloud Storage
            client = get_storage_client()
            bucket = client.bucket(CLOUD_STORAGE_BUCKET)
            
            # Combine directory and filename
            full_path = f"{directory}/{filename}" if directory else filename
            blob = bucket.blob(full_path.strip("/"))
            
            # Check if the blob exists
            if blob.exists():
                blob.delete()
                logger.info(f"Deleted file {full_path} from cloud storage")
            else:
                logger.warning(f"File {full_path} not found in cloud storage")
        except Exception as e:
            logger.error(f"Error deleting file from cloud storage: {e}")
    else:
        # Delete from local filesystem
        try:
            local_path = os.path.join(settings.UPLOAD_FOLDER, directory, filename)
            if os.path.exists(local_path):
                os.remove(local_path)
                logger.info(f"Deleted local file {local_path}")
            else:
                logger.warning(f"Local file {local_path} not found")
        except Exception as e:
            logger.error(f"Error deleting local file: {e}")

def get_file_url(filename: str, directory: str = ""):
    """Get the URL for a file, either from cloud storage or local filesystem"""
    if not filename:
        return None
    
    # Cloud storage for production or if explicitly enabled
    if USE_CLOUD_STORAGE:
        # Combine directory and filename, ensuring no double slashes
        full_path = f"{directory}/{filename}" if directory else filename
        full_path = full_path.strip("/")
        # Always use HTTPS for cloud storage
        return f"https://storage.googleapis.com/{CLOUD_STORAGE_BUCKET}/{full_path}"
    else:
        # Local development environment
        # For local URLs, check if we have a full backend URL configured
        from app.core.config import settings
        
        # If we have BACKEND_URL set and it's a full URL, use it as base
        if hasattr(settings, 'BACKEND_URL') and settings.BACKEND_URL and '://' in settings.BACKEND_URL:
            base_url = settings.BACKEND_URL
            # Ensure the base URL uses HTTPS
            if base_url.startswith('http:'):
                base_url = base_url.replace('http:', 'https:')
            
            # Properly join paths
            if base_url.endswith('/'):
                base_url = base_url[:-1]  # Remove trailing slash
                
            if directory:
                return f"{base_url}/uploads/{directory}/{filename}"
            else:
                return f"{base_url}/uploads/{filename}"
        else:
            # Just return a relative URL (frontend will handle base URL)
            if directory:
                return f"/uploads/{directory}/{filename}"
            else:
                return f"/uploads/{filename}" 