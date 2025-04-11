import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Form } from 'react-bootstrap';
import translate from '../utils/translate';
import { useMobile } from './common/MobileProvider';

const DEBUG = false;

/**
 * MapEventTypeFilter - Filter component for event types on the map
 * 
 * @param {Object} props
 * @param {Array} props.events - All events available
 * @param {Function} props.onFilterChange - Callback when filter changes
 */
const MapEventTypeFilter = ({ events, onFilterChange }) => {
  const { isMobile } = useMobile();
  
  // Track original events list with direct access to the prop
  // This ensures we're always filtering the most current events
  const eventsSnapshot = useMemo(() => events || [], [events]);
  
  // Default all types to checked (true)
  const [selectedTypes, setSelectedTypes] = useState({
    'incidence': true,
    'periodic check': true,
    'request': true
  });

  // Calculate counts for each type directly from the current events prop
  const typeCounts = useMemo(() => ({
    'incidence': events?.filter(e => e?.state === 'incidence').length || 0,
    'periodic check': events?.filter(e => e?.state === 'periodic check').length || 0,
    'request': events?.filter(e => e?.state === 'request').length || 0
  }), [events]);

  // Apply filter whenever selection changes or events change
  useEffect(() => {
    // Skip if no callback or no events
    if (!onFilterChange || !events || !Array.isArray(events)) return;
    
    // Filter based on currently selected types - using the current events prop directly
    const filteredEvents = events.filter(event => {
      // Skip if event has no state
      if (!event || !event.state) return false;
      
      // Include event if its type is checked in the filter
      return selectedTypes[event.state] === true;
    });
    
    // Apply the filter with the direct filtered events
    onFilterChange(filteredEvents);
    
    // Debug log to verify filter application
    console.log(`Filter applied: ${Object.entries(selectedTypes)
      .filter(([_, checked]) => checked)
      .map(([type]) => type)
      .join(', ')}`);
      
  }, [selectedTypes, events, onFilterChange]);

  // Handle checkbox state changes - simple and direct
  const handleTypeChange = (e) => {
    const { name, checked } = e.target;
    if (DEBUG) console.log(`Filter changed: ${name} = ${checked}`);
    
    setSelectedTypes(prev => ({
      ...prev,
      [name]: checked
    }));
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