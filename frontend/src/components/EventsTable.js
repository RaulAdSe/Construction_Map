import React, { useState } from 'react';
import { Table, Button, Badge, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { format } from 'date-fns';
import { updateEventStatus, updateEventState } from '../services/eventService';

const EventsTable = ({ events, onViewEvent, onEditEvent, onEventUpdated }) => {
  const [updatingEvent, setUpdatingEvent] = useState(null);

  if (!events || events.length === 0) {
    return (
      <div className="p-3 bg-light rounded text-center">
        <p>No events available for this project.</p>
      </div>
    );
  }

  // Group events by map
  const eventsByMap = {};
  events.forEach(event => {
    if (!eventsByMap[event.map_id]) {
      eventsByMap[event.map_id] = [];
    }
    eventsByMap[event.map_id].push(event);
  });

  // Get type badge
  const getTypeBadge = (state) => {
    switch (state) {
      case 'incidence':
        return <Badge bg="danger">Incidence</Badge>;
      case 'periodic check':
        return <Badge bg="info">Periodic Check</Badge>;
      default:
        return <Badge bg="secondary">{state || 'Unknown'}</Badge>;
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge bg="primary">Open</Badge>;
      case 'in-progress':
        return <Badge bg="info">In Progress</Badge>;
      case 'resolved':
        return <Badge bg="success">Resolved</Badge>;
      case 'closed':
        return <Badge bg="secondary">Closed</Badge>;
      default:
        return <Badge bg="secondary">{status || 'Unknown'}</Badge>;
    }
  };
  
  const handleStatusChange = async (eventId, newStatus) => {
    setUpdatingEvent(eventId);
    try {
      await updateEventStatus(eventId, newStatus);
      if (onEventUpdated) {
        const updatedEvent = events.find(e => e.id === eventId);
        onEventUpdated({...updatedEvent, status: newStatus});
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdatingEvent(null);
    }
  };
  
  const handleTypeChange = async (eventId, newType) => {
    setUpdatingEvent(eventId);
    try {
      await updateEventState(eventId, newType);
      if (onEventUpdated) {
        const updatedEvent = events.find(e => e.id === eventId);
        onEventUpdated({...updatedEvent, state: newType});
      }
    } catch (error) {
      console.error('Failed to update type:', error);
    } finally {
      setUpdatingEvent(null);
    }
  };

  return (
    <div className="events-table-container">
      {Object.keys(eventsByMap).map(mapId => (
        <div key={mapId} className="mb-4">
          <h5 className="mb-3">Map: {events.find(e => e.map_id === parseInt(mapId))?.map_name || `ID: ${mapId}`}</h5>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Description</th>
                <th>Status</th>
                <th>Type</th>
                <th>Created By</th>
                <th>Created At</th>
                <th>Comments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {eventsByMap[mapId].map(event => (
                <tr key={event.id}>
                  <td>{event.id}</td>
                  <td>{event.title}</td>
                  <td>
                    {event.description 
                      ? event.description.length > 50 
                        ? `${event.description.substring(0, 50)}...`
                        : event.description
                      : "-"}
                  </td>
                  <td>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>Click to change status</Tooltip>}
                    >
                      <div>
                        <Form.Select 
                          size="sm"
                          value={event.status || 'open'}
                          onChange={(e) => handleStatusChange(event.id, e.target.value)}
                          disabled={updatingEvent === event.id}
                          style={{ marginBottom: '4px' }}
                        >
                          <option value="open">Open</option>
                          <option value="in-progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </Form.Select>
                        {getStatusBadge(event.status)}
                      </div>
                    </OverlayTrigger>
                  </td>
                  <td>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>Click to change type</Tooltip>}
                    >
                      <div>
                        <Form.Select 
                          size="sm"
                          value={event.state || 'periodic check'}
                          onChange={(e) => handleTypeChange(event.id, e.target.value)}
                          disabled={updatingEvent === event.id}
                          style={{ marginBottom: '4px' }}
                        >
                          <option value="periodic check">Periodic Check</option>
                          <option value="incidence">Incidence</option>
                        </Form.Select>
                        {getTypeBadge(event.state)}
                      </div>
                    </OverlayTrigger>
                  </td>
                  <td>{event.created_by_user_name || `User ID: ${event.created_by_user_id}`}</td>
                  <td>{format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}</td>
                  <td>
                    {event.comment_count > 0 ? (
                      <Badge bg="info" pill>
                        {event.comment_count}
                      </Badge>
                    ) : '-'}
                  </td>
                  <td>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="me-1"
                      onClick={() => onViewEvent(event)}
                    >
                      View
                    </Button>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => onEditEvent(event)}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ))}
    </div>
  );
};

export default EventsTable; 