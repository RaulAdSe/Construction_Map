import React, { useState, useEffect } from 'react';
import { Table, Button, Badge, Form, OverlayTrigger, Tooltip, Modal, Spinner, Alert, Image } from 'react-bootstrap';
import { format } from 'date-fns';
import { updateEventStatus, updateEventState } from '../services/eventService';
import api from '../api';

const EventsTable = ({ events, onViewEvent, onEditEvent, onEventUpdated }) => {
  const [updatingEvent, setUpdatingEvent] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentImage, setCommentImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  if (!events || events.length === 0) {
    return (
      <div className="p-3 bg-light rounded text-center">
        <p>No events available for this project.</p>
      </div>
    );
  }

  // Group events by map
  const eventsByMap = {};
  events.forEach(event => {
    if (!eventsByMap[event.map_id]) {
      eventsByMap[event.map_id] = [];
    }
    eventsByMap[event.map_id].push(event);
  });

  // Get type badge
  const getTypeBadge = (state) => {
    switch (state) {
      case 'incidence':
        return <Badge bg="danger">Incidence</Badge>;
      case 'periodic check':
        return <Badge bg="info">Periodic Check</Badge>;
      default:
        return <Badge bg="secondary">{state || 'Unknown'}</Badge>;
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge bg="primary">Open</Badge>;
      case 'in-progress':
        return <Badge bg="info">In Progress</Badge>;
      case 'resolved':
        return <Badge bg="success">Resolved</Badge>;
      case 'closed':
        return <Badge bg="secondary">Closed</Badge>;
      default:
        return <Badge bg="secondary">{status || 'Unknown'}</Badge>;
    }
  };
  
  const handleStatusChange = async (eventId, newStatus) => {
    setUpdatingEvent(eventId);
    try {
      await updateEventStatus(eventId, newStatus);
      if (onEventUpdated) {
        const updatedEvent = events.find(e => e.id === eventId);
        onEventUpdated({...updatedEvent, status: newStatus});
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdatingEvent(null);
    }
  };
  
  const handleTypeChange = async (eventId, newType) => {
    setUpdatingEvent(eventId);
    try {
      await updateEventState(eventId, newType);
      if (onEventUpdated) {
        const updatedEvent = events.find(e => e.id === eventId);
        onEventUpdated({...updatedEvent, state: newType});
      }
    } catch (error) {
      console.error('Failed to update type:', error);
    } finally {
      setUpdatingEvent(null);
    }
  };

  const handleOpenComments = async (eventId) => {
    setSelectedEventId(eventId);
    setNewComment('');
    setCommentImage(null);
    setImagePreview('');
    setCommentError('');
    setShowCommentModal(true);
    
    // Fetch comments for this event
    await fetchComments(eventId);
  };
  
  const fetchComments = async (eventId) => {
    setLoadingComments(true);
    try {
      const response = await api.get(`/events/${eventId}/comments`);
      setComments(response.data);
      setCommentError('');
    } catch (err) {
      console.error('Error fetching comments:', err);
      setCommentError('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };
  
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) {
      setCommentError('Comment cannot be empty');
      return;
    }

    setSubmittingComment(true);
    setCommentError('');

    try {
      const formData = new FormData();
      formData.append('content', newComment);
      if (commentImage) {
        formData.append('image', commentImage);
      }

      await api.post(`/events/${selectedEventId}/comments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Reset form
      setNewComment('');
      setCommentImage(null);
      setImagePreview('');
      
      // Refresh comments
      fetchComments(selectedEventId);
      
      // Update comment count in the event
      if (onEventUpdated) {
        const updatedEvent = events.find(e => e.id === selectedEventId);
        onEventUpdated({
          ...updatedEvent, 
          comment_count: (updatedEvent.comment_count || 0) + 1
        });
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      setCommentError('Failed to submit comment');
    } finally {
      setSubmittingComment(false);
    }
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setCommentImage(null);
      setImagePreview('');
      return;
    }

    if (!file.type.match('image.*')) {
      setCommentError('Please select an image file');
      return;
    }

    setCommentImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  return (
    <div className="events-table-container">
      {Object.keys(eventsByMap).map(mapId => (
        <div key={mapId} className="mb-4">
          <h5 className="mb-3">Map: {events.find(e => e.map_id === parseInt(mapId))?.map_name || `ID: ${mapId}`}</h5>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Description</th>
                <th>Status</th>
                <th>Type</th>
                <th>Created By</th>
                <th>Created At</th>
                <th>Comments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {eventsByMap[mapId].map(event => (
                <tr key={event.id}>
                  <td>{event.id}</td>
                  <td>{event.title}</td>
                  <td>
                    {event.description 
                      ? event.description.length > 50 
                        ? `${event.description.substring(0, 50)}...`
                        : event.description
                      : "-"}
                  </td>
                  <td>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>Click to change status</Tooltip>}
                    >
                      <div>
                        <Form.Select 
                          size="sm"
                          value={event.status || 'open'}
                          onChange={(e) => handleStatusChange(event.id, e.target.value)}
                          disabled={updatingEvent === event.id}
                          style={{ marginBottom: '4px' }}
                        >
                          <option value="open">Open</option>
                          <option value="in-progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </Form.Select>
                        {getStatusBadge(event.status)}
                      </div>
                    </OverlayTrigger>
                  </td>
                  <td>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>Click to change type</Tooltip>}
                    >
                      <div>
                        <Form.Select 
                          size="sm"
                          value={event.state || 'periodic check'}
                          onChange={(e) => handleTypeChange(event.id, e.target.value)}
                          disabled={updatingEvent === event.id}
                          style={{ marginBottom: '4px' }}
                        >
                          <option value="periodic check">Periodic Check</option>
                          <option value="incidence">Incidence</option>
                        </Form.Select>
                        {getTypeBadge(event.state)}
                      </div>
                    </OverlayTrigger>
                  </td>
                  <td>{event.created_by_user_name || `User ID: ${event.created_by_user_id}`}</td>
                  <td>{format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}</td>
                  <td>
                    <Button 
                      variant={event.comment_count > 0 ? "outline-info" : "outline-secondary"}
                      size="sm"
                      onClick={() => handleOpenComments(event.id)}
                    >
                      {event.comment_count > 0 ? (
                        <>
                          <Badge bg="info" pill className="me-1">
                            {event.comment_count}
                          </Badge>
                          View
                        </>
                      ) : (
                        'Add'
                      )}
                    </Button>
                  </td>
                  <td>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="me-1"
                      onClick={() => onViewEvent(event)}
                    >
                      View
                    </Button>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => onEditEvent(event)}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ))}
      
      {/* Comments Modal */}
      <Modal 
        show={showCommentModal} 
        onHide={() => setShowCommentModal(false)}
        size="lg"
        contentClassName="modal-content"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Event Comments
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Comment Form */}
          <Form onSubmit={handleCommentSubmit} className="mb-4">
            {commentError && <Alert variant="danger">{commentError}</Alert>}
            
            <Form.Group className="mb-3">
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={submittingComment}
              />
            </Form.Group>
            
            <div className="d-flex justify-content-between align-items-center">
              <Form.Group className="mb-3">
                <Form.Label className="text-muted small">Attach Image (optional)</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={submittingComment}
                />
              </Form.Group>
              
              {imagePreview && (
                <div className="comment-image-preview">
                  <Image 
                    src={imagePreview} 
                    alt="Preview" 
                    thumbnail 
                    style={{ maxHeight: '80px' }} 
                  />
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-danger p-0 ms-2"
                    onClick={() => {
                      setCommentImage(null);
                      setImagePreview('');
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
                disabled={submittingComment || !newComment.trim()}
              >
                {submittingComment ? (
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
          
          {/* Comments List */}
          <div className="comments-list mt-4">
            <h5>Previous Comments</h5>
            {loadingComments ? (
              <div className="text-center py-4">
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading comments...</span>
                </Spinner>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-muted">No comments yet. Be the first to comment!</p>
            ) : (
              <div className="comments-thread">
                {comments.map((comment) => (
                  <div key={comment.id} className="comment-card mb-3 border-bottom pb-3">
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
                    
                    <p className="mb-2">{comment.content}</p>
                    
                    {comment.image_url && (
                      <div className="comment-image mt-2">
                        <a 
                          href={comment.image_url.startsWith('http') ? comment.image_url : `http://localhost:8000${comment.image_url}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            // Prevent default only if URL is not valid
                            if (!comment.image_url.startsWith('http')) {
                              e.preventDefault();
                              // Fix image URL path
                              const baseUrl = 'http://localhost:8000';
                              // Check if the path starts with /api/v1
                              let imagePath = comment.image_url;
                              if (!imagePath.startsWith('/api/v1') && !imagePath.startsWith('/api/')) {
                                // Add /api/v1 prefix if missing
                                imagePath = imagePath.startsWith('/') 
                                  ? `/api/v1${imagePath}` 
                                  : `/api/v1/${imagePath}`;
                              }
                              window.open(`${baseUrl}${imagePath}`, '_blank');
                            }
                          }}
                        >
                          <Image 
                            src={comment.image_url.startsWith('http') 
                              ? comment.image_url 
                              : `http://localhost:8000${
                                  comment.image_url.startsWith('/api/v1') || comment.image_url.startsWith('/api/')
                                    ? comment.image_url
                                    : comment.image_url.startsWith('/')
                                      ? `/api/v1${comment.image_url}`
                                      : `/api/v1/${comment.image_url}`
                                }`}
                            alt="Comment attachment" 
                            thumbnail 
                            className="comment-image-thumbnail"
                            style={{ maxWidth: '100%', maxHeight: '300px' }}
                          />
                          <div className="mt-1">
                            <small className="text-muted">Click to view full size</small>
                          </div>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCommentModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EventsTable; 