import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { addEvent } from '../services/eventService';

const AddEventModal = ({ show, onHide, mapId, position, onEventAdded, projectId, allMaps = [], visibleMaps = [] }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  
  // Get visible maps and their settings from the parent component
  const [visibleMapIds, setVisibleMapIds] = useState(() => {
    // Initialize with the visibleMaps prop and ensure the main map is included
    if (visibleMaps.length > 0) {
      if (!visibleMaps.includes(mapId)) {
        return [...visibleMaps, mapId];
      }
      return [...visibleMaps];
    }
    return [mapId];
  });
  
  // Create a list of all available maps for the overlay configuration
  const availableMaps = allMaps.filter(m => m.project_id === parseInt(projectId));
  const mainMap = availableMaps.find(m => m.id === parseInt(mapId));
  const overlayMaps = availableMaps.filter(m => m.id !== parseInt(mapId));
  
  // Update visibleMapIds when visibleMaps prop changes
  useEffect(() => {
    if (visibleMaps.length > 0) {
      let updatedMaps = [...visibleMaps];
      if (!visibleMaps.includes(mapId)) {
        updatedMaps.push(mapId);
      }
      setVisibleMapIds(updatedMaps);
    }
  }, [visibleMaps, mapId]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title) {
      setError('Please enter a title for the event');
      return;
    }
    
    if (!mapId) {
      setError('No map selected');
      return;
    }
    
    setError('');
    setLoading(true);
    
    // Prepare map overlay configuration with fixed opacity values
    const activeMapSettings = {};
    visibleMapIds.forEach(id => {
      // Main map gets 100% opacity, overlays get 50%
      const isMainMap = parseInt(id) === parseInt(mapId);
      activeMapSettings[id] = {
        opacity: isMainMap ? 1.0 : 0.5
      };
    });
    
    // Parse tags
    const tagsList = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    // Create FormData for multipart upload (if there's an image)
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('map_id', mapId);
    formData.append('title', title);
    formData.append('description', description || '');
    formData.append('x_coordinate', position.x);
    formData.append('y_coordinate', position.y);
    formData.append('active_maps', JSON.stringify(activeMapSettings));
    
    if (tagsList.length > 0) {
      formData.append('tags', JSON.stringify(tagsList));
    }
    
    if (uploadFile) {
      formData.append('image', uploadFile);
    }
    
    try {
      const newEvent = await addEvent(formData);
      onEventAdded(newEvent);
      resetForm();
    } catch (error) {
      console.error('Error adding event:', error);
      setError('Failed to add event. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTags('');
    setError('');
    setUploadFile(null);
    // Keep map selections as they are
  };
  
  const handleClose = () => {
    resetForm();
    onHide();
  };
  
  const toggleMapVisibility = (id) => {
    setVisibleMapIds(prev => {
      // Main map is always visible
      if (id === mainMap?.id) return prev;
      
      if (prev.includes(id)) {
        return prev.filter(mapId => mapId !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };
  
  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Add New Event</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Event Title</Form.Label>
            <Form.Control
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title"
              required
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter event description"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Tags (comma separated)</Form.Label>
            <Form.Control
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
            <Form.Text className="text-muted">
              Separate tags with commas
            </Form.Text>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Event Location</Form.Label>
            <p className="mb-1">
              <strong>Map:</strong> {mainMap?.name || `ID: ${mapId}`}
            </p>
            <p className="mb-0">
              <strong>Position:</strong> X: {position.x.toFixed(2)}%, Y: {position.y.toFixed(2)}%
            </p>
          </Form.Group>
          
          {overlayMaps.length > 0 && (
            <Form.Group className="mb-3">
              <Form.Label>Map Overlay Configuration</Form.Label>
              <div className="overlay-maps-list">
                <div className="main-map mb-2 d-flex justify-content-between align-items-center">
                  <Form.Check
                    type="checkbox"
                    id={`map-toggle-main-${mainMap?.id}`}
                    label={`${mainMap?.name || 'Main Map'} (Main)`}
                    checked={true}
                    disabled={true}
                  />
                  <small className="text-muted">100% opacity (fixed)</small>
                </div>
                
                {overlayMaps.map(map => (
                  <div key={map.id} className="mb-2 d-flex justify-content-between align-items-center">
                    <Form.Check
                      type="checkbox"
                      id={`map-toggle-${map.id}`}
                      label={map.name}
                      checked={visibleMapIds.includes(map.id)}
                      onChange={() => toggleMapVisibility(map.id)}
                    />
                    {visibleMapIds.includes(map.id) && (
                      <small className="text-muted">50% opacity (fixed)</small>
                    )}
                  </div>
                ))}
              </div>
              <Form.Text className="text-muted">
                The selected maps will be saved with this event. Main map is always at 100% opacity, overlays at 50%.
              </Form.Text>
            </Form.Group>
          )}
          
          <Form.Group className="mb-3">
            <Form.Label>Attach Image (optional)</Form.Label>
            <Form.Control
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </Form.Group>
          
          {error && <Alert variant="danger">{error}</Alert>}
          
          <div className="d-flex justify-content-end gap-2 mt-4">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Event'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default AddEventModal; 