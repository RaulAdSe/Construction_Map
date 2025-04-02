import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Badge, Form, OverlayTrigger, Tooltip, Modal, Spinner, Alert, Image } from 'react-bootstrap';
import { format } from 'date-fns';
import { updateEventStatus, updateEventState } from '../services/eventService';
import api from '../api';
import { isUserAdmin, canPerformAdminAction } from '../utils/permissions';
import MentionInput from './MentionInput';
import { parseAndHighlightMentions } from '../utils/mentionUtils';
import translate from '../utils/translate';

const EventsTable = ({ events, onViewEvent, onEditEvent, onEventUpdated, effectiveIsAdmin }) => {
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
  const [filteredEvents, setFilteredEvents] = useState([]);

  // Handle mention click
  const handleMentionClick = useCallback((username) => {
    // This could be updated to navigate to a user profile or perform a search
    alert(`Clicked on user: ${username}`);
    // TODO: Implement proper navigation or search for user profiles
  }, []);

  // Filter events and update when events prop changes
  useEffect(() => {
    setFilteredEvents(events || []);
  }, [events]);

  if (!filteredEvents || filteredEvents.length === 0) {
    return (
      <div className="p-3 bg-light rounded text-center">
        <p>{translate('No events found')}</p>
      </div>
    );
  }

  // Group events by map
  const eventsByMap = {};
  filteredEvents.forEach(event => {
    if (!eventsByMap[event.map_id]) {
      eventsByMap[event.map_id] = [];
    }
    eventsByMap[event.map_id].push(event);
  });

  // Get type badge
  const getTypeBadge = (state) => {
    switch (state) {
      case 'incidence':
        return <Badge bg="danger">{translate('Incidence')}</Badge>;
      case 'periodic check':
        return <Badge bg="info">{translate('Periodic Check')}</Badge>;
      default:
        return <Badge bg="secondary">{state ? translate(state) : translate('Unknown')}</Badge>;
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge bg="danger">{translate('Open')}</Badge>;
      case 'in-progress':
        return <Badge bg="warning">{translate('In Progress')}</Badge>;
      case 'resolved':
        return <Badge bg="success">{translate('Resolved')}</Badge>;
      case 'closed':
        return <Badge bg="secondary">{translate('Closed')}</Badge>;
      default:
        return <Badge bg="secondary">{status ? translate(status) : translate('Unknown')}</Badge>;
    }
  };
  
  const handleStatusChange = async (eventId, newStatus) => {
    // Check if user is trying to close the event but isn't an admin
    if (newStatus === 'closed' && !canPerformAdminAction('close event', effectiveIsAdmin)) {
      alert(translate('Only admin users can close events.'));
      return;
    }
    
    setUpdatingEvent(eventId);
    try {
      await updateEventStatus(eventId, newStatus);
      if (onEventUpdated) {
        const updatedEvent = filteredEvents.find(e => e.id === eventId);
        onEventUpdated({...updatedEvent, status: newStatus});
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      if (error.response && error.response.status === 403) {
        alert(translate('Permission denied: Only admin users can close events.'));
      } else if (error.message === 'Only admin users can close events') {
        alert(translate('Permission denied: Only admin users can close events.'));
      }
    } finally {
      setUpdatingEvent(null);
    }
  };
  
  const handleTypeChange = async (eventId, newType) => {
    setUpdatingEvent(eventId);
    try {
      await updateEventState(eventId, newType);
      if (onEventUpdated) {
        const updatedEvent = filteredEvents.find(e => e.id === eventId);
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
      setCommentError(translate('Failed to load comments'));
    } finally {
      setLoadingComments(false);
    }
  };
  
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) {
      setCommentError(translate('Comment cannot be empty'));
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
        const updatedEvent = filteredEvents.find(e => e.id === selectedEventId);
        onEventUpdated({
          ...updatedEvent, 
          comment_count: (updatedEvent.comment_count || 0) + 1
        });
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      setCommentError(translate('Failed to submit comment'));
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
      setCommentError(translate('Please select an image file'));
      return;
    }

    setCommentImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Helper function to determine if user can edit/close events
  const canEdit = effectiveIsAdmin === true;

  return (
    <div className="events-table-container">
      {Object.keys(eventsByMap).map(mapId => (
        <div key={mapId} className="mb-4">
          <h5 className="mb-3">{translate('Map')}: {filteredEvents.find(e => e.map_id === parseInt(mapId))?.map_name || `ID: ${mapId}`}</h5>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>{translate('#')}</th>
                <th>{translate('Title')}</th>
                <th>{translate('Description')}</th>
                <th>{translate('Status')}</th>
                <th>{translate('Type')}</th>
                <th>{translate('Tags')}</th>
                <th>{translate('Created By')}</th>
                <th>{translate('Created At')}</th>
                <th>{translate('Comments')}</th>
                <th>{translate('Actions')}</th>
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
                      overlay={<Tooltip>{translate('Click to change status')}</Tooltip>}
                    >
                      <div>
                        <Form.Select 
                          size="sm"
                          value={event.status || 'open'}
                          onChange={(e) => handleStatusChange(event.id, e.target.value)}
                          disabled={updatingEvent === event.id}
                          style={{ marginBottom: '4px' }}
                        >
                          <option value="open">{translate('Open')}</option>
                          <option value="in-progress">{translate('In Progress')}</option>
                          <option value="resolved">{translate('Resolved')}</option>
                          {canEdit && <option value="closed">{translate('Closed')}</option>}
                        </Form.Select>
                        {getStatusBadge(event.status)}
                      </div>
                    </OverlayTrigger>
                  </td>
                  <td>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>{translate('Click to change type')}</Tooltip>}
                    >
                      <div>
                        <Form.Select 
                          size="sm"
                          value={event.state || 'periodic check'}
                          onChange={(e) => handleTypeChange(event.id, e.target.value)}
                          disabled={updatingEvent === event.id}
                          style={{ marginBottom: '4px' }}
                        >
                          <option value="periodic check">{translate('Periodic Check')}</option>
                          <option value="incidence">{translate('Incidence')}</option>
                        </Form.Select>
                        {getTypeBadge(event.state)}
                      </div>
                    </OverlayTrigger>
                  </td>
                  <td>
                    {event.tags && event.tags.length > 0 ? (
                      <div className="event-tags">
                        {event.tags.map(tag => (
                          <Badge key={tag} bg="info" className="me-1 mb-1">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">{translate('No tags')}</span>
                    )}
                  </td>
                  <td>{event.created_by_user_name || `${translate('User ID')}: ${event.created_by_user_id}`}</td>
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
                          {translate('View')}
                        </>
                      ) : (
                        translate('add')
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
                      {translate('View')}
                    </Button>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => onEditEvent(event)}
                    >
                      {translate('Edit')}
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
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{translate('Event Comments')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="comments-section">
            {commentError && (
              <Alert variant="danger">{commentError}</Alert>
            )}
            
            <Form onSubmit={handleCommentSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Add a comment')}</Form.Label>
                <MentionInput
                  value={newComment}
                  onChange={setNewComment}
                  placeholder={translate('Write your comment here... (use @ to mention users)')}
                  rows={3}
                  projectId={selectedEventId ? filteredEvents.find(e => e.id === selectedEventId)?.project_id : null}
                  id="event-table-comment-input"
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>{translate('Attach image (optional)')}</Form.Label>
                <Form.Control
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*"
                />
              </Form.Group>
              
              {imagePreview && (
                <div className="mb-3">
                  <p className="mb-1">{translate('Image preview')}:</p>
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    style={{ maxWidth: '100%', maxHeight: '200px' }} 
                  />
                </div>
              )}
              
              <Button
                type="submit"
                variant="primary"
                disabled={submittingComment}
                className="mb-4"
              >
                {submittingComment ? translate('Submitting...') : translate('Submit Comment')}
              </Button>
            </Form>
            
            <hr />
            
            <h6>{translate('Comments')}</h6>
            
            {loadingComments ? (
              <div className="text-center p-3">
                <Spinner animation="border" size="sm" /> {translate('Loading comments...')}
              </div>
            ) : (
              <div className="comment-list">
                {comments.length === 0 ? (
                  <p className="text-muted">{translate('No comments yet.')}</p>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="comment-item mb-3 p-3 border rounded">
                      <div className="d-flex justify-content-between">
                        <strong>{comment.user_name || `User #${comment.user_id}`}</strong>
                        <small className="text-muted">
                          {format(new Date(comment.created_at), 'MMM d, yyyy HH:mm')}
                        </small>
                      </div>
                      <div>
                        {parseAndHighlightMentions(comment.content, handleMentionClick)}
                      </div>
                      {comment.image_url && (
                        <div className="mt-2">
                          <Image 
                            src={comment.image_url} 
                            alt="Comment attachment" 
                            fluid 
                            style={{ maxHeight: '200px' }}
                            onClick={() => window.open(comment.image_url, '_blank')}
                            className="cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCommentModal(false)}>
            {translate('Close')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EventsTable;