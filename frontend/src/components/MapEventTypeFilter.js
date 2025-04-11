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
  const prevFilteredEventsRef = useRef([]);
  
  // Default all types to checked
  const [selectedTypes, setSelectedTypes] = useState({
    'incidence': true,
    'periodic check': true,
    'request': true
  });

  // Filter events based on type - memoized to prevent unnecessary re-renders
  const filterEvents = useCallback(() => {
    return events.filter(event => {
      // If event has no state property or it's null/undefined, skip it
      if (!event || !event.state) return false;
      
      // Only include events whose state is checked in the filter
      return selectedTypes[event.state] === true;
    });
  }, [events, selectedTypes]);

  // Filter events whenever selection changes
  useEffect(() => {
    const filteredEvents = filterEvents();
    
    // Only call onFilterChange if the filtered events have actually changed
    if (onFilterChange) {
      // Simple length check first for quick comparison
      const prevEvents = prevFilteredEventsRef.current;
      if (prevEvents.length !== filteredEvents.length) {
        prevFilteredEventsRef.current = filteredEvents;
        onFilterChange(filteredEvents);
      } else {
        // If same length, check if the event IDs are the same
        const prevIds = new Set(prevEvents.map(e => e.id));
        const hasChanged = filteredEvents.some(e => !prevIds.has(e.id));
        
        if (hasChanged) {
          prevFilteredEventsRef.current = filteredEvents;
          onFilterChange(filteredEvents);
        }
      }
    }
  }, [filterEvents, onFilterChange]); // We can safely include onFilterChange now

  const handleTypeChange = (e) => {
    const { name, checked } = e.target;
    setSelectedTypes(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Calculate counts for each type
  const typeCounts = {
    'incidence': events.filter(e => e.state === 'incidence').length,
    'periodic check': events.filter(e => e.state === 'periodic check').length,
    'request': events.filter(e => e.state === 'request').length
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
        label={translate('Incidences')}
        checked={selectedTypes['incidence']}
        onChange={handleTypeChange}
        className="me-2 mb-0"
        style={{ whiteSpace: 'nowrap' }}
      />
      <Form.Check 
        type="checkbox"
        id="filter-periodic-check"
        name="periodic check"
        label={translate('Checks')}
        checked={selectedTypes['periodic check']}
        onChange={handleTypeChange}
        className="me-2 mb-0"
        style={{ whiteSpace: 'nowrap' }}
      />
      <Form.Check 
        type="checkbox"
        id="filter-request"
        name="request"
        label={translate('Requests')}
        checked={selectedTypes['request']}
        onChange={handleTypeChange}
        className="mb-0"
        style={{ whiteSpace: 'nowrap' }}
      />
    </div>
  );
};

export default MapEventTypeFilter; 