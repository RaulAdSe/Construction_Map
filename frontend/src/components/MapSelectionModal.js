import React from 'react';
import { Modal, Button, ListGroup, Alert } from 'react-bootstrap';
import translate from '../utils/translate';

const MapSelectionModal = ({ show, onHide, maps, onMapSelected }) => {
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>{translate('Select Map')}</Modal.Title>
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
            {translate('No maps available. Please add a map first.')}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          {translate('Cancel')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MapSelectionModal; 