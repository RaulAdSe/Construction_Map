import React, { useRef, useEffect, useState } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import EventMarker from './EventMarker';

const MapDetail = ({ map, events, onMapClick, isSelectingLocation }) => {
  const mapContainerRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  
  useEffect(() => {
    // Reset loading state when map changes
    if (map) {
      setImageLoaded(false);
      setLoadError(false);
    }
  }, [map]);
  
  useEffect(() => {
    if (isSelectingLocation && mapContainerRef.current) {
      const container = mapContainerRef.current;
      
      const handleClick = (e) => {
        // Get click coordinates relative to the map container
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate percentage coordinates
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;
        
        onMapClick(map, xPercent, yPercent);
      };
      
      container.style.cursor = 'crosshair';
      container.addEventListener('click', handleClick);
      
      return () => {
        container.style.cursor = 'default';
        container.removeEventListener('click', handleClick);
      };
    }
  }, [isSelectingLocation, map, onMapClick]);
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  const handleImageError = () => {
    setLoadError(true);
    setImageLoaded(true); // Still set loaded to remove spinner
  };
  
  // Function to render the appropriate content based on map type
  const renderMapContent = () => {
    if (!map || !map.content_url) {
      return <div className="no-content">No content available</div>;
    }
    
    const url = map.content_url;
    const fileExt = url.split('.').pop().toLowerCase();
    
    if (fileExt === 'pdf') {
      return (
        <>
          {!imageLoaded && (
            <div className="map-loading-container">
              <Spinner animation="border" />
              <p>Loading PDF...</p>
            </div>
          )}
          <iframe 
            src={url} 
            className="clean-pdf-view"
            title={map.name}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ opacity: imageLoaded ? 1 : 0 }}
          />
        </>
      );
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(fileExt)) {
      return (
        <>
          {!imageLoaded && (
            <div className="map-loading-container">
              <Spinner animation="border" />
              <p>Loading image...</p>
            </div>
          )}
          <img 
            src={url} 
            alt={map.name} 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              opacity: imageLoaded ? 1 : 0 
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </>
      );
    } else {
      return (
        <>
          {!imageLoaded && (
            <div className="map-loading-container">
              <Spinner animation="border" />
              <p>Loading content...</p>
            </div>
          )}
          <iframe 
            src={url} 
            className="map-iframe-container"
            title={map.name}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ opacity: imageLoaded ? 1 : 0 }}
          />
        </>
      );
    }
  };
  
  return (
    <div 
      ref={mapContainerRef}
      className="map-container" 
      data-map-id={map?.id}
    >
      {renderMapContent()}
      
      {loadError && (
        <Alert variant="danger" className="map-error-overlay">
          Failed to load map content. Please check the file and try again.
        </Alert>
      )}
      
      {/* Render event markers */}
      {imageLoaded && events && events.length > 0 && events.map(event => (
        <EventMarker key={event.id} event={event} />
      ))}
      
      {isSelectingLocation && (
        <div className="selecting-location-overlay">
          <div className="selecting-location-message">
            Click on the map to place your event
          </div>
        </div>
      )}
      
      {/* Display event count badge */}
      {events && events.length > 0 && (
        <div className="event-count-badge">
          {events.length} {events.length === 1 ? 'Event' : 'Events'}
        </div>
      )}
    </div>
  );
};

export default MapDetail; 