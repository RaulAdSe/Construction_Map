import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form } from 'react-bootstrap';
import translate from '../utils/translate';
import { useMobile } from './common/MobileProvider';

/**
 * MapEventTypeFilter - Filter component for event types on the map
 * Completely rewritten with a simpler, more reliable approach
 */
const MapEventTypeFilter = ({ events, onFilterChange }) => {
  const { isMobile } = useMobile();
  // Keep a pristine copy of all events
  const allEventsRef = useRef([]);
  
  // Initialize filter state
  const [filters, setFilters] = useState({
    incidence: true,
    check: true,
    request: true
  });
  
  // Store all events on first render
  useEffect(() => {
    if (events && events.length > 0) {
      allEventsRef.current = [...events];
      
      // Log event information to help with debugging
      console.log('EVENTS DATA ANALYSIS:');
      const states = events.map(e => e.state?.toLowerCase());
      console.log('All state values:', [...new Set(states)].sort());
      
      // Count by type
      const typeCounts = {
        incidence: events.filter(e => isIncidence(e)).length,
        check: events.filter(e => isCheck(e)).length,
        request: events.filter(e => isRequest(e)).length,
        unknown: events.filter(e => !isIncidence(e) && !isCheck(e) && !isRequest(e)).length
      };
      console.log('Event counts by type:', typeCounts);
    }
  }, [events]);
  
  // Helper functions to categorize events
  const isIncidence = useCallback((event) => {
    if (!event || !event.state) return false;
    const state = event.state.toLowerCase();
    return state === 'incidence' || state.includes('incidence');
  }, []);
  
  const isCheck = useCallback((event) => {
    if (!event || !event.state) return false;
    const state = event.state.toLowerCase();
    
    // Expanded matching to catch more variations
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
  }, []);
  
  const isRequest = useCallback((event) => {
    if (!event || !event.state) return false;
    const state = event.state.toLowerCase();
    return state === 'request' || state.includes('request');
  }, []);
  
  // Calculate filtered counts for display
  const typeCounts = {
    incidence: (events || []).filter(isIncidence).length,
    check: (events || []).filter(isCheck).length,
    request: (events || []).filter(isRequest).length
  };
  
  // Apply filter when filter state changes
  useEffect(() => {
    applyFilters();
  }, [filters]);
  
  // Apply filters function
  const applyFilters = useCallback(() => {
    // Always use the pristine copy of events
    const sourceEvents = allEventsRef.current.length > 0 ? allEventsRef.current : events;
    
    if (!sourceEvents || sourceEvents.length === 0) {
      console.log('No events to filter');
      return;
    }
    
    // Debug logs to identify the issue
    console.log('Current filter state:', filters);
    console.log(`Applying filters from ${sourceEvents.length} events:`);
    
    // Extra detailed debugging to see what's happening
    const eventsByType = {
      incidence: sourceEvents.filter(isIncidence).length,
      check: sourceEvents.filter(isCheck).length,
      request: sourceEvents.filter(isRequest).length
    };
    console.log('Events by type before filtering:', eventsByType);
    
    // Apply filters with consistent type detection
    const filteredEvents = sourceEvents.filter(event => {
      if (!event || !event.state) return false;
      
      // Explicitly log each event's classification for debugging
      const eventType = event.state?.toLowerCase();
      const isInc = isIncidence(event);
      const isChk = isCheck(event);
      const isReq = isRequest(event);
      
      // For debugging the first few events
      if (sourceEvents.indexOf(event) < 5) {
        console.log(`Event ${event.id} (${eventType}): incidence=${isInc}, check=${isChk}, request=${isReq}`);
      }
      
      // The actual filtering logic
      if (isInc) return filters.incidence;
      if (isChk) return filters.check;
      if (isReq) return filters.request;
      
      // Default for unknown types
      return true;
    });
    
    // Log filter results
    const activeFilters = Object.entries(filters)
      .filter(([_, value]) => value)
      .map(([key]) => key);
    
    // Check the results of filtering
    const filteredCounts = {
      incidence: filteredEvents.filter(isIncidence).length,
      check: filteredEvents.filter(isCheck).length,
      request: filteredEvents.filter(isRequest).length
    };
    
    console.log(`Filter applied: ${activeFilters.join(', ')} - ${filteredEvents.length} events`);
    console.log('Filtered results by type:', filteredCounts);
    
    // Send filtered events to parent
    onFilterChange(filteredEvents);
  }, [events, filters, isIncidence, isCheck, isRequest, onFilterChange]);
  
  // Handle checkbox toggle with better logging
  const handleCheckboxChange = useCallback((filterType) => {
    console.log(`Filter toggled: ${filterType} = ${!filters[filterType]}`);
    
    setFilters(prev => {
      // Ensure we're toggling the right key
      const newFilters = {
        ...prev,
        [filterType]: !prev[filterType]
      };
      
      console.log('New filter state:', newFilters);
      return newFilters;
    });
  }, [filters]);
  
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
      <div className={`d-flex ${isMobile ? 'flex-wrap' : 'align-items-center'}`}>
        <Form.Check
          type="checkbox"
          id="filter-incidence"
          name="incidence"
          label={`${translate('Incidences')} (${typeCounts.incidence})`}
          checked={filters.incidence}
          onChange={() => handleCheckboxChange('incidence')}
          className="me-2 mb-0"
          style={{ 
            whiteSpace: 'nowrap',
            opacity: typeCounts.incidence > 0 ? 1 : 0.5
          }}
        />
        
        <Form.Check
          type="checkbox"
          id="filter-check"
          name="check"
          label={`${translate('Checks')} (${typeCounts.check})`}
          checked={filters.check}
          onChange={() => handleCheckboxChange('check')}
          className="me-2 mb-0"
          style={{ 
            whiteSpace: 'nowrap',
            opacity: typeCounts.check > 0 ? 1 : 0.5
          }}
        />
        
        <Form.Check
          type="checkbox"
          id="filter-request"
          name="request"
          label={`${translate('Requests')} (${typeCounts.request})`}
          checked={filters.request}
          onChange={() => handleCheckboxChange('request')}
          className="mb-0"
          style={{ 
            whiteSpace: 'nowrap',
            opacity: typeCounts.request > 0 ? 1 : 0.5
          }}
        />
      </div>
    </div>
  );
};

export default React.memo(MapEventTypeFilter); 