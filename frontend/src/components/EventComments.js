import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Form, Button, Card, Image, Alert, Spinner, Modal } from 'react-bootstrap';
import { format } from 'date-fns';
import api from '../api';
import MentionInput from './MentionInput';
import { parseAndHighlightMentions } from '../utils/mentionUtils';
import translate from '../utils/translate';
import { FaFilePdf, FaEdit, FaTrashAlt } from 'react-icons/fa';
import { updateEventComment, deleteEventComment } from '../services/eventService';

const EventComments = ({ eventId, projectId, highlightCommentId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileType, setFileType] = useState(null); // 'image' or 'pdf'
  
  // Edit and delete state
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  
  // Reference to highlighted comment
  const highlightedCommentRef = useRef(null);

  // Load comments - memoize the fetch function to prevent recreating it on each render
  const fetchComments = useCallback(async () => {
    if (!eventId) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/events/${eventId}/comments`);
      // Check if response.data exists and is an array
      if (response.data && Array.isArray(response.data)) {
        setComments(response.data);
        setError('');
      } else {
        console.error('Invalid comments data format:', response.data);
        setComments([]);
        setError(translate('Failed to load comments - invalid data format'));
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setComments([]);
      setError(translate('Failed to load comments'));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Only fetch comments when eventId changes
  useEffect(() => {
    if (eventId) {
      fetchComments();
    }
    
    // Reset state when eventId changes
    setContent('');
    setFile(null);
    setPreviewUrl('');
    setFileType(null);
  }, [eventId, fetchComments]);

  // Handle file selection
  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) {
      setFile(null);
      setPreviewUrl('');
      setFileType(null);
      return;
    }

    // Check file type
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    
    if (!isImage && !isPdf) {
      setError(translate('Please select an image or PDF file'));
      return;
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError(translate('File size cannot exceed 10MB'));
      return;
    }

    setFile(file);
    setError('');
    
    if (isImage) {
      // Create preview for images
      setFileType('image');
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      // For PDFs, don't create a preview, just set the type
      setFileType('pdf');
      setPreviewUrl(''); // Clear any existing preview
    }
  }, []);

  // Handle comment submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!content.trim() || !eventId) {
      setError(translate('Comment cannot be empty'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Process content to properly format mentions
      // This helps avoid backend issues with notification processing
      let processedContent = content;
      
      // Check if content contains mentions (@username) and ensure they're properly formatted
      if (content.includes('@')) {
        console.log('Content may contain mentions, preprocessing:', content);
        
        // Convert rich-text mentions to plain text if needed
        // This helps prevent backend notification issues
        processedContent = processedContent
          .replace(/<span class="mention">@([^<]+)<\/span>/g, '@$1')
          .replace(/@([a-zA-Z0-9_]+)/g, (match, username) => {
            console.log('Detected mention:', username);
            return `@${username}`;
          });
        
        console.log('Processed content:', processedContent);
      }
      
      const formData = new FormData();
      formData.append('content', processedContent);
      
      // Fix for file upload: Use 'image' parameter name to match backend expectations
      if (file) {
        formData.append('image', file);
        console.log('Attaching file to comment:', file.name, file.type, file.size);
        
        // Additional debug information for file type
        if (file.type.startsWith('image/')) {
          console.log('File is an image of type:', file.type);
        } else if (file.type === 'application/pdf') {
          console.log('File is a PDF');
        } else {
          console.warn('File has unexpected MIME type:', file.type);
        }
      }

      // Debug log to verify FormData content
      for (let [key, value] of formData.entries()) {
        console.log(`FormData: ${key} = ${value instanceof File ? 'File: ' + value.name : value}`);
      }

      // Use a direct secure URL to avoid URL composition issues
      const secureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}/comments`;
      console.log('Submitting comment to:', secureUrl);
      
      try {
        const response = await api.post(secureUrl, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('Comment submission successful:', response.data);
        console.log('Response image_url:', response.data.image_url);

        // Reset form
        setContent('');
        setFile(null);
        setPreviewUrl('');
        setFileType(null);
        
        // Refresh comments
        fetchComments();
      } catch (err) {
        console.error('Error submitting comment:', err);
        console.error('Error details:', err.response?.data || err.message);
        
        // Check if this is a 500 error related to notifications (which happens with mentions)
        if (err.response?.status === 500 && 
            (err.response?.data?.detail?.includes('notifications') || 
             err.response?.data?.detail?.includes('null value in column "content"'))) {
          
          console.log('Detected notification error with mentions, trying fallback method...');
          
          // Create a new FormData with the content modified to avoid the backend notification issue
          // We'll preserve the @mention text but format it in a way that doesn't trigger the notification system
          const fallbackFormData = new FormData();
          
          // Modify the content to preserve mentions visually but avoid notification processing
          // Replace @username with "[@]username" which visually looks similar but won't trigger backend notification
          const fallbackContent = processedContent.replace(/@([a-zA-Z0-9_]+)/g, '[@]$1');
          
          fallbackFormData.append('content', fallbackContent);
          
          // Re-add the image if it exists
          if (file) {
            fallbackFormData.append('image', file);
          }
          
          console.log('Attempting fallback submission with modified content:', fallbackContent);
          
          try {
            const fallbackResponse = await api.post(secureUrl, fallbackFormData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });
            
            console.log('Fallback comment submission successful:', fallbackResponse.data);
            
            // Reset form
            setContent('');
            setFile(null);
            setPreviewUrl('');
            setFileType(null);
            
            // Refresh comments
            fetchComments();
            
            // Show a warning that mentions might not have triggered notifications
            setError(translate('Comment posted, but user mentions may not have triggered notifications.'));
            
            // Clear the error message after 5 seconds
            setTimeout(() => {
              setError('');
            }, 5000);
            
            return;
          } catch (fallbackErr) {
            console.error('Fallback comment submission also failed:', fallbackErr);
            // Continue to the standard error handling below
          }
        }
        
        console.error('Error status:', err.response?.status);
        console.error('Response headers:', err.response?.headers);
        
        let errorMessage = translate('Failed to submit comment');
        if (err.response?.data?.detail) {
          errorMessage += `: ${err.response.data.detail}`;
        }
        setError(errorMessage);
      } finally {
        setSubmitting(false);
      }
    } catch (err) {
      console.error('Error in comment submission process:', err);
      setError(translate('Error preparing comment for submission'));
      setSubmitting(false);
    }
  }, [content, eventId, file, fetchComments]);
  
  // Memoize the content update function
  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
  }, []);

  // Edit comment handlers
  const handleEditClick = useCallback((comment) => {
    setEditingComment(comment);
    setEditContent(comment.content);
    setIsEditing(true);
    setActionError('');
  }, []);
  
  const handleSaveEdit = useCallback(async () => {
    if (!editContent.trim()) {
      setActionError(translate('Comment cannot be empty'));
      return;
    }
    
    setIsEditing(true);
    setActionError('');
    
    try {
      await updateEventComment(eventId, editingComment.id, { content: editContent });
      
      // Update the comment in the local state
      setComments(prevComments => 
        prevComments.map(comment => 
          comment.id === editingComment.id 
            ? { ...comment, content: editContent, updated_at: new Date().toISOString() } 
            : comment
        )
      );
      
      // Close edit mode
      setIsEditing(false);
      setEditingComment(null);
      setEditContent('');
    } catch (err) {
      console.error('Error updating comment:', err);
      setActionError(translate('Failed to update comment'));
    }
  }, [eventId, editingComment, editContent]);
  
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingComment(null);
    setEditContent('');
    setActionError('');
  }, []);
  
  // Delete comment handlers
  const handleDeleteClick = useCallback((comment) => {
    setCommentToDelete(comment);
    setDeleteConfirmOpen(true);
    setActionError('');
  }, []);
  
  const handleConfirmDelete = useCallback(async () => {
    if (!commentToDelete) return;
    
    setIsDeleting(true);
    setActionError('');
    
    try {
      await deleteEventComment(eventId, commentToDelete.id);
      
      // Remove the comment from the local state
      setComments(prevComments => 
        prevComments.filter(comment => comment.id !== commentToDelete.id)
      );
      
      // Close modal
      setDeleteConfirmOpen(false);
      setCommentToDelete(null);
    } catch (err) {
      console.error('Error deleting comment:', err);
      setActionError(translate('Failed to delete comment'));
    } finally {
      setIsDeleting(false);
    }
  }, [eventId, commentToDelete]);
  
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmOpen(false);
    setCommentToDelete(null);
    setActionError('');
  }, []);

  // Scroll to highlighted comment when comments are loaded
  useEffect(() => {
    if (highlightCommentId && !loading && comments.length > 0) {
      setTimeout(() => {
        const highlightedElement = document.getElementById(`comment-${highlightCommentId}`);
        if (highlightedElement) {
          highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [highlightCommentId, loading, comments]);

  // Safely get comments length with null check
  const commentsLength = useMemo(() => 
    Array.isArray(comments) ? comments.length : 0
  , [comments]);

  // Handle mention click
  const handleMentionClick = useCallback((username) => {
    // This could be updated to navigate to a user profile or perform a search
    alert(`Clicked on user: ${username}`);
    // TODO: Implement proper navigation or search for user profiles
  }, []);

  // Check if a file is a PDF based on the URL or file_type
  const isPdfFile = useCallback((comment) => {
    // First, check the file_type property which is the most reliable indicator
    if (comment.file_type === 'pdf') {
      return true;
    }
    
    // If no file_type, check the URL pattern for clues
    if (comment.image_url) {
      const url = comment.image_url.toLowerCase();
      return url.startsWith('/comments/pdf_') || 
             url.includes('/pdf_') || 
             url.endsWith('.pdf');
    }
    
    return false;
  }, []);

  // Get the current user ID from local storage to check ownership
  const getCurrentUserId = useCallback(() => {
    try {
      const userString = localStorage.getItem('userData');
      if (userString) {
        const userData = JSON.parse(userString);
        return userData.id || null;
      }
      return null;
    } catch (err) {
      console.error('Error getting current user ID:', err);
      return null;
    }
  }, []);
  
  const currentUserId = getCurrentUserId();

  // Always use HTTPS for backend URL
  const baseUrl = (process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'https://construction-map-backend-ypzdt6srya-uc.a.run.app').replace('http:', 'https:');

  // Properly handle attachment URLs to ensure consistent display
  const ensureHttpsUrl = (url) => {
    if (!url) return url;
    
    // If it's already a full URL, just ensure it uses HTTPS
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url.replace(/^http:\/\//i, 'https://');
    }
    
    // If it's a relative URL starting with /uploads/
    if (url.startsWith('/uploads/')) {
      return `${baseUrl}${url}`;
    }
    
    // If it's a relative URL starting with /comments/
    if (url.startsWith('/comments/')) {
      return `${baseUrl}${url}`;
    }
    
    // If it's a relative path that includes 'comments/' (like when stored directly from API)
    if (url.includes('comments/')) {
      // Extract the filename only if it includes a path
      const filename = url.split('/').pop();
      return `${baseUrl}/uploads/comments/${filename}`;
    }
    
    // For any other relative URL, assume it's a direct filename in the comments folder
    return `${baseUrl}/uploads/comments/${url}`;
  };

  return (
    <div className="event-comments">
      <h5 className="mb-3">{translate('Comments')} {commentsLength > 0 && `(${commentsLength})`}</h5>
      
      {/* Comment Form */}
      <Card className="mb-4">
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>{translate('Add a Comment')}</Form.Label>
              <MentionInput
                value={content}
                onChange={handleContentChange}
                placeholder={translate('Write your comment here... (use @ to mention users)')}
                rows={3}
                projectId={projectId}
                id="comment-input"
              />
            </Form.Group>
            
            <div className="d-flex justify-content-between align-items-start">
              <Form.Group className="mb-3">
                <Form.Label className="text-muted small">
                  {translate('Attach File (optional)')}
                </Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
                <Form.Text className="text-muted">
                  {translate('Supports images and PDF files (max 10MB)')}
                </Form.Text>
              </Form.Group>
              
              {fileType === 'image' && previewUrl && (
                <div className="comment-image-preview">
                  <Image 
                    src={previewUrl} 
                    alt={translate('Preview')} 
                    thumbnail 
                    style={{ maxHeight: '80px' }} 
                  />
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-danger p-0 ms-2"
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl('');
                      setFileType(null);
                    }}
                  >
                    {translate('Remove')}
                  </Button>
                </div>
              )}
              
              {fileType === 'pdf' && (
                <div className="comment-pdf-preview d-flex align-items-center">
                  <FaFilePdf size={30} className="text-danger me-2" />
                  <span className="text-truncate">{file?.name}</span>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-danger p-0 ms-2"
                    onClick={() => {
                      setFile(null);
                      setFileType(null);
                    }}
                  >
                    {translate('Remove')}
                  </Button>
                </div>
              )}
            </div>
            
            <div className="d-flex justify-content-end">
              <Button 
                variant="primary" 
                type="submit" 
                disabled={submitting}
                className="d-flex align-items-center"
              >
                {submitting ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    {translate('Submitting...')}
                  </>
                ) : (
                  translate('Submit Comment')
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
      
      {/* Comments List */}
      {loading ? (
        <div className="text-center">
          <Spinner animation="border" />
          <p>{translate('Loading comments...')}</p>
        </div>
      ) : commentsLength === 0 ? (
        <p className="text-center text-muted">{translate('No comments yet. Be the first to comment!')}</p>
      ) : (
        <div className="comments-list">
          {comments.map(comment => {
            const isHighlighted = highlightCommentId && parseInt(highlightCommentId, 10) === comment.id;
            const hasPdfAttachment = comment.image_url && isPdfFile(comment);
            const hasImageAttachment = comment.image_url && !isPdfFile(comment);
            const isCommentOwner = currentUserId && currentUserId === comment.user_id;
            
            // Debug log for attachment URLs - help identify issues
            if (comment.image_url) {
              console.log(`Comment #${comment.id} has attachment:`, {
                original_url: comment.image_url,
                processed_url: ensureHttpsUrl(comment.image_url),
                isPdf: hasPdfAttachment,
                fileType: comment.file_type
              });
            }
            
            return (
              <Card 
                key={comment.id} 
                id={`comment-${comment.id}`}
                className={`mb-3 ${isHighlighted ? 'highlight-comment' : ''}`}
                ref={isHighlighted ? highlightedCommentRef : null}
              >
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>{comment.username || `User #${comment.user_id}`}</strong>
                  </div>
                  <div className="d-flex align-items-center">
                    <small className="text-muted me-3">
                      {format(new Date(comment.created_at), 'PPpp')}
                      {comment.updated_at && comment.updated_at !== comment.created_at && 
                        ` (${translate('edited')})`}
                    </small>
                    
                    {/* Edit and Delete buttons for comment owner */}
                    {isCommentOwner && (
                      <div className="comment-actions">
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 me-2 text-secondary"
                          onClick={() => handleEditClick(comment)}
                          title={translate('Edit Comment')}
                        >
                          <FaEdit />
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 text-danger"
                          onClick={() => handleDeleteClick(comment)}
                          title={translate('Delete Comment')}
                        >
                          <FaTrashAlt />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card.Header>
                <Card.Body>
                  <div className="comment-content mb-2">
                    {parseAndHighlightMentions(comment.content, handleMentionClick)}
                  </div>
                  
                  {/* Hidden debug info - only visible in dev environment */}
                  {process.env.NODE_ENV === 'development' && comment.image_url && (
                    <div className="debug-info" style={{ fontSize: '10px', color: '#999', marginBottom: '5px' }}>
                      <div>Original URL: {comment.image_url}</div>
                      <div>Processed URL: {ensureHttpsUrl(comment.image_url)}</div>
                      <div>File type: {comment.file_type || 'not specified'}</div>
                    </div>
                  )}
                  
                  {hasImageAttachment && (
                    <div className="comment-attachment mt-3">
                      <Image 
                        src={ensureHttpsUrl(comment.image_url)} 
                        alt={translate('Comment attachment')} 
                        fluid 
                        className="comment-image" 
                      />
                    </div>
                  )}
                  
                  {hasPdfAttachment && (
                    <div className="comment-attachment mt-3 border p-3">
                      <div className="d-flex align-items-center">
                        <FaFilePdf size={24} className="text-danger me-3" />
                        <div>
                          <div>{translate('PDF Attachment')}</div>
                          <Button 
                            variant="link" 
                            onClick={() => {
                              const fullUrl = ensureHttpsUrl(comment.image_url);
                              window.open(fullUrl, '_blank');
                            }}
                            className="p-0"
                          >
                            {translate('View PDF')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Edit Comment Modal */}
      <Modal show={isEditing} onHide={handleCancelEdit}>
        <Modal.Header closeButton>
          <Modal.Title>{translate('Edit Comment')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {actionError && <Alert variant="danger">{actionError}</Alert>}
          <Form>
            <Form.Group>
              <Form.Label>{translate('Comment')}</Form.Label>
              <MentionInput
                value={editContent}
                onChange={setEditContent}
                placeholder={translate('Edit your comment...')}
                rows={3}
                projectId={projectId}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancelEdit}>
            {translate('Cancel')}
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveEdit}
            disabled={!editContent.trim()}
          >
            {translate('Save Changes')}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Delete Comment Confirmation Modal */}
      <Modal show={deleteConfirmOpen} onHide={handleCancelDelete}>
        <Modal.Header closeButton>
          <Modal.Title>{translate('Delete Comment')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {actionError && <Alert variant="danger">{actionError}</Alert>}
          <p>{translate('Are you sure you want to delete this comment? This action cannot be undone.')}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancelDelete}>
            {translate('Cancel')}
          </Button>
          <Button 
            variant="danger" 
            onClick={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                {translate('Deleting...')}
              </>
            ) : (
              translate('Delete')
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EventComments;