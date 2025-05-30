import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Badge, Form, OverlayTrigger, Tooltip, Modal, Spinner, Alert, Image } from 'react-bootstrap';
import { format } from 'date-fns';
import { updateEventStatus, updateEventState } from '../services/eventService';
import api from '../api';
import { isUserAdmin, canPerformAdminAction } from '../utils/permissions';
import MentionInput from './MentionInput';
import { parseAndHighlightMentions } from '../utils/mentionUtils';
import translate from '../utils/translate';
import EventHistoryModal from './EventHistoryModal';
import EventsFilterPanel from './EventsFilterPanel';

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
  const [selectedTypes, setSelectedTypes] = useState(['incidence', 'periodic check', 'request']);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedEventTitle, setSelectedEventTitle] = useState('');
  const [allEvents, setAllEvents] = useState([]); // Store original unfiltered events

  // Handle mention click
  const handleMentionClick = useCallback((username) => {
    // This could be updated to navigate to a user profile or perform a search
    alert(`Clicked on user: ${username}`);
    // TODO: Implement proper navigation or search for user profiles
  }, []);

  // Set all events when events prop changes
  useEffect(() => {
    setAllEvents(events || []);
    setFilteredEvents(events || []);
  }, [events]);

  // Handle filter changes from the filter panel
  const handleFilterChange = (filtered) => {
    setFilteredEvents(filtered);
  };

  // Extract all unique tags from events
  const getAllTags = () => {
    const tagSet = new Set();
    events?.forEach(event => {
      if (event.tags && Array.isArray(event.tags)) {
        event.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  };

  if (!filteredEvents || filteredEvents.length === 0) {
    return (
      <div>
        <EventsFilterPanel 
          events={allEvents} 
          onFilterChange={handleFilterChange}
          availableTags={getAllTags()}
        />
        <div className="p-3 bg-light rounded text-center">
          <p>{translate('No events found')}</p>
        </div>
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
  const getTypeBadge = (type) => {
    switch (type) {
      case 'incidence':
        return <Badge bg="danger">{translate('Incidence')}</Badge>;
      case 'periodic check':
        return <Badge bg="info">{translate('Periodic Check')}</Badge>;
      case 'request':
        return <Badge bg="purple" style={{ backgroundColor: '#9966CC' }}>{translate('Request')}</Badge>;
      default:
        return <Badge bg="secondary">{type}</Badge>;
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
    const event = filteredEvents.find(e => e.id === eventId);
    const currentStatus = event.status;
    const isIncidence = event.state === 'incidence';
    const isMember = !canPerformAdminAction('change event status', effectiveIsAdmin);
    
    // Restrict members from closing any events
    if (newStatus === 'closed' && isMember) {
      alert(translate('Only admin users can close events.'));
      return;
    }
    
    // For non-incidence events, prevent members from resolving
    if (!isIncidence && newStatus === 'resolved' && isMember) {
      alert(translate('Only admin users can resolve non-incidence events.'));
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
      // Check if response.data exists and is an array
      if (response.data && Array.isArray(response.data)) {
        setComments(response.data);
        setCommentError('');
      } else {
        console.error('Invalid comments data format:', response.data);
        setComments([]);
        setCommentError(translate('Failed to load comments - invalid data format'));
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setComments([]);
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

  // Handle opening the history modal
  const handleOpenHistory = (event) => {
    setSelectedEventId(event.id);
    setSelectedEventTitle(event.title);
    setShowHistoryModal(true);
  };

  const ensureHttpsUrl = (url) => {
    if (!url) return url;
    
    // If it's already a full URL with HTTPS, return as is
    if (url.startsWith('https://')) {
      return url;
    }
    
    // If it's an HTTP URL, convert to HTTPS
    if (url.startsWith('http://')) {
      return url.replace(/^http:\/\//i, 'https://');
    }
    
    // Clean url by removing any extra spaces
    url = url.trim();
    
    // Get base URL for the backend
    const baseUrl = (process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'https://construction-map-backend-ypzdt6srya-uc.a.run.app').replace('http:', 'https:');
    
    // Handle Cloud Storage URLs directly
    if (url.includes('storage.googleapis.com')) {
      if (!url.startsWith('https://')) {
        return `https://storage.googleapis.com/${url.split('storage.googleapis.com/').pop()}`;
      }
      return url;
    }
    
    // Check if it's a Cloud Storage URL without the full prefix
    if (url.includes('construction-map-storage-deep-responder-444017-h2')) {
      return `https://storage.googleapis.com/${url}`;
    }
    
    // Migration code for existing comments/events - redirect to Cloud Storage
    // If it's a relative URL (from local backend storage), migrate it to Cloud Storage
    if (url.startsWith('/comments/')) {
      const filename = url.split('/').pop(); // Get just the filename
      return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/comments/${filename}`;
    }
    
    if (url.startsWith('/events/')) {
      const filename = url.split('/').pop(); // Get just the filename
      return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/events/${filename}`;
    }
    
    // If it's a relative URL starting with /uploads/
    if (url.startsWith('/uploads/')) {
      // Try to extract the object type and redirect to appropriate Cloud Storage path
      if (url.includes('/uploads/comments/')) {
        const filename = url.split('/').pop();
        return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/comments/${filename}`;
      } else if (url.includes('/uploads/events/')) {
        const filename = url.split('/').pop();
        return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/events/${filename}`;
      } else {
        // General /uploads/ URL, try to determine the type based on filename pattern
        const filename = url.split('/').pop();
        if (filename.startsWith('img_') || filename.startsWith('pdf_')) {
          // This looks like a comment attachment
          return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/comments/${filename}`;
        }
        // Fall back to backend URL
        return `${baseUrl}${url}`;
      }
    }
    
    // If it's a relative path that includes 'comments/' (like when stored directly from API)
    if (url.includes('comments/')) {
      // Extract the filename only if it includes a path
      const filename = url.split('/').pop();
      return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/comments/${filename}`;
    }
    
    // For any other path, assume it's in uploads/comments
    // Check for filename pattern to determine if it's a comment or event
    if (url.startsWith('img_') || url.startsWith('pdf_')) {
      const filename = url.split('/').pop();
      if (url.includes('event') || url.includes('map') || url.includes('attachment')) {
        return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/events/${filename}`;
      } else {
        return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/comments/${filename}`;
      }
    }
    
    return `${baseUrl}/uploads/comments/${url.split('/').pop()}`;
  };

  return (
    <div className="events-table-container">
      <EventsFilterPanel 
        events={allEvents} 
        onFilterChange={handleFilterChange}
        availableTags={getAllTags()}
      />
      
      {Object.keys(eventsByMap).map(mapId => (
        <div key={mapId} className="mb-4">
          <h5 className="mb-3">{translate('Map')}: {filteredEvents.find(e => e.map_id === parseInt(mapId))?.map_name || `ID: ${mapId}`}</h5>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>{translate('#')}</th>
                <th>{translate('Title')}</th>
                <th>{translate('Status')}</th>
                <th>{translate('Type')}</th>
                <th>{translate('Tags')}</th>
                <th>{translate('Created By')}</th>
                <th>{translate('Created At')}</th>
                <th>{translate('History')}</th>
                <th>{translate('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {eventsByMap[mapId].map(event => (
                <tr key={event.id}>
                  <td>{event.id}</td>
                  <td>{event.title}</td>
                  <td>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>{translate('Click to change status')}</Tooltip>}
                    >
                      <div>
                        {/* For admin users - full control */}
                        {canPerformAdminAction('change event status', effectiveIsAdmin) ? (
                          <Form.Select 
                            size="sm"
                            value={event.status || 'open'}
                            onChange={(e) => handleStatusChange(event.id, e.target.value)}
                            disabled={updatingEvent === event.id}
                            style={{ marginBottom: '4px' }}
                          >
                            <option value="open">{translate('Open')}</option>
                            {event.state !== 'periodic check' && event.state !== 'request' && (
                              <>
                                <option value="in-progress">{translate('In Progress')}</option>
                                <option value="resolved">{translate('Resolved')}</option>
                              </>
                            )}
                            <option value="closed">{translate('Closed')}</option>
                          </Form.Select>
                        ) : (
                          /* For members - simplified transitions for incidence events */
                          event.state === 'incidence' ? (
                            <Form.Select 
                              size="sm"
                              value={event.status || 'open'}
                              onChange={(e) => handleStatusChange(event.id, e.target.value)}
                              disabled={updatingEvent === event.id}
                              style={{ marginBottom: '4px' }}
                            >
                              {/* Only show relevant next status */}
                              {event.status === 'open' && (
                                <>
                                  <option value="open">{translate('Open')}</option>
                                  <option value="in-progress">{translate('In Progress')}</option>
                                </>
                              )}
                              {event.status === 'in-progress' && (
                                <>
                                  <option value="in-progress">{translate('In Progress')}</option>
                                  <option value="resolved">{translate('Resolved')}</option>
                                </>
                              )}
                              {event.status === 'resolved' && (
                                <>
                                  <option value="resolved">{translate('Resolved')}</option>
                                  <option value="in-progress">{translate('In Progress')}</option>
                                </>
                              )}
                              {event.status === 'closed' && (
                                <option value="closed">{translate('Closed')}</option>
                              )}
                            </Form.Select>
                          ) : (
                            /* For non-incidence events, just show the current status */
                            <Form.Select 
                              size="sm"
                              value={event.status || 'open'}
                              disabled={true}
                              style={{ marginBottom: '4px' }}
                            >
                              <option value={event.status}>{translate(event.status.charAt(0).toUpperCase() + event.status.slice(1))}</option>
                            </Form.Select>
                          )
                        )}
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
                          <option value="request">{translate('Request')}</option>
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
                      variant="outline-info" 
                      size="sm"
                      onClick={() => handleOpenHistory(event)}
                    >
                      {translate('View History')}
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
                            src={ensureHttpsUrl(comment.image_url)} 
                            alt="Comment attachment" 
                            fluid 
                            style={{ maxHeight: '200px' }}
                            onClick={() => window.open(ensureHttpsUrl(comment.image_url), '_blank')}
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
      
      {/* Event History Modal */}
      <EventHistoryModal
        show={showHistoryModal}
        onHide={() => setShowHistoryModal(false)}
        eventId={selectedEventId}
        eventTitle={selectedEventTitle}
      />
    </div>
  );
};

export default EventsTable;