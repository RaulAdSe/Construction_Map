import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { addMap } from '../services/mapService';

const AddMapModal = ({ show, onHide, onMapAdded, projectId }) => {
  const [mapName, setMapName] = useState('');
  const [mapFile, setMapFile] = useState(null);
  const [mapType, setMapType] = useState('implantation'); // Default to implantation
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!mapName) {
      setError('Please enter a name for the map');
      return;
    }
    
    if (!mapFile) {
      setError('Please select a file for the map');
      return;
    }
    
    if (!projectId) {
      setError('No project selected');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const newMap = await addMap(projectId, mapName, mapFile, mapType);
      onMapAdded(newMap);
      resetForm();
    } catch (error) {
      console.error('Error adding map:', error);
      setError('Failed to add map. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setMapName('');
    setMapFile(null);
    setMapType('implantation'); // Reset to default
    setError('');
  };
  
  const handleClose = () => {
    resetForm();
    onHide();
  };
  
  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Add New Map</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Map Name</Form.Label>
            <Form.Control
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              placeholder="Enter map name"
              required
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Map Type</Form.Label>
            <Form.Select
              value={mapType}
              onChange={(e) => setMapType(e.target.value)}
              required
            >
              <option value="implantation">Implantation (Main Map)</option>
              <option value="overlay">Overlay (Secondary Map)</option>
            </Form.Select>
            <Form.Text className="text-muted">
              An implantation map serves as the main map. Overlay maps can be displayed on top of the main map.
            </Form.Text>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Map File</Form.Label>
            <Form.Control
              type="file"
              onChange={(e) => setMapFile(e.target.files[0])}
              accept=".pdf,.jpg,.jpeg,.png,.svg"
              required
            />
            <Form.Text className="text-muted">
              Supported formats: PDF, JPG, PNG, SVG
            </Form.Text>
          </Form.Group>
          
          {error && <Alert variant="danger">{error}</Alert>}
          
          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Map'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default AddMapModal; 