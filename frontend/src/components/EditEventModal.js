import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Image, Alert, ListGroup, Badge } from 'react-bootstrap';
import { updateEvent } from '../services/eventService';
import MentionInput from './MentionInput';
import axios from 'axios';
import { projectService } from '../services/api';
import { API_URL } from '../config';
import apiClient from '../services/api';
import translate, { useLanguage } from '../utils/translate';
import { AiOutlinePlus } from 'react-icons/ai';
import { BsX } from 'react-icons/bs';
import '../assets/styles/AddEventModal.css';

// Helper function to ensure image URLs use HTTPS
const ensureHttpsUrl = (url) => {
  if (!url) return url;
  
  // If it's already a full URL, just ensure it uses HTTPS
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url.replace(/^http:\/\//i, 'https://');
  }
  
  // Clean url by removing any extra spaces that might cause problems
  url = url.trim();
  
  // Handle Cloud Storage URLs directly
  if (url.includes('storage.googleapis.com')) {
    // Ensure we have a full URL with HTTPS
    if (!url.startsWith('https://')) {
      return `https://storage.googleapis.com/${url.split('storage.googleapis.com/').pop()}`;
    }
    return url;
  }
  
  // Check if it's a Cloud Storage URL without the full prefix
  if (url.includes('construction-map-storage-deep-responder-444017-h2')) {
    return `https://storage.googleapis.com/${url}`;
  }
  
  // Migration code for existing events - redirect to Cloud Storage
  // If it's a relative URL (from local backend storage), migrate it to Cloud Storage
  if (url.startsWith('/events/')) {
    const filename = url.split('/').pop(); // Get just the filename
    return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/events/${filename}`;
  }
  
  // If it's a relative URL starting with /uploads/
  if (url.startsWith('/uploads/')) {
    // Try to extract the object type and redirect to appropriate Cloud Storage path
    if (url.includes('/uploads/events/')) {
      const filename = url.split('/').pop();
      return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/events/${filename}`;
    } else {
      // General /uploads/ URL, try to determine the type based on filename pattern
      const filename = url.split('/').pop();
      if (filename.startsWith('img_') || filename.startsWith('pdf_')) {
        // This looks like an event attachment
        return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/events/${filename}`;
      }
      // Fall back to backend URL for other types
      return `https://construction-map-backend-ypzdt6srya-uc.a.run.app${url}`;
    }
  }
  
  // If it's a relative path that includes 'events/' (like when stored directly from API)
  if (url.includes('events/')) {
    // Extract the filename only if it includes a path
    const filename = url.split('/').pop();
    return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/events/${filename}`;
  }
  
  // For any other relative URL, assume it's a direct filename in the events folder
  return `https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/events/${url}`;
};

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
    
    const isIncidence = type === 'incidence';
    const isMember = !canCloseEvent; // using canCloseEvent as proxy for admin status
    
    // Check if a non-admin is trying to close an event
    if (status === 'closed' && isMember && event.status !== 'closed') {
      setError(translate('Only ADMIN users can close events.'));
      setStatus(event.status); // Revert to original status
      setLoading(false);
      return;
    }
    
    // For members, enforce allowed transitions for incidence events
    if (isMember && isIncidence) {
      // Only these transitions are allowed for members:
      // - open → in-progress
      // - in-progress → resolved
      // - resolved → in-progress
      const validTransition = 
        (event.status === 'open' && status === 'in-progress') ||
        (event.status === 'in-progress' && status === 'resolved') ||
        (event.status === 'resolved' && status === 'in-progress') ||
        (status === event.status); // No change is always valid
        
      if (!validTransition) {
        setError(translate('Invalid status transition. Please use the dropdown to select a valid status.'));
        setStatus(event.status); // Revert to original status
        setLoading(false);
        return;
      }
    }
    
    // For non-incidence events, members can't change status at all
    if (isMember && !isIncidence && status !== event.status) {
      setError(translate('Members cannot change status for non-incidence events.'));
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
  
  const renderStatusOptions = () => {
    const isIncidence = type === 'incidence';
    
    // Admin users get full control
    if (canCloseEvent) {
      return (
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
      );
    }
    
    // For members with incidence events, show simplified transitions
    if (isIncidence) {
      return (
        <Form.Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {status === 'open' && (
            <>
              <option value="open">{translate('Open')}</option>
              <option value="in-progress">{translate('In Progress')}</option>
            </>
          )}
          {status === 'in-progress' && (
            <>
              <option value="in-progress">{translate('In Progress')}</option>
              <option value="resolved">{translate('Resolved')}</option>
            </>
          )}
          {status === 'resolved' && (
            <>
              <option value="resolved">{translate('Resolved')}</option>
              <option value="in-progress">{translate('In Progress')}</option>
            </>
          )}
          {status === 'closed' && (
            <option value="closed">{translate('Closed')}</option>
          )}
        </Form.Select>
      );
    }
    
    // For members with non-incidence events, only show current status
    return (
      <Form.Select
        value={status}
        disabled={true}
      >
        <option value={status}>{translate(status.charAt(0).toUpperCase() + status.slice(1))}</option>
      </Form.Select>
    );
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
                    {renderStatusOptions()}
                    {!canCloseEvent && (
                      <Form.Text className="text-muted">
                        {translate('Only ADMIN users can close events')}
                      </Form.Text>
                    )}
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
                    src={ensureHttpsUrl(event.image_url)} 
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