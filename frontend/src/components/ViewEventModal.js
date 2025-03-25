import React, { useState } from 'react';
import { Modal, Button, Row, Col, Badge, Image, Tabs, Tab, Form } from 'react-bootstrap';
import { format } from 'date-fns';
import EventComments from './EventComments';
import { updateEventStatus, updateEventState } from '../services/eventService';

const ViewEventModal = ({ show, onHide, event, allMaps = [], onEventUpdated }) => {
  const [updating, setUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [currentState, setCurrentState] = useState('');
  
  React.useEffect(() => {
    if (event) {
      setCurrentStatus(event.status || 'open');
      setCurrentState(event.state || 'green');
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
  
  // Get state badge color
  const getStateBadge = () => {
    switch (currentState) {
      case 'red':
        return <Badge bg="danger">Critical</Badge>;
      case 'yellow':
        return <Badge bg="warning" text="dark">Warning</Badge>;
      case 'green':
        return <Badge bg="success">Normal</Badge>;
      default:
        return <Badge bg="secondary">{currentState}</Badge>;
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
  
  const handleStateChange = async (e) => {
    const newState = e.target.value;
    setCurrentState(newState);
    
    try {
      setUpdating(true);
      await updateEventState(event.id, newState);
      if (onEventUpdated) {
        onEventUpdated({...event, state: newState});
      }
    } catch (error) {
      console.error('Failed to update state:', error);
      setCurrentState(event.state); // Revert on error
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
            {getStateBadge()}
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
                    <h6>State</h6>
                    <Form.Group>
                      <Form.Select 
                        value={currentState} 
                        onChange={handleStateChange}
                        disabled={updating}
                        className="mb-2"
                      >
                        <option value="green">Normal (Green)</option>
                        <option value="yellow">Warning (Yellow)</option>
                        <option value="red">Critical (Red)</option>
                      </Form.Select>
                      {getStateBadge()}
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
                    <Image 
                      src={event.image_url} 
                      alt={event.title} 
                      thumbnail 
                      className="w-100" 
                    />
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