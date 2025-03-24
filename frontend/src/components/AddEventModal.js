import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge } from 'react-bootstrap';
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
  
  // Create a list of all available maps for reference
  const availableMaps = allMaps.filter(m => m.project_id === parseInt(projectId));
  const mainMap = availableMaps.find(m => m.id === parseInt(mapId));
  const overlayMaps = availableMaps.filter(m => 
    m.id !== parseInt(mapId) && visibleMapIds.includes(m.id)
  );
  
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
            <div className="event-location-summary mb-3">
              <div className="d-flex align-items-center mb-2">
                <h6 className="mb-0 me-2">Current View:</h6>
                <Badge bg="info">{visibleMapIds.length} visible map layers</Badge>
              </div>
              
              <div className="map-layers-info">
                <p className="mb-1">
                  <strong>Primary Map:</strong> {mainMap?.name || 'Unknown'}
                </p>
                
                {overlayMaps.length > 0 && (
                  <div className="overlay-maps">
                    <p className="mb-1"><strong>Overlay Maps:</strong></p>
                    <ul className="list-unstyled ms-3">
                      {overlayMaps.map(map => (
                        <li key={map.id}>{map.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <p className="mb-0">
                  <strong>Event Position:</strong> X: {position.x.toFixed(2)}%, Y: {position.y.toFixed(2)}%
                </p>
              </div>
            </div>
          </Form.Group>
          
          <hr />
          
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