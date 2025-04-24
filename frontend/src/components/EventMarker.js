import React, { useState, useEffect } from 'react';
import { OverlayTrigger, Tooltip, Badge } from 'react-bootstrap';

// Define type colors
const typeColors = {
  'incidence': '#FF6D00', // Bright orange for incidence events
  'periodic check': '#3399FF', // Blue
  'check': '#3399FF', // Same blue for variations of check
  'request': '#9966CC'  // Purple
};

// Define status colors for incidence type (when using detailed status coloring)
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

const EventMarker = ({ 
  event, 
  onClick, 
  x, // Accept x coordinate directly
  y, // Accept y coordinate directly
  viewportScale = 1, // Accept viewport scale
  isMobile = false, 
  disabled = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  
  if (!event) {
    console.warn("Invalid event data for marker");
    return null;
  }
  
  // Use provided x,y coordinates or fall back to event properties
  const xCoord = x ?? event.x_coordinate ?? event.x_coord;
  const yCoord = y ?? event.y_coordinate ?? event.y_coord;
  
  if (!xCoord || !yCoord) {
    console.warn("Missing coordinates for event marker:", event.id);
    return null;
  }
  
  // Handle click properly with explicit event data
  const handleClick = () => {
    // Do nothing if marker is disabled
    if (disabled) return;
    
    // Call the onClick handler with just the event data
    // Avoid passing DOM event objects to prevent type errors
    if (onClick && typeof onClick === 'function') {
      onClick(event);
    }
  };
  
  // Helper functions for event type detection - consistent with filter logic
  const isIncidence = (event) => {
    if (!event || !event.state) return false;
    const state = (event.state || '').toLowerCase();
    return state === 'incidence' || state.includes('incidence');
  };
  
  const isCheck = (event) => {
    if (!event || !event.state) return false;
    const state = (event.state || '').toLowerCase();
    
    // Expanded matching to catch more variations - same as in MapEventTypeFilter
    const checkVariations = [
      'periodic check', 
      'check',
      'periodic',
      'revisión',
      'revision',
      'inspección',
      'inspeccion',
      'inspection',
      'mantenimiento',
      'maintenance'
    ];
    
    // Check if any of our variations are found in the state
    return checkVariations.some(variation => 
      state === variation || state.includes(variation)
    );
  };
  
  const isRequest = (event) => {
    if (!event || !event.state) return false;
    const state = (event.state || '').toLowerCase();
    return state === 'request' || state.includes('request');
  };

  // Get the color based on event type and status
  let color;
  
  // Use our helper functions for consistent type detection
  if (isIncidence(event)) {
    // For incidence events, use the specific status color
    color = incidenceStatusColors[event.status] || incidenceStatusColors['open'];
  } 
  else if (isCheck(event)) {
    // Checks get the blue color
    color = typeColors['periodic check'];
    
    // For closed events, dim the color
    if (event.status === 'closed') {
      color = adjustBrightness(color, 0.6);
    }
  }
  else if (isRequest(event)) {
    // Requests get the purple color
    color = typeColors['request'];
    
    // For closed events, dim the color
    if (event.status === 'closed') {
      color = adjustBrightness(color, 0.6);
    }
  }
  else {
    // Fallback - use user color for unknown types
    color = getColorForUser(event.created_by_user_id);
    
    // For closed events, dim the color
    if (event.status === 'closed') {
      color = adjustBrightness(color, 0.6);
    }
  }
  
  // Mobile markers are larger and have thicker borders
  const markerSize = isMobile ? { width: '30px', height: '30px' } : { width: '45px', height: '45px' };
  const borderWidth = isMobile ? '4px' : '3px';
  
  // Use CSS classes for core styles and only use inline styles for positioning and color
  const markerStyle = {
    position: 'absolute',
    left: `${xCoord}%`,
    top: `${yCoord}%`,
    backgroundColor: color,
    borderWidth: borderWidth,
    ...markerSize,
    transform: `translate(-50%, -50%) scale(${isHovered || isTouched ? viewportScale * 1.15 : viewportScale})`,
    boxShadow: (isHovered || isTouched) 
      ? `0 0 10px ${color}, 0 0 15px rgba(0, 0, 0, 0.5)` 
      : `0 0 6px ${color}, 0 0 10px rgba(0, 0, 0, 0.4)`,
    zIndex: 9999, // Ensure markers are above all other elements
    pointerEvents: 'auto' // Crucial - ensure marker receives events even if parent has pointer-events: none
  };

  // Log event marker details for debugging
  console.log(`EventMarker: Rendering marker for event ${event.id} at position (${xCoord}%, ${yCoord}%)`);

  // Get type badge
  const getTypeBadge = () => {
    if (isIncidence(event)) {
      return <Badge bg="danger">Incidence</Badge>;
    } 
    else if (isCheck(event)) {
      return <Badge bg="info">Periodic Check</Badge>;
    } 
    else if (isRequest(event)) {
      return <Badge bg="purple">Request</Badge>;
    } 
    else {
      // Return the raw state value if we can't categorize it
      return <Badge bg="secondary">{event.state || 'Unknown'}</Badge>;
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