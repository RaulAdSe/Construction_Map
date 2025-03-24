import React from 'react';
import { Modal, Button, Row, Col, Badge, Image } from 'react-bootstrap';
import { format } from 'date-fns';

const ViewEventModal = ({ show, onHide, event, allMaps = [] }) => {
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
  
  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Event Details: {event.title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
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