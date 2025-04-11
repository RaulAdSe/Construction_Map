import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form } from 'react-bootstrap';
import translate from '../utils/translate';
import { useMobile } from './common/MobileProvider';

/**
 * MapEventTypeFilter - A minimal component to filter event types displayed on the map
 * 
 * @param {Object} props
 * @param {Array} props.events - All events
 * @param {Function} props.onFilterChange - Callback when filter changes
 */
const MapEventTypeFilter = ({ events, onFilterChange }) => {
  const { isMobile } = useMobile();
  const allEventsRef = useRef(events);
  
  // Default all types to checked
  const [selectedTypes, setSelectedTypes] = useState({
    'incidence': true,
    'periodic check': true,
    'request': true
  });

  // Store all events when they change
  useEffect(() => {
    allEventsRef.current = events;
  }, [events]);

  // Filter events based on type - memoized to prevent unnecessary re-renders
  const filterEvents = useCallback(() => {
    // Make sure we have events to filter
    if (!allEventsRef.current || !Array.isArray(allEventsRef.current)) {
      return [];
    }
    
    return allEventsRef.current.filter(event => {
      // If event has no state property or it's null/undefined, skip it
      if (!event || !event.state) return false;
      
      // Only include events whose state is checked in the filter
      return selectedTypes[event.state] === true;
    });
  }, [selectedTypes]);

  // Apply filtering whenever selection changes
  useEffect(() => {
    const filteredEvents = filterEvents();
    
    // Always call onFilterChange when filter changes, 
    // this ensures events are shown/hidden correctly
    if (onFilterChange) {
      onFilterChange(filteredEvents);
    }
  }, [filterEvents, onFilterChange]);

  const handleTypeChange = (e) => {
    const { name, checked } = e.target;
    setSelectedTypes(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Calculate counts for each type
  const typeCounts = {
    'incidence': events?.filter(e => e?.state === 'incidence')?.length || 0,
    'periodic check': events?.filter(e => e?.state === 'periodic check')?.length || 0,
    'request': events?.filter(e => e?.state === 'request')?.length || 0
  };

  return (
    <div className="map-event-filter p-1" style={{ 
      fontSize: '0.85em',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: '4px',
      border: '1px solid #dee2e6',
      marginBottom: '5px',
      display: 'flex',
      justifyContent: 'center',
      flexWrap: 'wrap'
    }}>
      <Form.Check 
        type="checkbox"
        id="filter-incidence"
        name="incidence"
        label={`${translate('Incidences')} (${typeCounts['incidence']})`}
        checked={selectedTypes['incidence']}
        onChange={handleTypeChange}
        className="me-2 mb-0"
        style={{ whiteSpace: 'nowrap' }}
      />
      <Form.Check 
        type="checkbox"
        id="filter-periodic-check"
        name="periodic check"
        label={`${translate('Checks')} (${typeCounts['periodic check']})`}
        checked={selectedTypes['periodic check']}
        onChange={handleTypeChange}
        className="me-2 mb-0"
        style={{ whiteSpace: 'nowrap' }}
      />
      <Form.Check 
        type="checkbox"
        id="filter-request"
        name="request"
        label={`${translate('Requests')} (${typeCounts['request']})`}
        checked={selectedTypes['request']}
        onChange={handleTypeChange}
        className="mb-0"
        style={{ whiteSpace: 'nowrap' }}
      />
    </div>
  );
};

export default MapEventTypeFilter; 