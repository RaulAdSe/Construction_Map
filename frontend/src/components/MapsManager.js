import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Modal, ListGroup, Spinner, Badge, Alert } from 'react-bootstrap';
import { deleteMap, updateMap } from '../services/mapService';
import AddMapModal from './AddMapModal';

const MapsManager = ({ maps, onMapAdded, onMapDeleted, projectId }) => {
  const [selectedMap, setSelectedMap] = useState(null);
  const [showViewMapModal, setShowViewMapModal] = useState(false);
  const [showAddMapModal, setShowAddMapModal] = useState(false);
  const [deletingMap, setDeletingMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updatingMap, setUpdatingMap] = useState(null);
  const [selectedMainMap, setSelectedMainMap] = useState(null);
  const [showFixMapTypesButton, setShowFixMapTypesButton] = useState(false);
  const [fixingMapTypes, setFixingMapTypes] = useState(false);

  // Initialize selectedMainMap on component mount or when maps change
  useEffect(() => {
    if (maps && maps.length > 0) {
      // Find the main map (implantation type)
      const mainMap = maps.find(m => m.map_type === 'implantation');
      setSelectedMainMap(mainMap || maps[0]);
      
      // Check if there's a problem with map types (all implantation or none)
      const implantationCount = maps.filter(m => m.map_type === 'implantation').length;
      console.log(`Implantation maps: ${implantationCount}/${maps.length}`);
      
      // Show fix button if all maps are implantation or if no maps are implantation
      setShowFixMapTypesButton(implantationCount === maps.length || implantationCount === 0);
    }
  }, [maps]);
  
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
  
  const handleSetAsMainMap = async (map, e) => {
    // Prevent default form behavior if this is triggered by a form
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    if (selectedMainMap && selectedMainMap.id === map.id) {
      return;
    }
    
    try {
      setUpdatingMap(map.id);
      
      // First update the current map to be the main map
      const updatedCurrentMap = await updateMap(map.id, {
        name: map.name,
        map_type: 'implantation'
      });
      
      // Then update the previous main map to be an overlay
      let updatedPreviousMain = null;
      if (selectedMainMap) {
        updatedPreviousMain = await updateMap(selectedMainMap.id, {
          name: selectedMainMap.name,
          map_type: 'overlay'
        });
      }
      
      // Now update the local state
      setSelectedMainMap(updatedCurrentMap);
      
      // Notify parent component of the updates
      if (onMapAdded) {
        // First update the new main map
        onMapAdded(updatedCurrentMap);
        
        // Then update the previous main map if it exists
        if (updatedPreviousMain) {
          onMapAdded(updatedPreviousMain);
        }
      }
      
      // Set a success message and tell user we need to reload to see changes
      alert("Map set as main successfully! The page will reload to show the changes.");
      
      // Force a full page reload to the project maps tab
      window.location.href = `/projects/${projectId}?tab=project-maps`;
      
    } catch (error) {
      console.error('Error setting map as main:', error);
      alert("Error setting map as main: " + error.message);
    } finally {
      setUpdatingMap(null);
    }
  };
  
  // Fix function to correct map types if all are implantation or none are
  const handleFixMapTypes = async (e) => {
    // Prevent default form behavior if this is triggered by a form
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    if (!maps || maps.length === 0) return;
    
    try {
      setFixingMapTypes(true);
      
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
      
      // Update all maps in parent
      updatedMaps.forEach(m => onMapAdded(m));
      
      // Set a success message and tell user we need to reload to see changes
      alert("Map types fixed successfully! The page will reload to show the changes.");
      
      // Force a full page reload - this is the most reliable way to make sure all components update
      window.location.href = `/projects/${projectId}?tab=project-maps`;
      
    } catch (error) {
      console.error('Error fixing map types:', error);
      alert("There was an error fixing map types: " + error.message);
    } finally {
      setFixingMapTypes(false);
      setShowFixMapTypesButton(false);
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
        <div>
          {showFixMapTypesButton && (
            <Button 
              variant="danger" 
              onClick={handleFixMapTypes} 
              disabled={fixingMapTypes}
              className="me-2"
            >
              {fixingMapTypes ? (
                <><Spinner animation="border" size="sm" /> Fixing Map Types...</>
              ) : (
                "Fix Map Types"
              )}
            </Button>
          )}
          <Button variant="primary" onClick={() => setShowAddMapModal(true)}>
            Add New Map
          </Button>
        </div>
      </div>
      
      {showFixMapTypesButton && (
        <Alert variant="warning" className="mb-4">
          <Alert.Heading>Map Type Issue Detected</Alert.Heading>
          <p>
            All maps appear to be set as Main Maps or no Main Map is set. 
            This can cause issues with displaying overlays correctly. 
            Click "Fix Map Types" to automatically designate the first map as Main and others as overlays.
          </p>
        </Alert>
      )}
      
      <Row>
        {maps.map(map => (
          <Col md={4} key={`map-${map.id}`} className="mb-4">
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
                  <div className="d-flex gap-2">
                    <Button variant="outline-primary" onClick={() => handleViewMap(map)}>
                      View
                    </Button>
                    {map.map_type !== 'implantation' && (
                      <Button 
                        variant="warning" 
                        onClick={(e) => handleSetAsMainMap(map, e)}
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