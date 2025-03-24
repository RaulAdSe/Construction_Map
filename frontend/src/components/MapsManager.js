import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Modal, ListGroup, Spinner, Badge } from 'react-bootstrap';
import { deleteMap, updateMap } from '../services/mapService';
import AddMapModal from './AddMapModal';

const MapsManager = ({ maps, onMapAdded, onMapDeleted, projectId }) => {
  const [selectedMap, setSelectedMap] = useState(null);
  const [showViewMapModal, setShowViewMapModal] = useState(false);
  const [showAddMapModal, setShowAddMapModal] = useState(false);
  const [deletingMap, setDeletingMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixingMapTypes, setFixingMapTypes] = useState(false);
  const [showFixMapTypesButton, setShowFixMapTypesButton] = useState(false);
  const [selectedMainMap, setSelectedMainMap] = useState(null);
  
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
  
  const handleFixMapTypes = async () => {
    if (!maps || maps.length === 0) return;
    
    try {
      setFixingMapTypes(true);
      
      // Log map types before fixing
      console.log("Current map types before fixing:", maps.map(m => ({ id: m.id, name: m.name, type: m.map_type })));
      
      // Select the first map as implantation and rest as overlay
      const firstMap = maps[0];
      
      // Update the first map to be implantation
      const mainMap = await updateMap(firstMap.id, {
        name: firstMap.name,
        map_type: 'implantation'
      });
      
      // Update all other maps to be overlay
      const updatedMaps = [mainMap];
      
      // Process remaining maps
      for (let i = 1; i < maps.length; i++) {
        const currentMap = maps[i];
        // Only update if not already overlay
        if (currentMap.map_type !== 'overlay') {
          const overlayMap = await updateMap(currentMap.id, {
            name: currentMap.name,
            map_type: 'overlay'
          });
          updatedMaps.push(overlayMap);
        } else {
          updatedMaps.push(currentMap);
        }
      }
      
      // Log map types after fixing
      console.log("Updated map types:", updatedMaps.map(m => ({ id: m.id, name: m.name, type: m.map_type })));
      
      // Update all maps in parent
      updatedMaps.forEach(m => onMapAdded(m));
      
      // Force a hard reload after a short delay to ensure changes are reflected
      setTimeout(() => {
        window.location.href = window.location.href;
      }, 1000);
      
    } catch (error) {
      console.error('Error fixing map types:', error);
    } finally {
      setFixingMapTypes(false);
      setShowFixMapTypesButton(false);
    }
  };
  
  // Initialize selectedMainMap on component mount or when maps change
  useEffect(() => {
    if (maps && maps.length > 0) {
      // Find the main map (implantation type)
      const mainMap = maps.find(m => m.map_type === 'implantation');
      setSelectedMainMap(mainMap || maps[0]);
      
      // Check if there's a problem with map types (all implantation or none)
      const implantationCount = maps.filter(m => m.map_type === 'implantation').length;
      
      // Log map types to console
      console.log("Current Maps:", maps.map(m => ({ id: m.id, name: m.name, type: m.map_type })));
      console.log(`Implantation count: ${implantationCount}/${maps.length}`);
      
      // Show fix button if all maps are implantation or if no maps are implantation
      // For debugging, always show the button
      setShowFixMapTypesButton(true);
    }
  }, [maps]);
  
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
                <div>
                  <h5 className="mb-0">{map.name}</h5>
                  <small className="text-muted">Type: {map.map_type || 'none'}</small>
                </div>
                {map.map_type === 'implantation' ? (
                  <Badge bg="primary">Main Map</Badge>
                ) : (
                  <Badge bg="info">Overlay</Badge>
                )}
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