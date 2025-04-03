import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Tabs, Tab, Row, Col, Spinner, Alert, Form } from 'react-bootstrap';
import { getEventById, updateEvent, addComment } from '../services/eventService';
import { formatDate } from '../utils/dateUtils';
import AddCommentForm from './AddCommentForm';
import CommentList from './CommentList';
import translate from '../utils/translate';
import EventHistory from './EventHistory';
import EventFiles from './EventFiles';
import { useMobile } from './common/MobileProvider';
import '../assets/styles/EventDetail.css';

const EventDetail = ({ eventId, onClose, onEventUpdated, projectId }) => {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [typeUpdating, setTypeUpdating] = useState(false);
  const { isMobile } = useMobile();
  
  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);
  
  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const eventData = await getEventById(eventId);
      setEvent(eventData);
      setError('');
    } catch (err) {
      console.error('Error fetching event details:', err);
      setError(translate('Failed to load event details. Please try again.'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleStatusChange = async (newStatus) => {
    try {
      setStatusUpdating(true);
      await updateEvent(eventId, { status: newStatus });
      setEvent(prev => ({ ...prev, status: newStatus }));
      if (onEventUpdated) onEventUpdated();
    } catch (err) {
      console.error('Error updating event status:', err);
      setError(translate('Failed to update status. Please try again.'));
    } finally {
      setStatusUpdating(false);
    }
  };
  
  const handleTypeChange = async (newType) => {
    try {
      setTypeUpdating(true);
      await updateEvent(eventId, { state: newType });
      setEvent(prev => ({ ...prev, state: newType }));
      if (onEventUpdated) onEventUpdated();
    } catch (err) {
      console.error('Error updating event type:', err);
      setError(translate('Failed to update type. Please try again.'));
    } finally {
      setTypeUpdating(false);
    }
  };
  
  const handleCommentAdded = (newComment) => {
    setEvent(prev => {
      const updatedComments = [...(prev.comments || []), newComment];
      return { ...prev, comments: updatedComments };
    });
    
    if (onEventUpdated) onEventUpdated();
  };
  
  const renderEventStatus = () => {
    const statusMap = {
      'open': { label: translate('Open'), variant: 'primary' },
      'in-progress': { label: translate('In Progress'), variant: 'warning' },
      'resolved': { label: translate('Resolved'), variant: 'success' },
      'closed': { label: translate('Closed'), variant: 'secondary' }
    };
    
    const { label, variant } = statusMap[event.status] || statusMap.open;
    
    return (
      <Badge bg={variant} className="status-badge">
        {label}
      </Badge>
    );
  };
  
  const getEventTypeLabel = (type) => {
    const typeMap = {
      'periodic check': translate('Periodic Check'),
      'incidence': translate('Incidence'),
      'request': translate('Request')
    };
    
    return typeMap[type] || type;
  };
  
  const renderEventImage = () => {
    if (!event.image_url) return null;
    
    return (
      <div className={`event-image-container ${isMobile ? 'mb-3' : 'mb-4'}`}>
        <img 
          src={event.image_url} 
          alt={event.title} 
          className="event-detail-image" 
          onClick={() => window.open(event.image_url, '_blank')}
        />
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" />
        <p className="mt-3">{translate('Loading event details...')}</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <Alert variant="danger" className="m-3">
        <Alert.Heading>{translate('Error')}</Alert.Heading>
        <p>{error}</p>
        <div className="d-flex justify-content-end">
          <Button onClick={onClose} variant="outline-danger">
            {translate('Close')}
          </Button>
        </div>
      </Alert>
    );
  }
  
  if (!event) {
    return (
      <Alert variant="warning" className="m-3">
        <Alert.Heading>{translate('Event Not Found')}</Alert.Heading>
        <p>{translate('The requested event could not be found.')}</p>
        <div className="d-flex justify-content-end">
          <Button onClick={onClose} variant="outline-warning">
            {translate('Close')}
          </Button>
        </div>
      </Alert>
    );
  }
  
  return (
    <div className={`event-detail-container ${isMobile ? 'mobile-event-detail' : ''}`}>
      <Card className="event-detail-card">
        <Card.Header className={`d-flex justify-content-between align-items-center ${isMobile ? 'flex-column align-items-start' : ''}`}>
          <div className={`event-header-title ${isMobile ? 'mb-2 w-100' : ''}`}>
            <h5 className="mb-0">{event.title}</h5>
          </div>
          <div className={`event-header-actions ${isMobile ? 'w-100 d-flex justify-content-between' : ''}`}>
            {renderEventStatus()}
            <Button 
              variant="outline-secondary" 
              size={isMobile ? "sm" : ""}
              onClick={onClose} 
              className="ms-2"
            >
              {translate('Close')}
            </Button>
          </div>
        </Card.Header>
        
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="event-tabs"
          fill={isMobile}
        >
          <Tab eventKey="details" title={translate('Details')}>
            <Card.Body className={isMobile ? 'p-2' : ''}>
              {renderEventImage()}
              
              <Row className="mb-3">
                <Col xs={12} md={6} className={isMobile ? 'mb-2' : ''}>
                  <Form.Group>
                    <Form.Label className="fw-bold">{translate('Status')}</Form.Label>
                    <Form.Select
                      value={event.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={statusUpdating}
                      className={isMobile ? 'form-select-sm' : ''}
                    >
                      <option value="open">{translate('Open')}</option>
                      {event.state !== 'periodic check' && event.state !== 'request' && (
                        <>
                          <option value="in-progress">{translate('In Progress')}</option>
                          <option value="resolved">{translate('Resolved')}</option>
                        </>
                      )}
                      <option value="closed">{translate('Closed')}</option>
                    </Form.Select>
                    {statusUpdating && <Spinner animation="border" size="sm" className="ms-2" />}
                  </Form.Group>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Group>
                    <Form.Label className="fw-bold">{translate('Type')}</Form.Label>
                    <Form.Select
                      value={event.state}
                      onChange={(e) => handleTypeChange(e.target.value)}
                      disabled={typeUpdating}
                      className={isMobile ? 'form-select-sm' : ''}
                    >
                      <option value="periodic check">{translate('Periodic Check')}</option>
                      <option value="incidence">{translate('Incidence')}</option>
                      <option value="request">{translate('Request')}</option>
                    </Form.Select>
                    {typeUpdating && <Spinner animation="border" size="sm" className="ms-2" />}
                  </Form.Group>
                </Col>
              </Row>
              
              <div className={`event-description ${isMobile ? 'mb-3' : 'mb-4'}`}>
                <h6 className="fw-bold">{translate('Description')}</h6>
                <p className={`description-text ${isMobile ? 'small' : ''}`}>
                  {event.description || translate('No description provided.')}
                </p>
              </div>
              
              {event.tags && event.tags.length > 0 && (
                <div className={`event-tags ${isMobile ? 'mb-3' : 'mb-4'}`}>
                  <h6 className="fw-bold">{translate('Tags')}</h6>
                  <div>
                    {event.tags.map(tag => (
                      <Badge 
                        key={tag} 
                        bg="info" 
                        className={`me-1 mb-1 tag-badge ${isMobile ? 'mobile-tag' : ''}`}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className={`event-meta ${isMobile ? 'small' : ''}`}>
                <p className="mb-1">
                  <strong>{translate('Created')}:</strong> {formatDate(event.created_at)}
                  {event.created_by && ` ${translate('by')} ${event.created_by}`}
                </p>
                <p className="mb-1">
                  <strong>{translate('Last Updated')}:</strong> {formatDate(event.updated_at)}
                </p>
                <p className="mb-0">
                  <strong>{translate('Location')}:</strong> Map: {event.map_name || 'Unknown'}, 
                  X: {parseFloat(event.x_coordinate).toFixed(2)}%, 
                  Y: {parseFloat(event.y_coordinate).toFixed(2)}%
                </p>
              </div>
            </Card.Body>
          </Tab>
          <Tab eventKey="comments" title={translate('Comments')}>
            <Card.Body className={isMobile ? 'p-2' : ''}>
              <CommentList 
                comments={event.comments || []} 
                isMobile={isMobile} 
              />
              <hr className={isMobile ? 'my-2' : 'my-3'} />
              <AddCommentForm 
                eventId={eventId} 
                onCommentAdded={handleCommentAdded} 
                isMobile={isMobile}
                projectId={projectId}
              />
            </Card.Body>
          </Tab>
          <Tab eventKey="history" title={translate('History')}>
            <Card.Body className={isMobile ? 'p-2' : ''}>
              <EventHistory 
                eventId={eventId} 
                isMobile={isMobile} 
              />
            </Card.Body>
          </Tab>
          <Tab eventKey="files" title={translate('Files')}>
            <Card.Body className={isMobile ? 'p-2' : ''}>
              <EventFiles 
                eventId={eventId} 
                isMobile={isMobile} 
              />
            </Card.Body>
          </Tab>
        </Tabs>
      </Card>
    </div>
  );
};

export default EventDetail; 