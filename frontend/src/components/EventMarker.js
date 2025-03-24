import React, { useState } from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

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
  
  if (!event || !event.x_coordinate || !event.y_coordinate) {
    return null;
  }
  
  const color = getColorForUser(event.created_by_user_id);
  
  const markerStyle = {
    position: 'absolute',
    left: `${event.x_coordinate}%`,
    top: `${event.y_coordinate}%`,
    width: isHovered ? '20px' : '16px',
    height: isHovered ? '20px' : '16px',
    backgroundColor: color,
    border: '2px solid white',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    boxShadow: isHovered 
      ? `0 0 8px ${color}, 0 0 12px rgba(0, 0, 0, 0.4)` 
      : '0 0 4px rgba(0, 0, 0, 0.4)',
    cursor: 'pointer',
    zIndex: 2000,
    transition: 'all 0.2s ease',
    pointerEvents: 'auto'
  };

  const tooltip = (
    <Tooltip id={`tooltip-${event.id}`} className="event-tooltip">
      <div>
        <strong>{event.title}</strong>
      </div>
      <div>Created by: {event.created_by_user_name || `User ${event.created_by_user_id}`}</div>
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