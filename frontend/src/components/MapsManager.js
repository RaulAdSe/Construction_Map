import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Spinner, Badge } from 'react-bootstrap';
import { deleteMap, fetchMaps, updateMap } from '../services/mapService';
import AddMapModal from './AddMapModal';
import './../assets/styles/MapViewer.css';

const MapsManager = ({ projectId }) => {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [deletingMapId, setDeletingMapId] = useState(null);
  const [updatingMapId, setUpdatingMapId] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [showViewMapModal, setShowViewMapModal] = useState(false);
  const [selectedMainMap, setSelectedMainMap] = useState(null);

  const refreshKey = `mapFixAttempted_${projectId}`;

  useEffect(() => {
    fetchMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchMaps = async () => {
    try {
      setLoading(true);
      const response = await fetchMaps(projectId);
      setMaps(response);
      
      // Check if we've already tried to fix maps this session
      const fixAttempted = localStorage.getItem(refreshKey);
      
      if (!fixAttempted) {
        // Only attempt to fix maps once per session
        await checkAndFixMaps(response);
        // Mark that we've attempted a fix
        localStorage.setItem(refreshKey, 'true');
      } else {
        console.log('Map fix already attempted in this session, skipping check');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching maps:', error);
      setLoading(false);
    }
  };

  // Function to check and fix map types
  const checkAndFixMaps = async (mapsList) => {
    // Count how many main maps (implantation) we have
    const mainMaps = mapsList.filter(map => map.map_type === 'implantation');
    console.log(`Found ${mainMaps.length} main maps`);
    
    // No main maps found, set the first map as main
    if (mainMaps.length === 0 && mapsList.length > 0) {
      console.log('No main maps found. Setting first map as main map.');
      try {
        const firstMap = mapsList[0];
        await updateMap(firstMap.id, { map_type: 'implantation' });
        // Alert before refresh
        alert('Setting first map as main map. Page will refresh once.');
        window.location.reload();
      } catch (error) {
        console.error('Error setting main map:', error);
      }
    }
    
    // Multiple main maps found, keep only the first one as main
    if (mainMaps.length > 1) {
      console.log(`Multiple main maps found (${mainMaps.length}). Fixing to keep only one main map.`);
      try {
        // Update all but the first main map to be overlays
        const updatePromises = mainMaps.slice(1).map(map => 
          updateMap(map.id, { map_type: 'overlay' })
        );
        
        await Promise.all(updatePromises);
        
        // Alert before refresh
        alert(`Fixed ${mainMaps.length - 1} maps that were incorrectly set as main. Page will refresh once.`);
        
        // Use setTimeout to ensure the alert is seen before refresh
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (error) {
        console.error('Error fixing main maps:', error);
      }
    }
  };

  const handleDeleteMap = async (mapId) => {
    setDeletingMapId(mapId);
    setDeleteLoading(true);
    try {
      await deleteMap(mapId);
      setMaps(maps.filter(map => map.id !== mapId));
    } catch (error) {
      console.error('Error deleting map:', error);
    }
    setDeleteLoading(false);
    setDeletingMapId(null);
  };

  const handleSetAsMainMap = async (mapId) => {
    setUpdatingMapId(mapId);
    try {
      // Find the current main map
      const currentMainMap = maps.find(map => map.map_type === 'implantation');
      
      // Change current main map to overlay
      if (currentMainMap) {
        await updateMap(currentMainMap.id, { map_type: 'overlay' });
      }
      
      // Set the selected map as main
      await updateMap(mapId, { map_type: 'implantation' });
      
      // Update local state to reflect changes
      setMaps(maps.map(map => {
        if (map.id === currentMainMap?.id) {
          return { ...map, map_type: 'overlay' };
        }
        if (map.id === mapId) {
          return { ...map, map_type: 'implantation' };
        }
        return map;
      }));
    } catch (error) {
      console.error('Error setting map as main:', error);
    }
    setUpdatingMapId(null);
  };

  const handleAddMap = (newMap) => {
    setMaps([...maps, newMap]);
  };

  const handleViewMap = (map) => {
    setSelectedMap(map);
    setShowViewMapModal(true);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center mt-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div className="maps-container">
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <h2>Project Maps</h2>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          Add New Map
        </Button>
      </div>

      {maps.length === 0 ? (
        <p>No maps available for this project.</p>
      ) : (
        <div className="map-cards">
          {maps.map((map) => (
            <Card key={map.id} className="map-card">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <Card.Title>{map.name}</Card.Title>
                  <Badge bg={map.map_type === 'implantation' ? 'success' : 'secondary'}>
                    {map.map_type === 'implantation' ? 'Main Map' : 'Overlay'}
                  </Badge>
                </div>
                <Card.Text className="text-muted mb-2">{map.description || 'No description'}</Card.Text>
                <div className="d-flex justify-content-between mt-3">
                  {map.map_type !== 'implantation' && (
                    <Button
                      variant="warning"
                      onClick={() => handleSetAsMainMap(map.id)}
                      disabled={updatingMapId !== null}
                    >
                      {updatingMapId === map.id ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" className="me-1" />
                          Setting...
                        </>
                      ) : (
                        'Set as Main'
                      )}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    onClick={() => handleDeleteMap(map.id)}
                    disabled={deleteLoading}
                    className="ms-auto" // Push to the right
                  >
                    {deletingMapId === map.id && deleteLoading ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-1" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      <AddMapModal
        show={showModal}
        onHide={() => setShowModal(false)}
        projectId={projectId}
        onMapAdded={handleAddMap}
      />

      {/* View Map Modal */}
      <Modal show={showViewMapModal} onHide={() => setShowViewMapModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{selectedMap?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Map preview content would go here */}
          <div className="text-center p-5">
            <h4>Map Preview</h4>
            <p>A preview of the map would be displayed here.</p>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default MapsManager; 