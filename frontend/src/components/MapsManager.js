import React, { useState } from 'react';
import { Row, Col, Card, Button, Modal, ListGroup, Spinner, Badge } from 'react-bootstrap';
import { deleteMap, updateMap } from '../services/mapService';
import AddMapModal from './AddMapModal';

const MapsManager = ({ maps, onMapAdded, onMapDeleted, projectId }) => {
  const [selectedMap, setSelectedMap] = useState(null);
  const [showViewMapModal, setShowViewMapModal] = useState(false);
  const [showAddMapModal, setShowAddMapModal] = useState(false);
  const [deletingMap, setDeletingMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updatingMap, setUpdatingMap] = useState(null);
  
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
  
  const handleSetAsMainMap = async (map) => {
    if (map.map_type === 'implantation') {
      // Already the main map
      return;
    }
    
    try {
      setUpdatingMap(map.id);
      
      // First, find current implantation map and set it to overlay
      const currentMainMap = maps.find(m => m.map_type === 'implantation');
      if (currentMainMap) {
        await updateMap(currentMainMap.id, {
          name: currentMainMap.name,
          map_type: 'overlay'
        });
      }
      
      // Then set the selected map as implantation
      const updatedMap = await updateMap(map.id, {
        name: map.name,
        map_type: 'implantation'
      });
      
      // Call a function to update the map in the parent component
      handleMapUpdated(updatedMap);
      
      // If there was a previous main map, update it in the UI too
      if (currentMainMap) {
        handleMapUpdated({
          ...currentMainMap,
          map_type: 'overlay'
        });
      }
      
    } catch (error) {
      console.error('Error setting map as main:', error);
    } finally {
      setUpdatingMap(null);
    }
  };
  
  const handleMapUpdated = (updatedMap) => {
    // Create a new array with the updated map
    const updatedMaps = maps.map(m => 
      m.id === updatedMap.id ? updatedMap : m
    );
    
    // Call the parent's onMapAdded function to update the state
    onMapAdded(updatedMap);
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
                  {map.map_type === 'implantation' ? 'Main Map' : 'Overlay'}
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
                  <div className="d-flex gap-2">
                    <Button variant="outline-primary" onClick={() => handleViewMap(map)}>
                      View
                    </Button>
                    {map.map_type !== 'implantation' && (
                      <Button 
                        variant="warning" 
                        onClick={() => handleSetAsMainMap(map)}
                        disabled={updatingMap === map.id}
                      >
                        {updatingMap === map.id ? (
                          <><Spinner animation="border" size="sm" /> Setting...</>
                        ) : (
                          "Set as Main"
                        )}
                      </Button>
                    )}
                  </div>
                  <Button 
                    variant="outline-danger"
                    onClick={() => setDeletingMap(map)}
                    disabled={updatingMap === map.id}
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
            <div style={{ height: '70vh', width: '100%', overflow: 'hidden' }}>
              <iframe
                src={`${selectedMap.content_url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit&zoom=page-fit`}
                title={selectedMap.name}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  border: 'none',
                  backgroundColor: 'white'
                }}
                frameBorder="0"
              />
            </div>
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