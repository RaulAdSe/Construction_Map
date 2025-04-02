import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Row, Col, Spinner, ListGroup, Badge } from 'react-bootstrap';
import { addEvent } from '../services/eventService';
import MentionInput from './MentionInput';
import axios from 'axios';
import { projectService } from '../services/api';
import { API_URL } from '../config';
import apiClient from '../services/api';
import translate from '../utils/translate';

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
      // Use projectService instead of apiClient
      const response = await projectService.getProjectTags(projectId);
      
      if (response.data && Array.isArray(response.data)) {
        console.log('Fetched tags:', response.data);
        setAllProjectTags(response.data);
      }
    } catch (error) {
      console.error('Error fetching project tags:', error);
      // Show a user-friendly message but don't block functionality
      setAllProjectTags([]);
    }
  };
  
  // Handle tag input change
  const handleTagInputChange = (e) => {
    const input = e.target.value;
    setTagInput(input);
    
    // Always show suggestion area if input has content
    if (input.trim() === '') {
      setShowTagSuggestions(false);
      return;
    }
    
    // Filter tags that match the current input
    const inputLower = input.toLowerCase();
    const matchingTags = allProjectTags
      .filter(tag => tag.toLowerCase().includes(inputLower))
      .filter(tag => !selectedTags.includes(tag))
      .slice(0, 5); // Limit to 5 suggestions
    
    console.log('Matching tags:', matchingTags, 'All tags:', allProjectTags);
    setTagSuggestions(matchingTags);
    setShowTagSuggestions(true); // Always show even if empty for feedback
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
        <Modal.Title>{translate('Add New Event')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>{translate('Event Title')}</Form.Label>
            <Form.Control
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={translate('Enter event title')}
              required
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>{translate('Description')}</Form.Label>
            <MentionInput
              value={description}
              onChange={setDescription}
              placeholder={translate('Enter event description (use @ to mention users)')}
              rows={3}
              projectId={projectId}
              id="event-description"
            />
          </Form.Group>
          
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Type')}</Form.Label>
                <Form.Select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="periodic check">{translate('Periodic Check')}</option>
                  <option value="incidence">{translate('Incidence')}</option>
                  <option value="request">{translate('Request')}</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  {translate('Type defines the purpose and appearance of the event marker')}
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Status')}</Form.Label>
                <Form.Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="open">{translate('Open')}</option>
                  {type !== 'periodic check' && type !== 'request' && (
                    <>
                      <option value="in-progress">{translate('In Progress')}</option>
                      <option value="resolved">{translate('Resolved')}</option>
                    </>
                  )}
                  <option value="closed">{translate('Closed')}</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          
          <Form.Group className="mb-3">
            <Form.Label>{translate('Tags')}</Form.Label>
            <div className="selected-tags mb-2">
              {selectedTags.map(tag => (
                <Badge 
                  key={tag} 
                  bg="primary" 
                  className="me-1 mb-1 tag-badge"
                  onClick={() => removeTag(tag)}
                >
                  {tag} <span className="ms-1">&times;</span>
                </Badge>
              ))}
            </div>
            <div className="tag-input-container">
              <Form.Control
                type="text"
                value={tagInput}
                onChange={handleTagInputChange}
                onKeyPress={handleTagKeyPress}
                placeholder={translate('Add tag...')}
                autoComplete="off"
              />
              {showTagSuggestions && (
                <div className="tag-suggestions">
                  {tagSuggestions.length > 0 ? (
                    <ListGroup>
                      {tagSuggestions.map(tag => (
                        <ListGroup.Item 
                          key={tag}
                          action
                          onClick={() => addTag(tag)}
                        >
                          {tag}
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  ) : (
                    <div className="no-suggestions">
                      {translate('Press Enter to add this new tag')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>{translate('Upload Image')}</Form.Label>
            <Form.Control
              type="file"
              onChange={handleFileChange}
            />
          </Form.Group>
          
          {error && <Alert variant="danger">{error}</Alert>}
          
          <div className="d-flex justify-content-end gap-2">
            <Button 
              variant="secondary" 
              onClick={handleClose}
            >
              {translate('Cancel')}
            </Button>
            <Button 
              variant="primary" 
              type="submit" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  {translate('Saving...')}
                </>
              ) : translate('Add')}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default AddEventModal; 