import React, { useState } from 'react';
import { Row, Col, Card, Button, Modal, ListGroup, Spinner, Badge } from 'react-bootstrap';
import { deleteMap } from '../services/mapService';
import AddMapModal from './AddMapModal';

const MapsManager = ({ maps, onMapAdded, onMapDeleted, projectId }) => {
  const [selectedMap, setSelectedMap] = useState(null);
  const [showViewMapModal, setShowViewMapModal] = useState(false);
  const [showAddMapModal, setShowAddMapModal] = useState(false);
  const [deletingMap, setDeletingMap] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const handleViewMap = (map) => {
    setSelectedMap(map);
    setShowViewMapModal(true);
  };
  
  const handleMapAdded = (newMap) => {
    setShowAddMapModal(false);
    onMapAdded(newMap);
  };
  
  const handleDeleteMap = async (mapId) => {
    try {
      setLoading(true);
      await deleteMap(mapId);
      setDeletingMap(null);
      onMapDeleted(mapId);
    } catch (error) {
      console.error('Error deleting map:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (!maps || maps.length === 0) {
    return (
      <div className="text-center p-5 mb-4">
        <h4>No Maps Available</h4>
        <p>This project doesn't have any maps yet.</p>
        <Button variant="primary" onClick={() => setShowAddMapModal(true)}>
          Add Your First Map
        </Button>
        
        <AddMapModal 
          show={showAddMapModal}
          onHide={() => setShowAddMapModal(false)}
          onMapAdded={handleMapAdded}
          projectId={projectId}
        />
      </div>
    );
  }
  
  return (
    <div className="maps-manager">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Project Maps</h3>
        <Button variant="primary" onClick={() => setShowAddMapModal(true)}>
          Add New Map
        </Button>
      </div>
      
      <Row>
        {maps.map(map => (
          <Col md={4} key={map.id} className="mb-4">
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">{map.name}</h5>
                <Badge bg={map.map_type === 'implantation' ? 'primary' : 'info'}>
                  {map.map_type}
                </Badge>
              </Card.Header>
              <Card.Body className="text-center">
                <div 
                  className="map-preview mb-3" 
                  style={{ 
                    height: '150px', 
                    background: '#f8f9fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleViewMap(map)}
                >
                  <i className="bi bi-map" style={{ fontSize: '3rem', color: '#6c757d' }}></i>
                </div>
                
                <div className="d-flex justify-content-between">
                  <Button variant="outline-primary" onClick={() => handleViewMap(map)}>
                    View
                  </Button>
                  <Button 
                    variant="outline-danger"
                    onClick={() => setDeletingMap(map)}
                  >
                    Delete
                  </Button>
                </div>
              </Card.Body>
              <Card.Footer className="text-muted">
                <small>Uploaded: {new Date(map.uploaded_at).toLocaleDateString()}</small>
              </Card.Footer>
            </Card>
          </Col>
        ))}
      </Row>
      
      {/* View Map Modal */}
      <Modal
        show={showViewMapModal}
        onHide={() => setShowViewMapModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{selectedMap?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {selectedMap?.content_url && (
            <iframe
              src={selectedMap.content_url}
              title={selectedMap.name}
              style={{ 
                width: '100%', 
                height: '70vh', 
                border: 'none' 
              }}
            />
          )}
        </Modal.Body>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal
        show={!!deletingMap}
        onHide={() => setDeletingMap(null)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete the map "{deletingMap?.name}"? This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeletingMap(null)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={() => handleDeleteMap(deletingMap?.id)}
            disabled={loading}
          >
            {loading ? <><Spinner animation="border" size="sm" /> Deleting...</> : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Add Map Modal */}
      <AddMapModal 
        show={showAddMapModal}
        onHide={() => setShowAddMapModal(false)}
        onMapAdded={handleMapAdded}
        projectId={projectId}
      />
    </div>
  );
};

export default MapsManager; 