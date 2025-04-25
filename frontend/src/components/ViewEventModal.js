import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Modal, Button, Row, Col, Badge, Image, Tabs, Tab, Form } from 'react-bootstrap';
import { format } from 'date-fns';
import EventComments from './EventComments';
import { updateEventStatus, updateEventState } from '../services/eventService';
import { isUserAdmin, canPerformAdminAction } from '../utils/permissions';
import { parseAndHighlightMentions } from '../utils/mentionUtils';
import translate from '../utils/translate';

const ViewEventModal = ({ 
  show, 
  onHide, 
  event, 
  allMaps = [], 
  onEventUpdated, 
  currentUser, 
  projectId, 
  effectiveIsAdmin,
  highlightCommentId,
  activeTab: initialActiveTab = 'details'
}) => {
  const [updating, setUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [currentType, setCurrentType] = useState('');
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [eventKey, setEventKey] = useState(0);
  
  // Use ref for modal element to help with force closing
  const modalRef = useRef(null);
  
  // Memoize the event ID to avoid unnecessary re-renders
  const eventId = useMemo(() => event?.id, [event?.id]);
  
  // Function to determine if a file is a PDF based on the URL
  const isPdfFile = useCallback((url) => {
    if (!url) return false;
    
    // Get the filename from the URL
    const filename = url.split('/').pop();
    
    // Check if it's a PDF based on prefix or extension
    return filename.startsWith('pdf_') || filename.toLowerCase().endsWith('.pdf');
  }, []);
  
  // Keep a memoized version of the event to avoid unintended re-renders
  // but update it when necessary status/type changes occur
  const memoizedEvent = useMemo(() => {
    return event ? {
      ...event,
      // Ensure current UI state values are reflected in the memoized event
      status: currentStatus || event.status,
      state: currentType || event.state
    } : null;
  }, [event, currentStatus, currentType]);
  
  // Use callback for the onHide function to prevent infinite loops
  const handleHide = useCallback(() => {
    if (onHide) {
      onHide();
    }
  }, [onHide]);
  
  // Handle mention click
  const handleMentionClick = useCallback((username) => {
    // This could be updated to navigate to a user profile or perform a search
    alert(`Clicked on user: ${username}`);
    // TODO: Implement proper navigation or search for user profiles
  }, []);
  
  // Initialize state values when a new event is loaded
  useEffect(() => {
    if (event) {
      setCurrentStatus(event.status);
      setCurrentType(event.state);
      setEventKey(prevKey => prevKey + 1); // Force child components to re-render
      
      // Update the active tab if initialActiveTab changed
      setActiveTab(initialActiveTab);
    }
  }, [event?.id, highlightCommentId, initialActiveTab]); // Include initialActiveTab in dependencies

  // Add an effect to handle keyboard escape
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && show) {
        handleHide();
      }
    };

    if (show) {
      document.addEventListener('keydown', handleEscapeKey);
      
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [show, handleHide]);

  if (!memoizedEvent) return null;
  
  // Parse active maps configuration from event
  let activeMapSettings = {};
  try {
    if (memoizedEvent.active_maps && typeof memoizedEvent.active_maps === 'string') {
      activeMapSettings = JSON.parse(memoizedEvent.active_maps);
    } else if (memoizedEvent.active_maps) {
      activeMapSettings = memoizedEvent.active_maps;
    }
  } catch (error) {
    console.error('Error parsing active maps settings:', error);
  }
  
  // Get map names for display
  const getMapName = (mapId) => {
    const map = allMaps.find(m => m.id === parseInt(mapId));
    return map ? map.name : `Map ID: ${mapId}`;
  };
  
  // Get type badge
  const getTypeBadge = () => {
    switch (currentType) {
      case 'incidence':
        return <Badge bg="danger">{translate('Incidence')}</Badge>;
      case 'periodic check':
        return <Badge bg="info">{translate('Periodic Check')}</Badge>;
      case 'request':
        return <Badge bg="purple" style={{ backgroundColor: '#9966CC' }}>{translate('Request')}</Badge>;
      default:
        return <Badge bg="secondary">{currentType}</Badge>;
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    switch (currentStatus) {
      case 'open':
        return <Badge bg="danger">{translate('Open')}</Badge>;
      case 'in-progress':
        return <Badge bg="warning">{translate('In Progress')}</Badge>;
      case 'resolved':
        return <Badge bg="success">{translate('Resolved')}</Badge>;
      case 'closed':
        return <Badge bg="secondary">{translate('Closed')}</Badge>;
      default:
        return <Badge bg="secondary">{currentStatus}</Badge>;
    }
  };
  
  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    
    // For incidence events, allow members to make specific transitions
    // - open → in-progress
    // - in-progress → resolved
    // - resolved → in-progress
    const isIncidence = currentType === 'incidence';
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
    
    // Update the UI immediately
    setCurrentStatus(newStatus);
    
    try {
      setUpdating(true);
      await updateEventStatus(memoizedEvent.id, newStatus);
      if (onEventUpdated) {
        // Create a new event object with the updated status to trigger proper updates
        const updatedEvent = {
          ...memoizedEvent, 
          status: newStatus
        };
        onEventUpdated(updatedEvent);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      setCurrentStatus(memoizedEvent.status); // Revert on error
      if (error.response && error.response.status === 403) {
        alert(translate('Permission denied: Only admin users can modify event status.'));
      }
    } finally {
      setUpdating(false);
    }
  };
  
  const handleTypeChange = async (e) => {
    const newType = e.target.value;
    
    // Prevent members from changing event type
    if (!canPerformAdminAction('change event type', effectiveIsAdmin)) {
      alert(translate('Only admin users can change event type.'));
      return;
    }
    
    // Update the UI immediately
    setCurrentType(newType);
    
    try {
      setUpdating(true);
      await updateEventState(memoizedEvent.id, newType);
      if (onEventUpdated) {
        // Create a new event object with the updated type to trigger proper updates
        const updatedEvent = {
          ...memoizedEvent,
          state: newType
        };
        onEventUpdated(updatedEvent);
      }
    } catch (error) {
      console.error('Failed to update type:', error);
      setCurrentType(memoizedEvent.state); // Revert on error
      if (error.response && error.response.status === 403) {
        alert(translate('Permission denied: Only admin users can modify event type.'));
      }
    } finally {
      setUpdating(false);
    }
  };
  
  const ensureHttpsUrl = (url) => {
    if (!url) return url;
    
    // If it's already a full URL, just ensure it uses HTTPS
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url.replace(/^http:\/\//i, 'https://');
    }
    
    // If it's a relative URL starting with /uploads/
    if (url.startsWith('/uploads/')) {
      return `https://construction-map-backend-ypzdt6srya-uc.a.run.app${url}`;
    }
    
    // If it's a relative path that includes 'events/' (like when stored directly from API)
    if (url.includes('events/')) {
      // Extract the filename only if it includes a path
      const filename = url.split('/').pop();
      return `https://construction-map-backend-ypzdt6srya-uc.a.run.app/uploads/events/${filename}`;
    }
    
    // For any other relative URL, assume it's a direct filename in the events folder
    return `https://construction-map-backend-ypzdt6srya-uc.a.run.app/uploads/events/${url}`;
  };
  
  const renderImage = () => {
    if (memoizedEvent && memoizedEvent.image_url) {
      // Get secure URL
      const fileUrl = ensureHttpsUrl(memoizedEvent.image_url);
      
      // Check if it's a PDF
      if (memoizedEvent.image_url.toLowerCase().endsWith('.pdf')) {
        return (
          <iframe
            src={fileUrl}
            width="100%"
            height="600px"
            title="PDF Viewer"
            style={{ border: 'none' }}
          />
        );
      }
      
      // For regular images
      return (
        <img
          src={fileUrl}
          alt={memoizedEvent.title}
          className="event-image"
          style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
        />
      );
    }
    return null;
  };
  
  return (
    <Modal
      show={show}
      onHide={handleHide}
      size="lg"
      centered
      dialogClassName="event-modal-dialog"
      backdropClassName="event-modal-backdrop"
      contentClassName="modal-content"
      ref={modalRef}
      key={`event-modal-${eventId || 'empty'}`}
      onExited={() => {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }}
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <div className="d-flex align-items-center">
            <span className="me-2">{translate('Event')}: {memoizedEvent.title}</span>
            {getTypeBadge()}
          </div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        <Tabs 
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="mb-4"
        >
          <Tab eventKey="details" title={translate('Details')}>
            <div className="event-details">
              {/* Image and Description Section */}
              <Row className="mb-4">
                <Col md={memoizedEvent.image_url ? 8 : 12}>
                  <h6 className="text-secondary mb-2">{translate('Description')}</h6>
                  <div className="mb-4 event-description">
                    {memoizedEvent.description ? parseAndHighlightMentions(memoizedEvent.description, handleMentionClick) : translate("No description provided.")}
                  </div>
                  
                  <Row className="mb-4">
                    <Col md={6}>
                      <h6 className="text-secondary mb-2">{translate('Created By')}</h6>
                      <div className="mb-3">
                        {memoizedEvent.created_by_user_name || `${translate('User ID')}: ${memoizedEvent.created_by_user_id}`}
                      </div>
                    </Col>
                    <Col md={6}>
                      <h6 className="text-secondary mb-2">{translate('Created At')}</h6>
                      <div className="mb-3">
                        {format(new Date(memoizedEvent.created_at), 'PPPp')}
                      </div>
                    </Col>
                  </Row>
                </Col>
                
                {memoizedEvent.image_url && (
                  <Col md={4}>
                    <h6 className="text-secondary mb-2">{translate('Attached File')}</h6>
                    {renderImage()}
                  </Col>
                )}
              </Row>
              
              {/* Type and Status Section */}
              <Row className="mb-4">
                <Col md={6}>
                  <h6 className="text-secondary mb-2">{translate('Type')}</h6>
                  <div className="d-flex align-items-center gap-3">
                    <div>
                      {getTypeBadge()}
                    </div>
                    {canPerformAdminAction('change event type', effectiveIsAdmin) && (
                      <div className="ms-2" style={{ maxWidth: '180px' }}>
                        <Form.Select 
                          size="sm" 
                          value={currentType}
                          onChange={handleTypeChange}
                          disabled={updating}
                        >
                          <option value="periodic check">{translate('Periodic Check')}</option>
                          <option value="incidence">{translate('Incidence')}</option>
                          <option value="request">{translate('Request')}</option>
                        </Form.Select>
                      </div>
                    )}
                  </div>
                </Col>
                <Col md={6}>
                  <h6 className="text-secondary mb-2">{translate('Status')}</h6>
                  <div className="d-flex align-items-center gap-3">
                    <div>
                      {getStatusBadge()}
                    </div>
                    {canPerformAdminAction('change event status', effectiveIsAdmin) ? (
                      <div className="ms-2" style={{ maxWidth: '180px' }}>
                        <Form.Select 
                          size="sm" 
                          value={currentStatus}
                          onChange={handleStatusChange}
                          disabled={updating}
                        >
                          <option value="open">{translate('Open')}</option>
                          {currentType !== 'periodic check' && currentType !== 'request' && (
                            <>
                              <option value="in-progress">{translate('In Progress')}</option>
                              <option value="resolved">{translate('Resolved')}</option>
                            </>
                          )}
                          <option value="closed">{translate('Closed')}</option>
                        </Form.Select>
                      </div>
                    ) : (
                      currentType === 'incidence' && (
                        <div className="ms-2" style={{ maxWidth: '180px' }}>
                          <Form.Select 
                            size="sm" 
                            value={currentStatus}
                            onChange={handleStatusChange}
                            disabled={updating}
                          >
                            {currentStatus === 'open' && (
                              <>
                                <option value="open">{translate('Open')}</option>
                                <option value="in-progress">{translate('In Progress')}</option>
                              </>
                            )}
                            {currentStatus === 'in-progress' && (
                              <>
                                <option value="in-progress">{translate('In Progress')}</option>
                                <option value="resolved">{translate('Resolved')}</option>
                              </>
                            )}
                            {currentStatus === 'resolved' && (
                              <>
                                <option value="resolved">{translate('Resolved')}</option>
                                <option value="in-progress">{translate('In Progress')}</option>
                              </>
                            )}
                            {currentStatus === 'closed' && (
                              <option value="closed">{translate('Closed')}</option>
                            )}
                          </Form.Select>
                        </div>
                      )
                    )}
                  </div>
                </Col>
              </Row>
              
              {/* Location Section */}
              <div className="mb-4">
                <h6 className="text-secondary mb-2">{translate('Location')}</h6>
                <div>
                  <p className="mb-1">
                    <strong>{translate('Map')}:</strong> {getMapName(memoizedEvent.map_id)}
                  </p>
                  <p className="mb-0">
                    <strong>{translate('Coordinates')}:</strong> {memoizedEvent.x_coordinate.toFixed(2)}%, {memoizedEvent.y_coordinate.toFixed(2)}%
                  </p>
                </div>
              </div>
              
              {/* Tags Section */}
              <div className="mb-2">
                <h6 className="text-secondary mb-2">{translate('Tags')}</h6>
                {Array.isArray(memoizedEvent.tags) && memoizedEvent.tags.length > 0 ? (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {memoizedEvent.tags.map((tag, index) => (
                      <Badge 
                        key={`${tag}-${index}`} 
                        bg="info" 
                        className="py-2 px-3"
                        style={{ 
                          fontSize: '0.9rem',
                          fontWeight: '500',
                          opacity: '0.9'
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">{translate('No tags added to this event.')}</p>
                )}
              </div>
            </div>
          </Tab>
          <Tab eventKey="comments" title={translate('Comments')}>
            <EventComments
              eventId={memoizedEvent.id}
              projectId={projectId}
              key={`comments-${eventKey}`}
              highlightCommentId={highlightCommentId}
            />
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleHide} disabled={updating}>
          {translate('Close')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default React.memo(ViewEventModal); 