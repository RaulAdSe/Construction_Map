import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Form, Button, Card, Image, Alert, Spinner } from 'react-bootstrap';
import { format } from 'date-fns';
import api from '../api';
import MentionInput from './MentionInput';
import { parseAndHighlightMentions } from '../utils/mentionUtils';
import translate from '../utils/translate';
import { FaFilePdf } from 'react-icons/fa';

const EventComments = ({ eventId, projectId, highlightCommentId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileType, setFileType] = useState(null); // 'image' or 'pdf'
  
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
      const formData = new FormData();
      formData.append('content', content);
      if (file) {
        formData.append('attachment', file);
      }

      await api.post(`/events/${eventId}/comments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Reset form
      setContent('');
      setFile(null);
      setPreviewUrl('');
      setFileType(null);
      
      // Refresh comments
      fetchComments();
    } catch (err) {
      console.error('Error submitting comment:', err);
      setError(translate('Failed to submit comment'));
    } finally {
      setSubmitting(false);
    }
  }, [content, eventId, file, fetchComments]);
  
  // Memoize the content update function
  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
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
    // Check the file_type property first (for newer comments)
    if (comment.file_type === 'pdf') {
      return true;
    }
    
    // Fall back to checking the URL pattern (for older comments before file_type was added)
    if (comment.image_url) {
      const url = comment.image_url.toLowerCase();
      return url.startsWith('/comments/pdf_') || url.endsWith('.pdf');
    }
    
    return false;
  }, []);

  // Always use HTTPS for backend URL
  const baseUrl = (process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'https://construction-map-backend-ypzdt6srya-uc.a.run.app').replace('http:', 'https:');

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
                  <small className="text-muted">
                    {format(new Date(comment.created_at), 'PPpp')}
                  </small>
                </Card.Header>
                <Card.Body>
                  <div className="comment-content mb-2">
                    {parseAndHighlightMentions(comment.content, handleMentionClick)}
                  </div>
                  
                  {hasImageAttachment && (
                    <div className="comment-attachment mt-3">
                      <Image 
                        src={`${baseUrl}${comment.image_url}`} 
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
                              const fullUrl = `${baseUrl}${comment.image_url}`;
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
    </div>
  );
};

export default EventComments;