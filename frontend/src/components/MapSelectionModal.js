import React from 'react';
import { Modal, Button, ListGroup, Alert } from 'react-bootstrap';

const MapSelectionModal = ({ show, onHide, maps, onMapSelected }) => {
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Select a Map</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {maps && maps.length > 0 ? (
          <div className="map-options-container">
            <ListGroup>
              {maps.map(map => (
                <ListGroup.Item 
                  key={map.id} 
                  action
                  onClick={() => {
                    onMapSelected(map.id);
                    onHide();
                  }}
                >
                  {map.name}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        ) : (
          <Alert variant="warning">
            No maps available. Please add a map first.
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MapSelectionModal; 