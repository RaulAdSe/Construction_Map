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
    transform: 'translate(-50%, -50%)',
    width: isHovered ? '18px' : '14px',
    height: isHovered ? '18px' : '14px',
    borderRadius: '50%',
    backgroundColor: color,
    border: '2px solid white',
    boxShadow: '0 0 3px rgba(0, 0, 0, 0.3)',
    cursor: 'pointer',
    zIndex: isHovered ? 1001 : 1000,
    transition: 'width 0.2s, height 0.2s, box-shadow 0.2s'
  };
  
  // Add a pulsing effect when hovered
  if (isHovered) {
    markerStyle.boxShadow = `0 0 6px ${color}, 0 0 10px rgba(0, 0, 0, 0.3)`;
  }
  
  const tooltip = (
    <Tooltip id={`tooltip-${event.id}`}>
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