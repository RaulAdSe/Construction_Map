import React from 'react';
import { Modal, Button, Row, Col, Badge, Image } from 'react-bootstrap';
import { format } from 'date-fns';

const ViewEventModal = ({ show, onHide, event }) => {
  if (!event) return null;
  
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