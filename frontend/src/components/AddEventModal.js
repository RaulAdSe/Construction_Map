import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Row, Col, Spinner, ListGroup, Badge } from 'react-bootstrap';
import { addEvent } from '../services/eventService';
import MentionInput from './MentionInput';
import axios from 'axios';
import { projectService } from '../services/api';
import { API_URL } from '../config';
import apiClient from '../services/api';
import translate from '../utils/translate';
import { useMobile } from './common/MobileProvider';
import '../assets/styles/AddEventModal.css';

const AddEventModal = ({ show, onHide, mapId, position, onEventAdded, projectId, allMaps = [], visibleMaps = {}, fullscreen = false }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('periodic check');
  const [status, setStatus] = useState('open');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const { isMobile } = useMobile();
  
  // For tag suggestions
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [allProjectTags, setAllProjectTags] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  
  // Get the main map from allMaps
  const mainMap = allMaps.find(m => m.id === parseInt(mapId));
  
  // Fetch all existing tags for this project
  useEffect(() => {
    if (projectId) {
      fetchProjectTags();
    }
  }, [projectId]);
  
  // Fetch all existing tags for autocomplete
  const fetchProjectTags = async () => {
    try {
      const response = await apiClient.get(`${API_URL}/projects/${projectId}/tags`);
      if (response.data && Array.isArray(response.data)) {
        setAllProjectTags(response.data);
      }
    } catch (error) {
      console.error('Error fetching project tags:', error);
    }
  };
  
  const handleTagInputChange = (e) => {
    const value = e.target.value;
    setTagInput(value);
    
    if (value.trim()) {
      const filteredSuggestions = allProjectTags.filter(tag => 
        tag.toLowerCase().includes(value.toLowerCase())
      );
      setTagSuggestions(filteredSuggestions);
      setShowTagSuggestions(true);
    } else {
      setShowTagSuggestions(false);
    }
  };
  
  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput.trim());
    }
  };
  
  const addTag = (tag) => {
    // Normalize the tag: trim and to lowercase
    const normalizedTag = tag.trim().toLowerCase();
    
    // Only add if it's not already in the list
    if (!selectedTags.includes(normalizedTag)) {
      setSelectedTags([...selectedTags, normalizedTag]);
    }
    
    // Clear the input and hide suggestions
    setTagInput('');
    setShowTagSuggestions(false);
  };
  
  const removeTag = (tag) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setUploadFile(null);
      setFileType(null);
      setPreviewUrl('');
      return;
    }
    
    // Check if file type is supported
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!supportedTypes.includes(file.type)) {
      setError(translate('Unsupported file type. Please upload a JPG, PNG, or GIF image.'));
      return;
    }
    
    // Check if file size is under 5MB
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      setError(translate('File size exceeds 5MB limit.'));
      return;
    }
    
    setUploadFile(file);
    setFileType(file.type);
    setError(''); // Clear any previous errors
    
    // Generate preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title) {
      setError(translate('Please enter a title for the event'));
      return;
    }
    
    if (!mapId) {
      setError(translate('No map selected'));
      return;
    }
    
    setError('');
    setLoading(true);
    
    // Use the active map configuration from the current map view
    const activeMapSettings = visibleMaps;
    
    // Create FormData for multipart upload (if there's an image)
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('map_id', mapId);
    formData.append('title', title);
    formData.append('description', description || '');
    formData.append('status', status);
    formData.append('state', type);
    formData.append('x_coordinate', position.x);
    formData.append('y_coordinate', position.y);
    formData.append('active_maps', JSON.stringify(activeMapSettings));
    
    if (selectedTags.length > 0) {
      formData.append('tags', JSON.stringify(selectedTags));
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
      setError(translate('Failed to add event. Please try again.'));
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('periodic check');
    setStatus('open');
    setTags('');
    setError('');
    setUploadFile(null);
    setFileType(null);
    setPreviewUrl('');
    setSelectedTags([]);
    setTagInput('');
  };
  
  const handleClose = () => {
    resetForm();
    onHide();
  };
  
  // Calculate pixel coordinates for debugging
  const mapSizeInfo = () => {
    if (!mainMap) return null;
    
    return (
      <div className="mt-2 bg-light p-2 rounded">
        <h6 className="mb-1">{translate('Event Position')}</h6>
        <p className="mb-0 small">
          {translate('Map')}: {mainMap.name}<br />
          X: {position?.x.toFixed(2)}%, Y: {position?.y.toFixed(2)}%
        </p>
      </div>
    );
  };
  
  const isFullscreen = fullscreen || isMobile;
  
  return (
    <Modal
      show={show}
      onHide={handleClose}
      fullscreen={fullscreen}
      centered={!fullscreen}
      className="add-event-modal"
      size={fullscreen ? undefined : "lg"}
    >
      <Modal.Header closeButton>
        <Modal.Title>{translate('Add Event')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}
        
        {/* Add map information display for reference */}
        <div className="map-coordinates-info mb-3 small text-muted">
          {translate('Map')}: {mainMap?.name}
          {position && (
            <> | {translate('Position')}: X: {position.x.toFixed(2)}, Y: {position.y.toFixed(2)}</>
          )}
          {mainMap && (
            <> | {translate('Map Size')}: {mapSizeInfo()}</>
          )}
        </div>
        
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>{translate('Title')} *</Form.Label>
            <Form.Control 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              placeholder={translate('Enter a title for the event')}
              required
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>{translate('Description')}</Form.Label>
            <Form.Control 
              as="textarea" 
              rows={3} 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder={translate('Enter a description (optional)')}
            />
          </Form.Group>
          
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Type')}</Form.Label>
                <Form.Select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="periodic check">{translate('Periodic Check')}</option>
                  <option value="issue">{translate('Issue')}</option>
                  <option value="maintenance">{translate('Maintenance')}</option>
                  <option value="installation">{translate('Installation')}</option>
                  <option value="other">{translate('Other')}</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Status')}</Form.Label>
                <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="open">{translate('Open')}</option>
                  <option value="in_progress">{translate('In Progress')}</option>
                  <option value="resolved">{translate('Resolved')}</option>
                  <option value="closed">{translate('Closed')}</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          
          {/* Tag input with suggestions */}
          <Form.Group className="mb-3 tag-input-container">
            <Form.Label>{translate('Tags')}</Form.Label>
            <div className="d-flex">
              <Form.Control 
                type="text" 
                value={tagInput} 
                onChange={handleTagInputChange}
                onKeyPress={handleTagKeyPress}
                placeholder={translate('Enter tags and press Enter')}
              />
              <Button 
                variant="outline-secondary" 
                onClick={() => addTag(tagInput)}
                disabled={!tagInput.trim()}
                className="ms-2"
              >
                {translate('Add')}
              </Button>
            </div>
            
            {showTagSuggestions && tagSuggestions.length > 0 && (
              <ListGroup className="tag-suggestions">
                {tagSuggestions.map((tag, index) => (
                  <ListGroup.Item 
                    key={index} 
                    action 
                    onClick={() => addTag(tag)}
                    className="tag-suggestion-item"
                  >
                    {tag}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Form.Group>
          
          <div className="selected-tags-container mb-3">
            {selectedTags.map((tag, index) => (
              <Badge 
                key={index} 
                bg="secondary" 
                className="me-1 mb-1 tag-badge"
                style={{ cursor: 'pointer' }}
                onClick={() => removeTag(tag)}
              >
                {tag} <i className="bi bi-x-circle"></i>
              </Badge>
            ))}
          </div>
          
          <Form.Group className="mb-3">
            <Form.Label>{translate('Attachment')} ({translate('optional')})</Form.Label>
            <Form.Control 
              type="file" 
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/gif" 
            />
            <Form.Text className="text-muted">
              {translate('Maximum size: 5MB. Supported formats: JPG, PNG, GIF')}
            </Form.Text>
          </Form.Group>
          
          {previewUrl && (
            <div className="text-center">
              <img src={previewUrl} alt="Preview" className="image-preview" />
            </div>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          {translate('Cancel')}
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSubmit}
          disabled={loading || !title}
        >
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              {translate('Saving...')}
            </>
          ) : (
            translate('Save Event')
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddEventModal; 