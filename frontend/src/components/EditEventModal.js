import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Image, Alert, ListGroup, Badge } from 'react-bootstrap';
import { updateEvent } from '../services/eventService';
import MentionInput from './MentionInput';
import axios from 'axios';
import { projectService } from '../services/api';
import { API_URL } from '../config';
import apiClient from '../services/api';
import translate from '../utils/translate';

const EditEventModal = ({ show, onHide, event, onEventUpdated, userRole = "MEMBER", projectId }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('periodic check');
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canCloseEvent, setCanCloseEvent] = useState(false);
  
  // For tag suggestions
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [allProjectTags, setAllProjectTags] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  
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
    
    console.log('Matching tags in EditModal:', matchingTags, 'All tags:', allProjectTags);
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
  
  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setType(event.state || 'periodic check');
      setStatus(event.status || 'open');
      setSelectedTags(event.tags || []);
      setError('');
    }
  }, [event]);
  
  useEffect(() => {
    // Determine if user can close events based on admin status
    let isAdmin = false;
    
    // First check if we have a user object in localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.is_admin === true) {
          isAdmin = true;
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    } 
    // Next check userRole prop
    else if (userRole) {
      isAdmin = userRole === 'ADMIN';
    }
    
    setCanCloseEvent(isAdmin);
  }, [userRole]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Check if a non-admin is trying to close an event
    if (status === 'closed' && !canCloseEvent && event.status !== 'closed') {
      setError(translate('Only ADMIN users can close events.'));
      setStatus(event.status); // Revert to original status
      setLoading(false);
      return;
    }
    
    try {
      const updatedEvent = await updateEvent(event.id, {
        title,
        description,
        state: type,
        status,
        tags: selectedTags
      });
      
      onEventUpdated(updatedEvent);
      onHide();
    } catch (err) {
      console.error('Error updating event:', err);
      
      // Check for permission denied error
      if (err.response && err.response.status === 403) {
        setError(translate('Permission denied: Only ADMIN users can close events.'));
        setStatus(event.status); // Revert to original status
      } else {
        setError(translate('Failed to update event. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };
  
  if (!event) return null;
  
  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      dialogClassName="event-modal-dialog"
      backdropClassName="event-modal-backdrop"
      contentClassName="modal-content"
      centered
    >
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>{translate('Edit Event')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          <Row>
            <Col md={event.image_url ? 8 : 12}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Title')}</Form.Label>
                <Form.Control
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  id="edit-event-description"
                />
              </Form.Group>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{translate('Status')}</Form.Label>
                    <Form.Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="open">{translate('Open')}</option>
                      <option value="in-progress">{translate('In Progress')}</option>
                      <option value="resolved">{translate('Resolved')}</option>
                      <option value="closed" disabled={!canCloseEvent}>{translate('Closed')} {!canCloseEvent && translate('(Admin Only)')}</option>
                    </Form.Select>
                    {!canCloseEvent && (
                      <Form.Text className="text-muted">
                        {translate('Only ADMIN users can close events')}
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{translate('Type')}</Form.Label>
                    <Form.Select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="periodic check">{translate('Periodic Check')}</option>
                      <option value="incidence">{translate('Incidence')}</option>
                    </Form.Select>
                    <Form.Text className="text-muted">
                      {translate('Type defines the purpose and appearance of the event marker')}
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>
              
              <Form.Group className="mb-3">
                <Form.Label>{translate('Tags')}</Form.Label>
                <div className="selected-tags mb-2">
                  {selectedTags.map(tag => (
                    <Badge 
                      key={tag} 
                      bg="info" 
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
                    placeholder={translate('Add tags (press Enter or comma to add)')}
                    autoComplete="off"
                  />
                  {showTagSuggestions && (
                    <ListGroup style={{ 
                      position: 'absolute', 
                      width: '100%', 
                      zIndex: 1000,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                      border: '1px solid #ced4da',
                      marginTop: '2px',
                      backgroundColor: '#fff'
                    }}>
                      {tagSuggestions.length > 0 ? (
                        tagSuggestions.map(tag => (
                          <ListGroup.Item 
                            key={tag} 
                            action 
                            onClick={() => addTag(tag)}
                            className="py-2 suggestion-item"
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="suggestion-text">{tag}</span>
                          </ListGroup.Item>
                        ))
                      ) : (
                        <ListGroup.Item className="py-2 text-muted">
                          {translate('No matching tags found')}
                        </ListGroup.Item>
                      )}
                    </ListGroup>
                  )}
                </div>
                <Form.Text className="text-muted">
                  {translate('Type to see suggestions from existing tags or create your own')}
                </Form.Text>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>{translate('Created By')}</Form.Label>
                <Form.Control
                  type="text"
                  value={event.created_by_user_name || `${translate('User ID')}: ${event.created_by_user_id}`}
                  disabled
                />
              </Form.Group>
            </Col>
            
            {event.image_url && (
              <Col md={4}>
                <div className="event-image-container">
                  <h6 className="mb-2">{translate('Attached Image')}</h6>
                  <p className="text-muted small">{translate('Images cannot be changed after creation')}</p>
                  <Image 
                    src={event.image_url} 
                    alt={event.title} 
                    thumbnail 
                    className="w-100" 
                  />
                </div>
              </Col>
            )}
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            {translate('Cancel')}
          </Button>
          <Button 
            variant="primary" 
            type="submit"
            disabled={loading}
          >
            {loading ? translate('Saving...') : translate('Save Changes')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default EditEventModal; 