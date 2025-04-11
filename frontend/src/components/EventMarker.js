import React, { useState, useEffect } from 'react';
import { OverlayTrigger, Tooltip, Badge } from 'react-bootstrap';

// Define type colors
const typeColors = {
  'periodic check': '#3399FF',
  'request': '#9966CC'  // Purple
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

const EventMarker = ({ event, onClick, scale = 1, isMobile = false, disabled = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  
  if (!event || !event.x_coordinate || !event.y_coordinate) {
    console.warn("Invalid event data for marker:", event);
    return null;
  }
  
  // Handle click properly with explicit event data
  const handleClick = (e) => {
    if (disabled) return;
    
    // Ensure we have an event parameter to pass
    if (onClick) {
      e.stopPropagation(); // Stop propagation here to prevent map click
      onClick(event, e);
    }
  };
  
  // Get the color based on event type and status
  let color;
  
  // Use the current state and status values
  const currentState = event.state;
  const currentStatus = event.status;
  
  if (currentState === 'incidence') {
    // For incidence events, use the specific status color
    color = incidenceStatusColors[currentStatus] || incidenceStatusColors['open'];
  } else {
    // For periodic check or other types, use the type color
    color = typeColors[currentState] || getColorForUser(event.created_by_user_id);
    
    // For non-incidence events, we can still dim closed ones
    if (currentStatus === 'closed') {
      color = adjustBrightness(color, 0.6);
    }
  }
  
  // Mobile markers are larger and have thicker borders
  const markerSize = isMobile ? { width: '30px', height: '30px' } : {};
  const borderWidth = isMobile ? '4px' : '3px';
  
  // Use CSS classes for core styles and only use inline styles for positioning and color
  const markerStyle = {
    left: `${event.x_coordinate}%`,
    top: `${event.y_coordinate}%`,
    backgroundColor: color,
    borderWidth: borderWidth,
    ...markerSize,
    boxShadow: (isHovered || isTouched) 
      ? `0 0 10px ${color}, 0 0 15px rgba(0, 0, 0, 0.5)` 
      : `0 0 6px ${color}, 0 0 10px rgba(0, 0, 0, 0.4)`
  };

  // Get type badge
  const getTypeBadge = () => {
    // Get the most current type/state value
    const currentState = event.state;
    
    switch (currentState) {
      case 'incidence':
        return <Badge bg="danger">Incidence</Badge>;
      case 'periodic check':
        return <Badge bg="info">Periodic Check</Badge>;
      case 'request':
        return <Badge bg="purple">Request</Badge>;
      default:
        return <Badge bg="secondary">{currentState || 'Unknown'}</Badge>;
    }
  };
  
  // Get status badge
  const getStatusBadge = () => {
    // Get the most current status value
    const currentStatus = event.status;
    
    switch (currentStatus) {
      case 'open':
        return <Badge bg="danger">Open</Badge>;
      case 'in-progress':
        return <Badge bg="warning">In Progress</Badge>;
      case 'resolved':
        return <Badge bg="success">Resolved</Badge>;
      case 'closed':
        return <Badge bg="secondary">Closed</Badge>;
      default:
        return <Badge bg="secondary">{currentStatus || 'Unknown'}</Badge>;
    }
  };

  const tooltip = (
    <Tooltip id={`tooltip-${event.id}`} className="event-tooltip">
      <div>
        <strong>{event.title}</strong>
      </div>
      <div>Created by: {event.created_by_user_name || 'Unknown user'}</div>
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
  
  // For mobile, handle touch events differently
  const handleTouchStart = () => {
    setIsTouched(true);
    // Hide tooltip after a delay
    setTimeout(() => {
      if (isTouched) setIsTouched(false);
    }, 1500);
  };
  
  return (
    <OverlayTrigger
      placement="top"
      overlay={tooltip}
      delay={{ show: isMobile ? 50 : 200, hide: isMobile ? 50 : 100 }}
      trigger={isMobile ? ['click'] : ['hover', 'focus']}
    >
      <div 
        className={`event-marker ${isHovered || isTouched ? 'event-marker-hover' : ''} ${isMobile ? 'mobile-event-marker' : ''}`}
        style={markerStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        {...dataAttributes}
      />
    </OverlayTrigger>
  );
};

export default EventMarker; 