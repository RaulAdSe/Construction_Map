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
  const originalEventsRef = useRef(events || []);
  
  // Default all types to checked
  const [selectedTypes, setSelectedTypes] = useState({
    'incidence': true,
    'periodic check': true,
    'request': true
  });

  // Keep track of original events for filtering
  useEffect(() => {
    if (events && Array.isArray(events)) {
      originalEventsRef.current = events;
    }
  }, [events]);

  // Apply filtering whenever selection changes
  useEffect(() => {
    // Filter events based on selected types
    const filteredEvents = originalEventsRef.current.filter(event => {
      // If event has no state property or it's null/undefined, skip it
      if (!event || !event.state) return false;
      
      // Include events whose state is checked in the filter
      return selectedTypes[event.state] === true;
    });
    
    // Always call filter change handler with updated filtered events
    if (onFilterChange) {
      onFilterChange(filteredEvents);
    }
  }, [selectedTypes, onFilterChange]);

  const handleTypeChange = (e) => {
    const { name, checked } = e.target;
    setSelectedTypes(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Calculate counts for each type
  const typeCounts = {
    'incidence': originalEventsRef.current.filter(e => e?.state === 'incidence').length || 0,
    'periodic check': originalEventsRef.current.filter(e => e?.state === 'periodic check').length || 0,
    'request': originalEventsRef.current.filter(e => e?.state === 'request').length || 0
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