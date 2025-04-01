import React, { useState, useEffect } from 'react';
import { OverlayTrigger, Tooltip, Badge } from 'react-bootstrap';

// Define type colors
const typeColors = {
  'periodic check': '#3399FF'
};

// Define status colors for incidence type
const incidenceStatusColors = {
  'open': '#FF0000',      // Bright Red
  'in-progress': '#FFCC00', // Yellow
  'resolved': '#00CC00',  // Green
  'closed': '#6C757D'     // Gray
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

// Helper function to adjust color brightness
const adjustBrightness = (hex, factor) => {
  // Convert hex to RGB
  let r = parseInt(hex.substring(1, 3), 16);
  let g = parseInt(hex.substring(3, 5), 16);
  let b = parseInt(hex.substring(5, 7), 16);
  
  // Adjust brightness
  r = Math.floor(r * factor);
  g = Math.floor(g * factor);
  b = Math.floor(b * factor);
  
  // Ensure values are in valid range
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const EventMarker = ({ event, onClick, scale = 1 }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  if (!event || !event.x_coordinate || !event.y_coordinate) {
    console.warn("Invalid event data for marker:", event);
    return null;
  }
  
  // Get the color based on event type and status
  let color;
  
  if (event.state === 'incidence') {
    // For incidence events, use the specific status color
    color = incidenceStatusColors[event.status] || incidenceStatusColors['open'];
  } else {
    // For periodic check or other types, use the type color
    color = typeColors[event.state] || getColorForUser(event.created_by_user_id);
    
    // For non-incidence events, we can still dim closed ones
    if (event.status === 'closed') {
      color = adjustBrightness(color, 0.6);
    }
  }
  
  // Use CSS classes for core styles and only use inline styles for positioning and color
  const markerStyle = {
    left: `${event.x_coordinate}%`,
    top: `${event.y_coordinate}%`,
    backgroundColor: color,
    boxShadow: isHovered 
      ? `0 0 10px ${color}, 0 0 15px rgba(0, 0, 0, 0.5)` 
      : `0 0 6px ${color}, 0 0 10px rgba(0, 0, 0, 0.4)`
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
  
  // Get status badge
  const getStatusBadge = () => {
    switch (event.status) {
      case 'open':
        return <Badge bg="danger">Open</Badge>;
      case 'in-progress':
        return <Badge bg="warning">In Progress</Badge>;
      case 'resolved':
        return <Badge bg="success">Resolved</Badge>;
      case 'closed':
        return <Badge bg="secondary">Closed</Badge>;
      default:
        return <Badge bg="secondary">{event.status || 'Unknown'}</Badge>;
    }
  };

  const tooltip = (
    <Tooltip id={`tooltip-${event.id}`} className="event-tooltip">
      <div>
        <strong>{event.title}</strong>
      </div>
      <div>Created by: {event.created_by_user_name || `User ${event.created_by_user_id}`}</div>
      <div>{getTypeBadge()} {getStatusBadge()}</div>
      <div className="small text-muted">Click for details</div>
    </Tooltip>
  );
  
  // Add data attributes for debugging if needed
  const dataAttributes = {
    'data-event-id': event.id,
    'data-x-position': event.x_coordinate,
    'data-y-position': event.y_coordinate
  };
  
  return (
    <OverlayTrigger
      placement="top"
      overlay={tooltip}
      delay={{ show: 200, hide: 100 }}
    >
      <div 
        className={`event-marker ${isHovered ? 'event-marker-hover' : ''}`}
        style={markerStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        {...dataAttributes}
      />
    </OverlayTrigger>
  );
};

export default EventMarker; 