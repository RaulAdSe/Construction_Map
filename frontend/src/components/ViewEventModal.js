import React, { useState } from 'react';
import { Modal, Button, Row, Col, Badge, Image, Tabs, Tab, Form } from 'react-bootstrap';
import { format } from 'date-fns';
import EventComments from './EventComments';
import { updateEventStatus, updateEventState } from '../services/eventService';

const ViewEventModal = ({ show, onHide, event, allMaps = [], onEventUpdated }) => {
  const [updating, setUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [currentType, setCurrentType] = useState('');
  
  React.useEffect(() => {
    if (event) {
      setCurrentStatus(event.status || 'open');
      setCurrentType(event.state || 'periodic check');
    }
  }, [event]);

  if (!event) return null;
  
  // Parse active maps configuration from event
  let activeMapSettings = {};
  try {
    if (event.active_maps && typeof event.active_maps === 'string') {
      activeMapSettings = JSON.parse(event.active_maps);
    } else if (event.active_maps) {
      activeMapSettings = event.active_maps;
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
        return <Badge bg="primary">Open</Badge>;
      case 'in-progress':
        return <Badge bg="info">In Progress</Badge>;
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
    setCurrentStatus(newStatus);
    
    try {
      setUpdating(true);
      await updateEventStatus(event.id, newStatus);
      if (onEventUpdated) {
        onEventUpdated({...event, status: newStatus});
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      setCurrentStatus(event.status); // Revert on error
    } finally {
      setUpdating(false);
    }
  };
  
  const handleTypeChange = async (e) => {
    const newType = e.target.value;
    setCurrentType(newType);
    
    try {
      setUpdating(true);
      await updateEventState(event.id, newType);
      if (onEventUpdated) {
        onEventUpdated({...event, state: newType});
      }
    } catch (error) {
      console.error('Failed to update type:', error);
      setCurrentType(event.state); // Revert on error
    } finally {
      setUpdating(false);
    }
  };
  
  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      dialogClassName="event-modal-dialog"
      backdropClassName="event-modal-backdrop"
      contentClassName="modal-content"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <div className="d-flex align-items-center">
            <span className="me-2">Event: {event.title}</span>
            {getTypeBadge()}
          </div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs 
          defaultActiveKey="details" 
          className="mb-3"
        >
          <Tab eventKey="details" title="Details">
            <Row>
              <Col md={event.image_url ? 8 : 12}>
                <div className="mb-3">
                  <h6>Description</h6>
                  <p>{event.description || "No description provided."}</p>
                </div>
                
                <Row>
                  <Col md={6}>
                    <div className="mb-3">
                      <h6>Created By</h6>
                      <p>{event.created_by_user_name || `User ID: ${event.created_by_user_id}`}</p>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-3">
                      <h6>Created At</h6>
                      <p>{format(new Date(event.created_at), 'PPPp')}</p>
                    </div>
                  </Col>
                </Row>
                
                <Row className="mb-3">
                  <Col md={6}>
                    <h6>Status</h6>
                    <Form.Group>
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
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <h6>Type</h6>
                    <Form.Group>
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
                    </Form.Group>
                  </Col>
                </Row>
                
                <div className="mb-3">
                  <h6>Map Location</h6>
                  <p>Map: {event.map_name || `ID: ${event.map_id}`}</p>
                  <p>Coordinates: X: {event.x_coordinate.toFixed(2)}%, Y: {event.y_coordinate.toFixed(2)}%</p>
                </div>
                
                {Object.keys(activeMapSettings).length > 0 && (
                  <div className="mb-3">
                    <h6>Map Overlay Configuration</h6>
                    <div className="map-settings-list">
                      {Object.entries(activeMapSettings).map(([mapId, settings]) => (
                        <div key={mapId} className="d-flex justify-content-between align-items-center mb-1">
                          <span>
                            {parseInt(mapId) === event.map_id ? (
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
                
                {event.tags && event.tags.length > 0 && (
                  <div className="mb-3">
                    <h6>Tags</h6>
                    <div>
                      {event.tags.map(tag => (
                        <Badge key={tag} bg="info" className="me-1 mb-1">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Col>
              
              {event.image_url && (
                <Col md={4}>
                  <div className="event-image-container">
                    <h6 className="mb-2">Attached Image</h6>
                    <a 
                      href={event.image_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="image-link"
                      onClick={(e) => {
                        if (!event.image_url.startsWith('http')) {
                          e.preventDefault();
                          // Fix image URL path with auth token
                          const baseUrl = 'http://localhost:8000';
                          // Check if the path starts with /api/v1
                          let imagePath = event.image_url;
                          if (!imagePath.startsWith('/api/v1') && !imagePath.startsWith('/api/')) {
                            // Add /api/v1 prefix if missing
                            imagePath = imagePath.startsWith('/') 
                              ? `/api/v1${imagePath}` 
                              : `/api/v1/${imagePath}`;
                          }
                          // Get auth token
                          const token = localStorage.getItem('token');
                          const url = `${baseUrl}${imagePath}${token ? `?token=${token}` : ''}`;
                          window.open(url, '_blank');
                        }
                      }}
                    >
                      <Image 
                        src={event.image_url.startsWith('http') 
                          ? event.image_url 
                          : `http://localhost:8000${
                              event.image_url.startsWith('/api/v1') || event.image_url.startsWith('/api/')
                                ? event.image_url
                                : event.image_url.startsWith('/')
                                  ? `/api/v1${event.image_url}`
                                  : `/api/v1/${event.image_url}`
                            }${localStorage.getItem('token') ? `?token=${localStorage.getItem('token')}` : ''}`} 
                        alt={event.title} 
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
            title={`Comments ${event.comment_count ? `(${event.comment_count})` : ''}`}
          >
            <EventComments eventId={event.id} />
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ViewEventModal; 