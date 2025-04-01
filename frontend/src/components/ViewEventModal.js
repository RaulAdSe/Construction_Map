import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Modal, Button, Row, Col, Badge, Image, Tabs, Tab, Form } from 'react-bootstrap';
import { format } from 'date-fns';
import EventComments from './EventComments';
import { updateEventStatus, updateEventState } from '../services/eventService';
import { isUserAdmin, canPerformAdminAction } from '../utils/permissions';
import { parseAndHighlightMentions } from '../utils/mentionUtils';

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
  
  // Use ref for modal element to help with force closing
  const modalRef = useRef(null);
  
  // Memoize the event ID to avoid unnecessary re-renders
  const eventId = useMemo(() => event?.id, [event?.id]);
  
  // Memoize the entire event object to prevent excessive re-renders
  const memoizedEvent = useMemo(() => event, [event?.id]);
  
  // Use callback for the onHide function to prevent infinite loops
  const handleHide = useCallback(() => {
    if (onHide) {
      onHide();
    }
  }, [onHide]);
  
  // Only update state when event changes or modal shows
  useEffect(() => {
    if (event && show) {
      setCurrentStatus(event.status || 'open');
      setCurrentType(event.state || 'periodic check');
      
      // If there's a highlighted comment, switch to comments tab
      if (highlightCommentId) {
        setActiveTab('comments');
      }
    }
  }, [event?.id, show, highlightCommentId]);

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
        return <Badge bg="danger">Incidence</Badge>;
      case 'periodic check':
        return <Badge bg="info">Periodic Check</Badge>;
      default:
        return <Badge bg="secondary">{currentType}</Badge>;
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    switch (currentStatus) {
      case 'open':
        return <Badge bg="danger">Open</Badge>;
      case 'in-progress':
        return <Badge bg="warning">In Progress</Badge>;
      case 'resolved':
        return <Badge bg="success">Resolved</Badge>;
      case 'closed':
        return <Badge bg="secondary">Closed</Badge>;
      default:
        return <Badge bg="secondary">{currentStatus}</Badge>;
    }
  };
  
  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    
    // Prevent members from closing or resolving events
    if ((newStatus === 'closed' || newStatus === 'resolved') && !canPerformAdminAction('change event status', effectiveIsAdmin)) {
      alert('Only admin users can close or resolve events.');
      return;
    }
    
    setCurrentStatus(newStatus);
    
    try {
      setUpdating(true);
      await updateEventStatus(memoizedEvent.id, newStatus);
      if (onEventUpdated) {
        onEventUpdated({...memoizedEvent, status: newStatus});
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      setCurrentStatus(memoizedEvent.status); // Revert on error
      if (error.response && error.response.status === 403) {
        alert('Permission denied: Only admin users can modify event status.');
      }
    } finally {
      setUpdating(false);
    }
  };
  
  const handleTypeChange = async (e) => {
    const newType = e.target.value;
    
    // Prevent members from changing event type
    if (!canPerformAdminAction('change event type', effectiveIsAdmin)) {
      alert('Only admin users can change event type.');
      return;
    }
    
    setCurrentType(newType);
    
    try {
      setUpdating(true);
      await updateEventState(memoizedEvent.id, newType);
      if (onEventUpdated) {
        onEventUpdated({...memoizedEvent, state: newType});
      }
    } catch (error) {
      console.error('Failed to update type:', error);
      setCurrentType(memoizedEvent.state); // Revert on error
      if (error.response && error.response.status === 403) {
        alert('Permission denied: Only admin users can modify event type.');
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
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <div className="d-flex align-items-center">
            <span className="me-2">Event: {memoizedEvent.title}</span>
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
          <Tab eventKey="details" title="Details">
            <Row>
              <Col md={memoizedEvent.image_url ? 8 : 12}>
                <div className="mb-3">
                  <h6>Description</h6>
                  <p>{memoizedEvent.description ? parseAndHighlightMentions(memoizedEvent.description) : "No description provided."}</p>
                </div>
                
                <Row>
                  <Col md={6}>
                    <div className="mb-3">
                      <h6>Created By</h6>
                      <p>{memoizedEvent.created_by_user_name || `User ID: ${memoizedEvent.created_by_user_id}`}</p>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-3">
                      <h6>Created At</h6>
                      <p>{format(new Date(memoizedEvent.created_at), 'PPPp')}</p>
                    </div>
                  </Col>
                </Row>
                
                <Row className="mb-3">
                  <Col md={6}>
                    <h6>Status</h6>
                    <Form.Group>
                      {/* For members: Only show a disabled badge, no dropdown */}
                      {effectiveIsAdmin !== true ? (
                        <div>
                          {getStatusBadge()}
                          <small className="text-muted d-block mt-2">
                            Only administrators can change event status.
                          </small>
                        </div>
                      ) : (
                        /* For admins: Show the dropdown with all options */
                        <>
                          <Form.Select 
                            value={currentStatus} 
                            onChange={handleStatusChange}
                            disabled={updating}
                            className="mb-2"
                          >
                            <option value="open">Open</option>
                            <option value="in-progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </Form.Select>
                          {getStatusBadge()}
                        </>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <h6>Type</h6>
                    <Form.Group>
                      {/* For members: Only show a badge, no dropdown */}
                      {effectiveIsAdmin !== true ? (
                        <div>
                          {getTypeBadge()}
                          <small className="text-muted d-block mt-2">
                            Only administrators can change event type.
                          </small>
                        </div>
                      ) : (
                        /* For admins: Show the dropdown with all options */
                        <>
                          <Form.Select 
                            value={currentType} 
                            onChange={handleTypeChange}
                            disabled={updating}
                            className="mb-2"
                          >
                            <option value="periodic check">Periodic Check</option>
                            <option value="incidence">Incidence</option>
                          </Form.Select>
                          {getTypeBadge()}
                        </>
                      )}
                    </Form.Group>
                  </Col>
                </Row>
                
                <div className="mb-3">
                  <h6>Map Location</h6>
                  <p>Map: {memoizedEvent.map_name || `ID: ${memoizedEvent.map_id}`}</p>
                  <p>Coordinates: X: {memoizedEvent.x_coordinate.toFixed(2)}%, Y: {memoizedEvent.y_coordinate.toFixed(2)}%</p>
                </div>
                
                {Object.keys(activeMapSettings).length > 0 && (
                  <div className="mb-3">
                    <h6>Map Overlay Configuration</h6>
                    <div className="map-settings-list">
                      {Object.entries(activeMapSettings).map(([mapId, settings]) => (
                        <div key={mapId} className="d-flex justify-content-between align-items-center mb-1">
                          <span>
                            {parseInt(mapId) === memoizedEvent.map_id ? (
                              <strong>{getMapName(mapId)} (Main)</strong>
                            ) : (
                              getMapName(mapId)
                            )}
                          </span>
                          <span>Opacity: {Math.round((settings.opacity || 1) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {memoizedEvent.tags && memoizedEvent.tags.length > 0 && (
                  <div className="mb-3">
                    <h6>Tags</h6>
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
                    <h6 className="mb-2">Attached Image</h6>
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
                        src={memoizedEvent.image_url.startsWith('http') 
                          ? memoizedEvent.image_url 
                          : (() => {
                              // Get just the filename without path
                              const imageFilename = memoizedEvent.image_url.split('/').pop();
                              // Use uploads/events path
                              return `http://localhost:8000/uploads/events/${imageFilename}`;
                            })()
                        } 
                        alt={memoizedEvent.title} 
                        thumbnail 
                        className="w-100 event-image" 
                        style={{ maxHeight: '300px', objectFit: 'contain' }}
                      />
                      <div className="mt-2 text-center">
                        <small className="text-muted">Click to view full size</small>
                      </div>
                    </a>
                  </div>
                </Col>
              )}
            </Row>
          </Tab>
          <Tab 
            eventKey="comments" 
            title={`Comments ${memoizedEvent.comment_count ? `(${memoizedEvent.comment_count})` : ''}`}
          >
            {/* Use memoized eventId to prevent unnecessary re-renders */}
            <EventComments 
              eventId={eventId} 
              projectId={projectId} 
              highlightCommentId={highlightCommentId}
            />
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={handleHide}
          className="close-event-btn"
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default React.memo(ViewEventModal); 