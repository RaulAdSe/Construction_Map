import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Image, Alert, Spinner } from 'react-bootstrap';
import { format } from 'date-fns';
import api from '../api';
import MentionInput from './MentionInput';
import { parseAndHighlightMentions } from '../utils/mentionUtils';

const EventComments = ({ eventId, projectId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // Load comments
  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/events/${eventId}/comments`);
      setComments(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchComments();
    }
  }, [eventId]);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setImage(null);
      setPreviewUrl('');
      return;
    }

    if (!file.type.match('image.*')) {
      setError('Please select an image file');
      return;
    }

    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Handle comment submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('content', content);
      if (image) {
        formData.append('image', image);
      }

      await api.post(`/events/${eventId}/comments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Reset form
      setContent('');
      setImage(null);
      setPreviewUrl('');
      
      // Refresh comments
      fetchComments();
    } catch (err) {
      console.error('Error submitting comment:', err);
      setError('Failed to submit comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="event-comments">
      <h5 className="mb-3">Comments {comments.length > 0 && `(${comments.length})`}</h5>
      
      {/* Comment Form */}
      <Card className="mb-4">
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Add a Comment</Form.Label>
              <MentionInput
                value={content}
                onChange={setContent}
                placeholder="Write your comment here... (use @ to mention users)"
                rows={3}
                projectId={projectId}
                id="comment-input"
              />
            </Form.Group>
            
            <div className="d-flex justify-content-between align-items-start">
              <Form.Group className="mb-3">
                <Form.Label className="text-muted small">Attach Image (optional)</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </Form.Group>
              
              {previewUrl && (
                <div className="comment-image-preview">
                  <Image 
                    src={previewUrl} 
                    alt="Preview" 
                    thumbnail 
                    style={{ maxHeight: '80px' }} 
                  />
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-danger p-0 ms-2"
                    onClick={() => {
                      setImage(null);
                      setPreviewUrl('');
                    }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
            
            <div className="d-flex justify-content-end">
              <Button
                variant="primary"
                type="submit"
                disabled={submitting || !content.trim()}
              >
                {submitting ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    <span className="ms-2">Submitting...</span>
                  </>
                ) : (
                  'Post Comment'
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
      
      {/* Comments List */}
      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading comments...</span>
          </Spinner>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-muted">No comments yet. Be the first to comment!</p>
      ) : (
        <div className="comments-list">
          {comments.map((comment) => (
            <Card key={comment.id} className="mb-3">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 className="mb-0">{comment.username}</h6>
                    <small className="text-muted">
                      {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                      {comment.updated_at && comment.updated_at !== comment.created_at && (
                        <span> (edited)</span>
                      )}
                    </small>
                  </div>
                </div>
                
                <p className="mb-2">{parseAndHighlightMentions(comment.content)}</p>
                
                {comment.image_url && (
                  <div className="comment-image mt-2">
                    <a 
                      href={comment.image_url.startsWith('http') ? comment.image_url : `http://localhost:8000${comment.image_url}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (!comment.image_url.startsWith('http')) {
                          e.preventDefault();
                          
                          // Get just the filename without path
                          const imageFilename = comment.image_url.split('/').pop();
                          
                          // Use comments path for comment images
                          const imageUrl = `http://localhost:8000/comments/${imageFilename}`;
                          window.open(imageUrl, '_blank');
                        }
                      }}
                    >
                      <Image 
                        src={comment.image_url.startsWith('http') 
                          ? comment.image_url 
                          : (() => {
                              // Get just the filename without path
                              const imageFilename = comment.image_url.split('/').pop();
                              // Use comments path for comment images
                              return `http://localhost:8000/comments/${imageFilename}`;
                            })()
                        } 
                        alt="Comment attachment" 
                        thumbnail 
                        className="comment-image-thumbnail"
                        style={{ maxWidth: '100%', maxHeight: '200px' }}
                      />
                      <div className="mt-1">
                        <small className="text-muted">Click to view full size</small>
                      </div>
                    </a>
                  </div>
                )}
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventComments; 