import { useState, useEffect } from 'react';

// Default mode is desktop
const DEFAULT_MODE = false; // false = desktop, true = mobile
const MOBILE_MODE_KEY = 'app_mobile_mode';
const AUTO_DETECT_KEY = 'app_auto_detect_mobile';

// Track mobile mode changes with a subscription system
let listeners = [];
// Version counter for forcing re-renders
let versionCounter = 0;

/**
 * Check if the current device is likely a mobile device
 * @returns {boolean} true if the device is likely mobile
 */
export const detectMobileDevice = () => {
  // Check if running in a browser environment
  if (typeof window === 'undefined' || !window.navigator) return false;
  
  // Get the user agent
  const userAgent = navigator.userAgent.toLowerCase();
  
  // iOS Safari / iPhone detection - these need special handling
  const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Android detection
  const isAndroid = /android/.test(userAgent);
  
  // General mobile detection
  const isMobile = /mobile|tablet|opera mini/.test(userAgent);
  
  // Check for touch capability as a strong indicator
  const hasTouch = 'ontouchstart' in window || 
                  navigator.maxTouchPoints > 0 || 
                  navigator.msMaxTouchPoints > 0;
                  
  // Check screen dimensions - consider small screens mobile
  const isSmallScreen = window.innerWidth <= 768;
  
  // For debugging
  console.log(`Mobile detection: iOS=${isIOS}, Android=${isAndroid}, Mobile=${isMobile}, Touch=${hasTouch}, SmallScreen=${isSmallScreen}`);
  
  // If running on iOS, give higher priority to that detection
  if (isIOS) {
    return true;
  }
  
  // For other devices, use a combination of factors
  return (isAndroid || isMobile || (hasTouch && isSmallScreen));
};

/**
 * Get auto-detect setting from localStorage
 * @returns {boolean} Whether to auto-detect mobile mode
 */
export const getAutoDetect = () => {
  const savedSetting = localStorage.getItem(AUTO_DETECT_KEY);
  // Default to true if not set
  return savedSetting !== null ? JSON.parse(savedSetting) : true;
};

/**
 * Set auto-detect setting in localStorage
 * @param {boolean} autoDetect - Whether to auto-detect mobile mode
 */
export const setAutoDetect = (autoDetect) => {
  localStorage.setItem(AUTO_DETECT_KEY, JSON.stringify(autoDetect));
};

/**
 * Get the current mobile mode setting from localStorage or detect it
 * @returns {boolean} Current mobile mode (true = mobile, false = desktop)
 */
export const getMobileMode = () => {
  // If auto-detect is enabled, use device detection
  if (getAutoDetect()) {
    const isDetectedMobile = detectMobileDevice();
    return isDetectedMobile;
  }
  
  // Otherwise use the saved setting
  const savedMode = localStorage.getItem(MOBILE_MODE_KEY);
  return savedMode ? JSON.parse(savedMode) : DEFAULT_MODE;
};

/**
 * Set the mobile mode in localStorage
 * @param {boolean} isMobile - Whether to enable mobile mode
 */
export const setMobileMode = (isMobile) => {
  // When manually setting mode, disable auto-detect
  setAutoDetect(false);
  
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
 * Enable auto-detection of mobile mode
 */
export const enableAutoDetect = () => {
  setAutoDetect(true);
  const isDetectedMobile = detectMobileDevice();
  // Still need to update listeners and trigger re-render
  versionCounter++;
  listeners.forEach(listener => listener(isDetectedMobile, versionCounter));
  window.dispatchEvent(new Event('mobileModeChange'));
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
    
    // Listen for window resize to detect mobile/desktop changes
    const handleResize = () => {
      if (getAutoDetect()) {
        const isDetectedMobile = detectMobileDevice();
        const currentMode = getMobileMode();
        
        if (isDetectedMobile !== currentMode) {
          versionCounter++;
          listeners.forEach(listener => listener(isDetectedMobile, versionCounter));
          setState({ isMobile: isDetectedMobile, version: versionCounter });
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    const unsubscribe = onMobileModeChange(handleMobileModeChange);
    
    // Initial check
    handleResize();
    
    return () => {
      window.removeEventListener('mobileModeChange', handleMobileModeChange);
      window.removeEventListener('resize', handleResize);
      unsubscribe();
    };
  }, []);
  
  return state.isMobile;
};

export default {
  getMobileMode,
  setMobileMode,
  toggleMobileMode,
  useMobileMode,
  detectMobileDevice,
  enableAutoDetect,
  getAutoDetect
}; 