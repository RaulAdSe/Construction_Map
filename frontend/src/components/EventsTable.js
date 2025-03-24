import React from 'react';
import { Table, Button, Badge } from 'react-bootstrap';
import { format } from 'date-fns';

const EventsTable = ({ events, onViewEvent, onEditEvent }) => {
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
                <th>Created By</th>
                <th>Created At</th>
                <th>Tags</th>
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
                  <td>{event.created_by_user_name || `User ID: ${event.created_by_user_id}`}</td>
                  <td>{format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}</td>
                  <td>
                    {event.tags && event.tags.map(tag => (
                      <Badge key={tag} bg="info" className="me-1">{tag}</Badge>
                    ))}
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