import os
import io
import uuid
from fastapi import UploadFile
from typing import Optional, Union, BinaryIO
import logging
from datetime import datetime
from .config import settings
import mimetypes

# Set up logging
logger = logging.getLogger(__name__)

try:
    from google.cloud import storage
    GOOGLE_CLOUD_AVAILABLE = True
except ImportError:
    GOOGLE_CLOUD_AVAILABLE = False
    logger.warning("Google Cloud Storage library not installed. Using local storage only.")

class StorageService:
    """
    Storage service that handles file operations with support for both local storage
    and Google Cloud Storage.
    """
    
    def __init__(self):
        """Initialize the storage service based on environment configuration."""
        self.cloud_storage_enabled = False
        self.bucket_name = os.getenv("GOOGLE_CLOUD_STORAGE_BUCKET", "")
        self.client = None
        self.bucket = None
        
        # Check if we're running in Google Cloud and storage is configured
        if (os.getenv("GOOGLE_CLOUD_PROJECT") and 
            self.bucket_name and 
            GOOGLE_CLOUD_AVAILABLE):
            try:
                self.client = storage.Client()
                self.bucket = self.client.bucket(self.bucket_name)
                self.cloud_storage_enabled = True
                logger.info(f"Using Google Cloud Storage with bucket: {self.bucket_name}")
            except Exception as e:
                logger.error(f"Failed to initialize Google Cloud Storage: {str(e)}")
                self.cloud_storage_enabled = False
        
        # Always ensure local uploads directory exists as fallback
        os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
        if not self.cloud_storage_enabled:
            logger.info(f"Using local storage with directory: {settings.UPLOAD_FOLDER}")
    
    async def save_file(self, file: UploadFile, folder: str = "") -> str:
        """
        Save a file to storage and return its path.
        
        Args:
            file: The UploadFile to save
            folder: Optional subfolder within the storage (e.g., "events", "comments")
            
        Returns:
            The path where the file is stored, relative to the storage root
        """
        if not file:
            raise ValueError("No file provided")
        
        # Generate a unique filename
        _, ext = os.path.splitext(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        unique_filename = f"{uuid.uuid4().hex}-{timestamp}{ext}"
        
        # Add folder prefix if provided
        rel_path = os.path.join(folder, unique_filename) if folder else unique_filename
        
        # Get file content
        content = await file.read()
        
        try:
            if self.cloud_storage_enabled:
                # Upload to Google Cloud Storage
                return self._save_to_cloud(content, rel_path, file.content_type)
            else:
                # Save to local filesystem
                return self._save_to_local(content, rel_path)
        finally:
            # Reset file cursor for potential future reads
            await file.seek(0)
    
    def _save_to_cloud(self, content: bytes, rel_path: str, content_type: Optional[str] = None) -> str:
        """Save file to Google Cloud Storage."""
        try:
            # Ensure content type is set
            if not content_type:
                content_type, _ = mimetypes.guess_type(rel_path)
                content_type = content_type or "application/octet-stream"
            
            # Create a blob and upload the file
            blob = self.bucket.blob(rel_path)
            blob.upload_from_string(
                content,
                content_type=content_type
            )
            
            # Make the blob publicly accessible
            blob.make_public()
            
            logger.info(f"File uploaded to GCS: {rel_path}")
            return rel_path
        except Exception as e:
            logger.error(f"Failed to upload to Google Cloud Storage: {str(e)}")
            # Fall back to local storage
            return self._save_to_local(content, rel_path)
    
    def _save_to_local(self, content: bytes, rel_path: str) -> str:
        """Save file to local filesystem."""
        try:
            # Create directory if it doesn't exist
            full_path = os.path.join(settings.UPLOAD_FOLDER, rel_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # Write file
            with open(full_path, "wb") as f:
                f.write(content)
            
            logger.info(f"File saved locally: {rel_path}")
            return rel_path
        except Exception as e:
            logger.error(f"Failed to save file locally: {str(e)}")
            raise
    
    async def delete_file(self, file_path: str) -> bool:
        """
        Delete a file from storage.
        
        Args:
            file_path: The path to the file, relative to the storage root
            
        Returns:
            True if deletion was successful, False otherwise
        """
        if not file_path:
            return False
        
        try:
            if self.cloud_storage_enabled:
                blob = self.bucket.blob(file_path)
                if blob.exists():
                    blob.delete()
                    logger.info(f"Deleted file from GCS: {file_path}")
                    return True
                
                # If file doesn't exist in cloud, try local
                return self._delete_local(file_path)
            else:
                return self._delete_local(file_path)
        except Exception as e:
            logger.error(f"Failed to delete file: {str(e)}")
            return False
    
    def _delete_local(self, file_path: str) -> bool:
        """Delete file from local filesystem."""
        try:
            full_path = os.path.join(settings.UPLOAD_FOLDER, file_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                logger.info(f"Deleted local file: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete local file: {str(e)}")
            return False
    
    def get_file_url(self, file_path: str) -> str:
        """
        Get the URL for a file.
        
        Args:
            file_path: The path to the file, relative to the storage root
            
        Returns:
            The URL where the file can be accessed
        """
        if not file_path:
            return ""
        
        if self.cloud_storage_enabled:
            blob = self.bucket.blob(file_path)
            return blob.public_url
        
        # For local files, return the relative path that will be served by the API
        return f"/uploads/{file_path}"

# Initialize the global storage service
storage_service = StorageService() 