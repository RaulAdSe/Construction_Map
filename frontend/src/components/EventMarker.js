import React, { useState, useRef, useEffect } from 'react';
import { Badge, Button } from 'react-bootstrap';

const EventMarker = ({ event }) => {
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef(null);
  const markerRef = useRef(null);
  
  // Determine marker color based on event type
  const getMarkerColor = () => {
    switch (event.type) {
      case 'alert':
        return '#dc3545';  // Bootstrap danger red
      case 'information':
        return '#0d6efd';  // Bootstrap primary blue
      case 'action':
        return '#fd7e14';  // Bootstrap orange
      default:
        return '#6c757d';  // Bootstrap gray
    }
  };
  
  const getEventTypeLabel = () => {
    switch (event.type) {
      case 'alert':
        return <Badge bg="danger">Alert</Badge>;
      case 'information':
        return <Badge bg="primary">Information</Badge>;
      case 'action':
        return <Badge bg="warning" text="dark">Action Required</Badge>;
      default:
        return <Badge bg="secondary">Unknown</Badge>;
    }
  };
  
  const handleMarkerClick = (e) => {
    e.stopPropagation();  // Prevent triggering parent container click
    setShowPopup(!showPopup);
  };
  
  const handleClosePopup = (e) => {
    e.stopPropagation();
    setShowPopup(false);
  };
  
  // Use a click outside handler to close the popup
  useEffect(() => {
    if (!showPopup) return;
    
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target) && 
          markerRef.current && !markerRef.current.contains(event.target)) {
        setShowPopup(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);
  
  // Calculate popup position to ensure it stays within viewport
  const getPopupPosition = () => {
    if (!markerRef.current) return { left: 0, top: 0 };
    
    const rect = markerRef.current.getBoundingClientRect();
    let left = rect.right + 10;
    let top = rect.top;
    
    // Check right edge
    if (left + 300 > window.innerWidth) {  // 300px is max popup width
      left = rect.left - 310;  // 310 = 300 + 10px margin
    }
    
    // Check bottom edge
    if (top + 200 > window.innerHeight) {  // Assuming popup height around 200px
      top = window.innerHeight - 210;  // 210 = 200 + 10px margin
    }
    
    return { left, top };
  };
  
  // Format timestamp to readable date/time
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  return (
    <>
      <div
        ref={markerRef}
        className="event-marker"
        style={{
          left: `${event.position_x}%`,
          top: `${event.position_y}%`,
          backgroundColor: getMarkerColor()
        }}
        onClick={handleMarkerClick}
        data-event-id={event.id}
      >
        {showPopup && (
          <div className="event-marker-pulse" style={{ borderColor: getMarkerColor() }} />
        )}
      </div>
      
      {showPopup && (
        <div 
          ref={popupRef}
          className="event-popup"
          style={getPopupPosition()}
        >
          <div className="event-popup-header" style={{ backgroundColor: getMarkerColor() + '20' }}>
            <h5>{event.name}</h5>
            {getEventTypeLabel()}
          </div>
          
          <div className="event-popup-body">
            {event.description ? (
              <p>{event.description}</p>
            ) : (
              <p className="text-muted">No description provided</p>
            )}
            
            <div className="event-popup-details">
              <p className="event-metadata">
                <small>
                  <strong>Created:</strong> {formatTimestamp(event.created_at)}<br />
                  {event.updated_at && event.updated_at !== event.created_at && (
                    <><strong>Updated:</strong> {formatTimestamp(event.updated_at)}<br /></>
                  )}
                  <strong>Position:</strong> {event.position_x.toFixed(1)}%, {event.position_y.toFixed(1)}%
                </small>
              </p>
            </div>
          </div>
          
          <div className="event-popup-footer">
            <Button 
              variant="secondary"
              size="sm"
              onClick={handleClosePopup}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default EventMarker; 