import React, { useState, useRef } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { addMap } from '../services/mapService';
import translate from '../utils/translate';

const AddMapModal = ({ show, onHide, onMapAdded, projectId }) => {
  const [mapName, setMapName] = useState('');
  const [mapDescription, setMapDescription] = useState('');
  const [mapFile, setMapFile] = useState(null);
  const [mapType, setMapType] = useState('overlay');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState('');
  const fileInputRef = useRef(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!mapName) {
      setError(translate('Please enter a name for the map'));
      return;
    }
    
    if (!mapFile) {
      setError(translate('Please select a file for the map'));
      return;
    }
    
    if (!projectId) {
      setError(translate('No project selected'));
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const newMap = await addMap(
        projectId, 
        mapName, 
        mapFile, 
        mapType,
        { description: mapDescription }
      );
      
      onMapAdded(newMap);
      resetForm();
      onHide();
    } catch (error) {
      console.error('Error adding map:', error);
      // Display the error message from the server or a user-friendly one
      setError(error.message || translate('Failed to add map. Please try again.'));
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setMapName('');
    setMapDescription('');
    setMapFile(null);
    setMapType('overlay');
    setPreview('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };
  
  const handleClose = () => {
    resetForm();
    onHide();
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    
    if (!file) {
      setMapFile(null);
      setPreview('');
      return;
    }
    
    // Check if the file is a PDF
    if (!file.type.match('application/pdf')) {
      setError(translate('Please select a PDF file'));
      setMapFile(null);
      setPreview('');
      return;
    }
    
    setMapFile(file);
    
    // For PDFs, we can't show a preview, so we'll just clear any existing preview
    setPreview('');
    
    setError('');
  };
  
  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>{translate('Upload New Map')}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form.Group className="mb-3">
            <Form.Label>{translate('Map Name')}</Form.Label>
            <Form.Control
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              placeholder={translate('Enter map name')}
              required
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>{translate('Map Description')}</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={mapDescription}
              onChange={(e) => setMapDescription(e.target.value)}
              placeholder={translate('Enter description (optional)')}
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>{translate('Select Map Type')}</Form.Label>
            <Form.Select
              value={mapType}
              onChange={(e) => setMapType(e.target.value)}
            >
              <option value="overlay">{translate('Overlay')}</option>
              <option value="implantation">{translate('Main Plan')}</option>
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>{translate('Upload PDF Map')}</Form.Label>
            <Form.Control
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept="application/pdf"
              required
            />
            <Form.Text className="text-muted">
              {translate('Select a PDF file. Only PDF format is accepted.')}
            </Form.Text>
          </Form.Group>
          
          {mapFile && (
            <div className="text-center mt-3 mb-3">
              <Alert variant="info">
                <i className="bi bi-file-earmark-pdf"></i> {mapFile.name} ({Math.round(mapFile.size / 1024)} KB)
              </Alert>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            {translate('Cancel')}
          </Button>
          <Button 
            variant="primary" 
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-1" />
                {translate('Uploading...')}
              </>
            ) : (
              translate('Upload Map')
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AddMapModal; 