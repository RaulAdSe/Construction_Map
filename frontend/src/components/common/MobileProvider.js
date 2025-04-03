import React, { createContext, useContext } from 'react';
import {
  getMobileMode,
  setMobileMode,
  toggleMobileMode,
  useMobileMode
} from '../../utils/mobileMode';

// Create a context for mobile mode functions and state
export const MobileContext = createContext();

/**
 * Hook to use mobile mode utilities in any component
 * @returns {Object} mobile mode utilities and current state
 */
export const useMobile = () => {
  const context = useContext(MobileContext);
  if (!context) {
    throw new Error('useMobile must be used within a MobileProvider');
  }
  return context;
};

/**
 * Provider component that wraps the app to make mobile mode available
 */
export const MobileProvider = ({ children }) => {
  // Use our custom hook to track mobile mode and re-render on changes
  const isMobile = useMobileMode();
  
  // Handler for toggling mobile mode
  const handleToggleMobileMode = () => {
    const newMode = toggleMobileMode();
    return newMode;
  };
  
  // Handler for setting a specific mobile mode
  const handleSetMobileMode = (mode) => {
    setMobileMode(mode);
  };
  
  // Value to provide to the context
  const contextValue = {
    isMobile,
    toggleMobileMode: handleToggleMobileMode,
    setMobileMode: handleSetMobileMode,
    getMobileMode
  };
  
  return (
    <MobileContext.Provider value={contextValue}>
      {children}
    </MobileContext.Provider>
  );
};

export default MobileProvider; 