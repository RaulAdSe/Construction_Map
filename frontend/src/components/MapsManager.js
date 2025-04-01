import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Spinner, Badge } from 'react-bootstrap';
import { deleteMap, fetchMaps, updateMap } from '../services/mapService';
import AddMapModal from './AddMapModal';
import './../assets/styles/MapViewer.css';
import translate from '../utils/translate';

const MapsManager = ({ projectId, onMapUpdated }) => {
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
    loadMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadMaps = async () => {
    try {
      setLoading(true);
      const response = await fetchMaps(projectId);
      
      // Always check and fix maps to ensure consistency
      await checkAndFixMaps(response);
      
      // Refresh maps after potential fixes
      const updatedMaps = await fetchMaps(projectId);
      setMaps(updatedMaps);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching maps:', error);
      setLoading(false);
    }
  };

  // Check if there's at least one main map and fix if not
  const checkAndFixMaps = async (maps) => {
    if (!maps || maps.length === 0) {
      return; // No maps to check
    }
    
    // Check if we've already tried to fix this project's maps to prevent endless retry loops
    const hasAttemptedFix = localStorage.getItem(refreshKey);
    if (hasAttemptedFix) {
      return; // Skip if already attempted
    }
    
    try {
      // Check if there's a main map (type = implantation)
      const mainMap = maps.find(map => map.map_type === 'implantation');
      
      if (!mainMap && maps.length > 0) {
        // No main map found, set the first map as main
        console.log('No main map found, fixing...');
        const firstMap = maps[0];
        await updateMap(firstMap.id, { map_type: 'implantation' });
        
        // Mark as attempted to prevent endless loops
        localStorage.setItem(refreshKey, 'true');
        
        // Notify parent component that a map type has been updated
        if (onMapUpdated) {
          onMapUpdated();
        }
        
        return true;
      }
    } catch (error) {
      console.error('Error fixing maps:', error);
    }
    
    return false;
  };

  const handleDeleteMap = (mapId) => {
    setDeletingMapId(mapId);
    setDeleteLoading(true);
    
    deleteMap(mapId).then(() => {
      setMaps(maps.filter(map => map.id !== mapId));
      setDeleteLoading(false);
      setDeletingMapId(null);
      
      // If the deleted map was the main map, set a new one
      const deletedMap = maps.find(map => map.id === mapId);
      if (deletedMap && deletedMap.map_type === 'implantation') {
        // Try to set another map as main automatically
        const remainingMaps = maps.filter(map => map.id !== mapId);
        if (remainingMaps.length > 0) {
          handleSetAsMainMap(remainingMaps[0].id);
        }
      }
      
      // Notify parent component that a map has been deleted
      if (onMapUpdated) {
        onMapUpdated();
      }
    }).catch(error => {
      console.error('Error deleting map:', error);
      setDeleteLoading(false);
      setDeletingMapId(null);
    });
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

      // Notify parent component that map has been updated
      if (onMapUpdated) {
        onMapUpdated();
      }
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
        <h2>{translate('Project Maps')}</h2>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          {translate('Add New Map')}
        </Button>
      </div>

      {maps.length === 0 ? (
        <p>{translate('No maps available for this project.')}</p>
      ) : (
        <div className="map-cards">
          {maps.map((map) => (
            <Card key={map.id} className="map-card">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <Card.Title>{map.name}</Card.Title>
                  <Badge bg={map.map_type === 'implantation' ? 'success' : 'secondary'}>
                    {map.map_type === 'implantation' ? translate('Main Map') : translate('Overlay')}
                  </Badge>
                </div>
                <Card.Text className="text-muted mb-2">{map.description || translate('No description')}</Card.Text>
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
                          {translate('Setting...')}
                        </>
                      ) : (
                        translate('Set as Main')
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
                        {translate('Deleting...')}
                      </>
                    ) : (
                      translate('Delete')
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
      <Modal
        show={showViewMapModal}
        onHide={() => setShowViewMapModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{selectedMap?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <img 
            src={selectedMap?.file_path} 
            alt={selectedMap?.name}
            style={{ maxWidth: '100%' }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewMapModal(false)}>
            {translate('Close')}
          </Button>
          {selectedMap?.map_type !== 'implantation' && (
            <Button 
              variant="primary"
              onClick={() => {
                handleSetAsMainMap(selectedMap.id);
                setShowViewMapModal(false);
              }}
            >
              {translate('Set as Main Map')}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
      
      {/* Confirm Set Main Map Modal */}
      <Modal
        show={!!selectedMainMap}
        onHide={() => setSelectedMainMap(null)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{translate('Confirm Main Map Change')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {translate('Are you sure you want to set')} <strong>{selectedMainMap?.name}</strong> {translate('as the main map?')}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSelectedMainMap(null)}>
            {translate('Cancel')}
          </Button>
          <Button 
            variant="primary"
            onClick={() => {
              if (selectedMainMap) {
                handleSetAsMainMap(selectedMainMap.id);
              }
              setSelectedMainMap(null);
            }}
          >
            {translate('Confirm')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MapsManager; 