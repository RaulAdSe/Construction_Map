import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Image, Alert } from 'react-bootstrap';
import { updateEvent } from '../services/eventService';
import MentionInput from './MentionInput';

const EditEventModal = ({ show, onHide, event, onEventUpdated, userRole = "MEMBER", projectId }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('periodic check');
  const [status, setStatus] = useState('open');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canCloseEvent, setCanCloseEvent] = useState(false);
  
  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setType(event.state || 'periodic check');
      setStatus(event.status || 'open');
      setTags(event.tags ? event.tags.join(', ') : '');
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
      setError('Only ADMIN users can close events.');
      setStatus(event.status); // Revert to original status
      setLoading(false);
      return;
    }
    
    try {
      const tagsArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      const updatedEvent = await updateEvent(event.id, {
        title,
        description,
        state: type,
        status,
        tags: tagsArray
      });
      
      onEventUpdated(updatedEvent);
      onHide();
    } catch (err) {
      console.error('Error updating event:', err);
      
      // Check for permission denied error
      if (err.response && err.response.status === 403) {
        setError('Permission denied: Only ADMIN users can close events.');
        setStatus(event.status); // Revert to original status
      } else {
        setError('Failed to update event. Please try again.');
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
          <Modal.Title>Edit Event</Modal.Title>
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
                <Form.Label>Title</Form.Label>
                <Form.Control
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  id="edit-event-description"
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
                      <option value="closed" disabled={!canCloseEvent}>Closed {!canCloseEvent && '(Admin Only)'}</option>
                    </Form.Select>
                    {!canCloseEvent && (
                      <Form.Text className="text-muted">
                        Only ADMIN users can close events
                      </Form.Text>
                    )}
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
                <Form.Label>Created By</Form.Label>
                <Form.Control
                  type="text"
                  value={event.created_by_user_name || `User ID: ${event.created_by_user_id}`}
                  disabled
                />
              </Form.Group>
            </Col>
            
            {event.image_url && (
              <Col md={4}>
                <div className="event-image-container">
                  <h6 className="mb-2">Attached Image</h6>
                  <p className="text-muted small">Images cannot be changed after creation</p>
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
            Cancel
          </Button>
          <Button 
            variant="primary" 
            type="submit"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default EditEventModal; 