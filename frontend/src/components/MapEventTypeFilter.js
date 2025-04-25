import React, { useState, useEffect, useCallback } from 'react';
import { Form } from 'react-bootstrap';
import translate from '../utils/translate';
import { useMobile } from './common/MobileProvider';

/**
 * MapEventTypeFilter - Filter component for event types on the map
 * Rewritten with a two-stage filtering approach for better reliability
 * 
 * @param {Object} props
 * @param {Array} props.mapFilteredEvents - Events already filtered by map visibility
 * @param {Array} props.allEvents - All original events (unfiltered)
 * @param {Function} props.onFilterChange - Callback when filter changes
 */
const MapEventTypeFilter = ({ mapFilteredEvents, allEvents, onFilterChange }) => {
  const { isMobile } = useMobile();
  
  // Initialize filter state
  const [filters, setFilters] = useState({
    incidence: true,
    check: true,
    request: true
  });
  
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
    return state === 'request';
  }, []);
  
  // Calculate counts from all events for display
  const typeCounts = {
    incidence: (allEvents || []).filter(isIncidence).length,
    check: (allEvents || []).filter(isCheck).length,
    request: (allEvents || []).filter(isRequest).length
  };
  
  // Apply filter when filter state changes or map-filtered events change
  useEffect(() => {
    applyFilters();
  }, [filters, mapFilteredEvents]);
  
  // Apply filters function
  const applyFilters = useCallback(() => {
    // Always filter from the map-filtered events, not all events
    if (!mapFilteredEvents || mapFilteredEvents.length === 0) {
      console.log('No map-filtered events to apply type filtering on');
      return;
    }
    
    console.log('Current filter state:', filters);
    console.log(`Applying type filters to ${mapFilteredEvents.length} map-filtered events`);
    
    // Apply type filters
    const finalFilteredEvents = mapFilteredEvents.filter(event => {
      if (!event || !event.state) return false;
      
      const isInc = isIncidence(event);
      const isChk = isCheck(event);
      const isReq = isRequest(event);
      
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
    
    console.log(`Type filters applied: ${activeFilters.join(', ')} - ${finalFilteredEvents.length} events remain`);
    
    // Send final filtered events to parent
    onFilterChange(finalFilteredEvents);
  }, [mapFilteredEvents, filters, isIncidence, isCheck, isRequest, onFilterChange]);
  
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
      flexWrap: 'wrap',
      position: 'relative',
      zIndex: 10001,
      pointerEvents: 'auto'
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
            opacity: typeCounts.incidence > 0 ? 1 : 0.5,
            pointerEvents: 'auto',
            cursor: 'pointer'
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
            opacity: typeCounts.check > 0 ? 1 : 0.5,
            pointerEvents: 'auto',
            cursor: 'pointer'
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
            opacity: typeCounts.request > 0 ? 1 : 0.5,
            pointerEvents: 'auto',
            cursor: 'pointer'
          }}
        />
      </div>
    </div>
  );
};

export default React.memo(MapEventTypeFilter); 