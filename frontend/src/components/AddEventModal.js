import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Row, Col, Spinner, ListGroup, Badge } from 'react-bootstrap';
import { addEvent } from '../services/eventService';
import MentionInput from './MentionInput';
import axios from 'axios';

const AddEventModal = ({ show, onHide, mapId, position, onEventAdded, projectId, allMaps = [], visibleMaps = {} }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('periodic check');
  const [status, setStatus] = useState('open');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  
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
  
  const fetchProjectTags = async () => {
    try {
      const response = await axios.get(`http://localhost:8000/api/v1/projects/${projectId}/tags`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data && Array.isArray(response.data)) {
        setAllProjectTags(response.data);
      }
    } catch (error) {
      console.error('Error fetching project tags:', error);
    }
  };
  
  // Handle tag input change
  const handleTagInputChange = (e) => {
    const input = e.target.value;
    setTagInput(input);
    
    if (input.trim() === '') {
      setShowTagSuggestions(false);
      return;
    }
    
    // Filter tags that match the current input
    const matchingTags = allProjectTags
      .filter(tag => tag.toLowerCase().includes(input.toLowerCase()))
      .filter(tag => !selectedTags.includes(tag))
      .slice(0, 3); // Limit to 3 suggestions
    
    setTagSuggestions(matchingTags);
    setShowTagSuggestions(matchingTags.length > 0);
  };
  
  // Add a tag from suggestions or from input
  const addTag = (tag = null) => {
    const tagToAdd = tag || tagInput.trim();
    
    if (tagToAdd && !selectedTags.includes(tagToAdd)) {
      setSelectedTags([...selectedTags, tagToAdd]);
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };
  
  // Remove a tag
  const removeTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };
  
  // Handle key press in tag input
  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };
  
  // Convert selected tags array to comma-separated string for the API
  useEffect(() => {
    setTags(selectedTags.join(','));
  }, [selectedTags]);

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
    
    // Use the active map configuration from the current map view
    // This automatically uses the current visible maps and their opacities from the MapViewer
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
      setError('Failed to add event. Please try again.');
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
    setSelectedTags([]);
    setTagInput('');
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
    <Modal 
      show={show} 
      onHide={handleClose}
      size="lg"
      dialogClassName="event-modal-dialog"
      backdropClassName="event-modal-backdrop"
      contentClassName="modal-content"
    >
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
            <MentionInput
              value={description}
              onChange={setDescription}
              placeholder="Enter event description (use @ to mention users)"
              rows={3}
              projectId={projectId}
              id="event-description"
            />
          </Form.Group>
          
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Type</Form.Label>
                <Form.Select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="periodic check">Periodic Check</option>
                  <option value="incidence">Incidence</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  Type defines the purpose and appearance of the event marker
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
          
          <Form.Group className="mb-3">
            <Form.Label>Tags</Form.Label>
            <div className="selected-tags mb-2">
              {selectedTags.map(tag => (
                <Badge 
                  key={tag} 
                  bg="primary" 
                  className="me-1 mb-1"
                  style={{ cursor: 'pointer' }}
                  onClick={() => removeTag(tag)}
                >
                  {tag} &times;
                </Badge>
              ))}
            </div>
            <div className="tag-input-container" style={{ position: 'relative' }}>
              <Form.Control
                type="text"
                value={tagInput}
                onChange={handleTagInputChange}
                onKeyPress={handleTagKeyPress}
                placeholder="Add tags (press Enter or comma to add)"
              />
              {showTagSuggestions && (
                <ListGroup style={{ 
                  position: 'absolute', 
                  width: '100%', 
                  zIndex: 10,
                  maxHeight: '150px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                }}>
                  {tagSuggestions.map(tag => (
                    <ListGroup.Item 
                      key={tag} 
                      action 
                      onClick={() => addTag(tag)}
                      className="py-2"
                    >
                      {tag}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </div>
            <Form.Text className="text-muted">
              Type to see suggestions from existing tags or create your own
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