import React, { useState, useEffect } from 'react';
import { OverlayTrigger, Tooltip, Badge } from 'react-bootstrap';

// Define type colors
const typeColors = {
  'incidence': '#FF3333',
  'periodic check': '#3399FF'
};

// Map of user IDs to different colors for consistency
const userColors = {};
const predefinedColors = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#F5FF33', 
  '#33FFF5', '#FF3333', '#33FF33', '#3333FF', '#FF33BB'
];

const getColorForUser = (userId) => {
  if (!userColors[userId]) {
    // Assign a color from the predefined list or generate one
    const colorIndex = Object.keys(userColors).length % predefinedColors.length;
    userColors[userId] = predefinedColors[colorIndex];
  }
  return userColors[userId];
};

const EventMarker = ({ event, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  useEffect(() => {
    // Log when a marker is rendered
    console.log(`Event marker rendered: ${event.id} at x:${event.x_coordinate}%, y:${event.y_coordinate}%`);
  }, [event]);
  
  if (!event || !event.x_coordinate || !event.y_coordinate) {
    console.warn("Invalid event data for marker:", event);
    return null;
  }
  
  // Use type color or default to user color as fallback
  const color = event.state && typeColors[event.state] 
    ? typeColors[event.state] 
    : getColorForUser(event.created_by_user_id);
  
  const markerStyle = {
    position: 'absolute',
    left: `${event.x_coordinate}%`,
    top: `${event.y_coordinate}%`,
    width: isHovered ? '24px' : '20px', // Increased size
    height: isHovered ? '24px' : '20px', // Increased size
    backgroundColor: color,
    border: '3px solid white', // Thicker border
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    boxShadow: isHovered 
      ? `0 0 10px ${color}, 0 0 15px rgba(0, 0, 0, 0.5)` 
      : '0 0 6px rgba(0, 0, 0, 0.5)', // Enhanced shadow
    cursor: 'pointer',
    zIndex: 800, // Same z-index as other event markers
    transition: 'all 0.2s ease',
    pointerEvents: 'auto'
  };

  // Get type badge
  const getTypeBadge = () => {
    switch (event.state) {
      case 'incidence':
        return <Badge bg="danger">Incidence</Badge>;
      case 'periodic check':
        return <Badge bg="info">Periodic Check</Badge>;
      default:
        return <Badge bg="secondary">{event.state || 'Unknown'}</Badge>;
    }
  };

  const tooltip = (
    <Tooltip id={`tooltip-${event.id}`} className="event-tooltip">
      <div>
        <strong>{event.title}</strong>
      </div>
      <div>Created by: {event.created_by_user_name || `User ${event.created_by_user_id}`}</div>
      <div>{getTypeBadge()}</div>
      <div className="small text-muted">Click for details</div>
    </Tooltip>
  );
  
  return (
    <OverlayTrigger
      placement="top"
      overlay={tooltip}
      delay={{ show: 200, hide: 100 }}
    >
      <div 
        className="event-marker"
        style={markerStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        data-event-id={event.id}
      />
    </OverlayTrigger>
  );
};

export default EventMarker; 