import { useState, useEffect } from 'react';

// Default mode is desktop
const DEFAULT_MODE = false; // false = desktop, true = mobile
const MOBILE_MODE_KEY = 'app_mobile_mode';

// Track mobile mode changes with a subscription system
let listeners = [];
// Version counter for forcing re-renders
let versionCounter = 0;

/**
 * Get the current mobile mode setting from localStorage
 * @returns {boolean} Current mobile mode (true = mobile, false = desktop)
 */
export const getMobileMode = () => {
  const savedMode = localStorage.getItem(MOBILE_MODE_KEY);
  return savedMode ? JSON.parse(savedMode) : DEFAULT_MODE;
};

/**
 * Set the mobile mode in localStorage
 * @param {boolean} isMobile - Whether to enable mobile mode
 */
export const setMobileMode = (isMobile) => {
  localStorage.setItem(MOBILE_MODE_KEY, JSON.stringify(isMobile));
  // Increment version counter
  versionCounter++;
  // Notify all listeners
  listeners.forEach(listener => listener(isMobile, versionCounter));
  // Force a re-render by dispatching a custom event
  window.dispatchEvent(new Event('mobileModeChange'));
};

/**
 * Toggle between mobile and desktop modes
 * @returns {boolean} The new mobile mode state after toggling
 */
export const toggleMobileMode = () => {
  const currentMode = getMobileMode();
  const newMode = !currentMode;
  setMobileMode(newMode);
  return newMode;
};

/**
 * Subscribe to mobile mode changes
 * @param {Function} callback - Function to call when mobile mode changes
 * @returns {Function} Unsubscribe function
 */
export const onMobileModeChange = (callback) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(listener => listener !== callback);
  };
};

/**
 * React hook to make components re-render when mobile mode changes
 * @returns {Object} Current mobile mode state and version
 */
export const useMobileMode = () => {
  const [state, setState] = useState({
    isMobile: getMobileMode(),
    version: versionCounter
  });
  
  useEffect(() => {
    const handleMobileModeChange = (isMobile, version) => {
      setState({ isMobile, version });
    };
    
    // Listen for mobile mode changes
    window.addEventListener('mobileModeChange', () => {
      setState({ 
        isMobile: getMobileMode(), 
        version: versionCounter 
      });
    });
    
    const unsubscribe = onMobileModeChange(handleMobileModeChange);
    
    return () => {
      window.removeEventListener('mobileModeChange', handleMobileModeChange);
      unsubscribe();
    };
  }, []);
  
  return state.isMobile;
};

export default {
  getMobileMode,
  setMobileMode,
  toggleMobileMode,
  useMobileMode
}; 