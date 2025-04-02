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
  highlightCommentId
}) => {
  const [updating, setUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [currentType, setCurrentType] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [eventKey, setEventKey] = useState(0);
  
  // Use ref for modal element to help with force closing
  const modalRef = useRef(null);
  
  // Memoize the event ID to avoid unnecessary re-renders
  const eventId = useMemo(() => event?.id, [event?.id]);
  
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
    }
  }, [event?.id, highlightCommentId]); // Only reset when event ID changes or when highlighting a comment

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
    
    // Prevent members from closing or resolving events
    if ((newStatus === 'closed' || newStatus === 'resolved') && !canPerformAdminAction('change event status', effectiveIsAdmin)) {
      alert(translate('Only admin users can close or resolve events.'));
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
      <Modal.Body>
        <Tabs 
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="mb-3"
        >
          <Tab eventKey="details" title={translate('Details')}>
            <Row>
              <Col md={memoizedEvent.image_url ? 8 : 12}>
                <div className="mb-3">
                  <h6>{translate('Description')}</h6>
                  <p>{memoizedEvent.description ? parseAndHighlightMentions(memoizedEvent.description, handleMentionClick) : translate("No description provided.")}</p>
                </div>
                
                <Row>
                  <Col md={6}>
                    <div className="mb-3">
                      <h6>{translate('Created By')}</h6>
                      <p>{memoizedEvent.created_by_user_name || `${translate('User ID')}: ${memoizedEvent.created_by_user_id}`}</p>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-3">
                      <h6>{translate('Created At')}</h6>
                      <p>{format(new Date(memoizedEvent.created_at), 'PPPp')}</p>
                    </div>
                  </Col>
                </Row>
                
                <Row className="mb-3">
                  <Col md={6}>
                    <h6>{translate('Type')}</h6>
                    <div className="d-flex align-items-center">
                      {getTypeBadge()}
                      {canPerformAdminAction('change event type', effectiveIsAdmin) && (
                        <Form.Select 
                          size="sm" 
                          value={currentType}
                          onChange={handleTypeChange}
                          disabled={updating}
                          className="ms-2 type-select"
                          style={{ width: 'auto' }}
                        >
                          <option value="periodic check">{translate('Periodic Check')}</option>
                          <option value="incidence">{translate('Incidence')}</option>
                        </Form.Select>
                      )}
                    </div>
                  </Col>
                  <Col md={6}>
                    <h6>{translate('Status')}</h6>
                    <div className="d-flex align-items-center">
                      {getStatusBadge()}
                      {canPerformAdminAction('change event status', effectiveIsAdmin) && (
                        <Form.Select 
                          size="sm" 
                          value={currentStatus}
                          onChange={handleStatusChange}
                          disabled={updating}
                          className="ms-2 status-select"
                          style={{ width: 'auto' }}
                        >
                          <option value="open">{translate('Open')}</option>
                          {currentType !== 'periodic check' && (
                            <>
                              <option value="in-progress">{translate('In Progress')}</option>
                              <option value="resolved">{translate('Resolved')}</option>
                            </>
                          )}
                          <option value="closed">{translate('Closed')}</option>
                        </Form.Select>
                      )}
                    </div>
                  </Col>
                </Row>
                
                <div className="mb-3">
                  <h6>{translate('Location')}</h6>
                  <p>
                    {translate('Map')}: {getMapName(memoizedEvent.map_id)}
                  </p>
                  <p>
                    {translate('Coordinates')}: {memoizedEvent.x_coordinate.toFixed(2)}%, {memoizedEvent.y_coordinate.toFixed(2)}%
                  </p>
                </div>
                
                {memoizedEvent.tags && memoizedEvent.tags.length > 0 && (
                  <div className="mb-3">
                    <h6>{translate('Tags')}</h6>
                    <div className="d-flex flex-wrap">
                      {memoizedEvent.tags.map(tag => (
                        <Badge key={tag} bg="info" className="me-1 mb-1" style={{ fontSize: '0.9rem', padding: '6px 10px' }}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Col>
              
              {memoizedEvent.image_url && (
                <Col md={4}>
                  <div className="event-image-container">
                    <h6 className="mb-2">{translate('Attached Image')}</h6>
                    <a 
                      href={memoizedEvent.image_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="image-link"
                      onClick={(e) => {
                        if (!memoizedEvent.image_url.startsWith('http')) {
                          e.preventDefault();
                          
                          // Get just the filename without path
                          const imageFilename = memoizedEvent.image_url.split('/').pop();
                          
                          // Use uploads/events path
                          const imageUrl = `http://localhost:8000/uploads/events/${imageFilename}`;
                          window.open(imageUrl, '_blank');
                        }
                      }}
                    >
                      <Image 
                        src={memoizedEvent.image_url} 
                        alt={memoizedEvent.title} 
                        thumbnail 
                        className="w-100 cursor-pointer"
                      />
                    </a>
                  </div>
                </Col>
              )}
            </Row>
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