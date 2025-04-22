// Global configuration settings
// Force HTTPS for all backend connections
let apiUrl = window.location.hostname === 'localhost'
  ? '/api/v1' // Use relative URL for local development
  : process.env.REACT_APP_API_URL || 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1'; // Force HTTPS in production

// Always ensure HTTPS is used, even if somehow HTTP appears in config
if (apiUrl.startsWith('http:')) {
  console.warn('HTTP URL detected in config, converting to HTTPS');
  apiUrl = apiUrl.replace(/^http:\/\//i, 'https://');
}

// Helper function to ensure HTTPS is always used
export const ensureHttps = (url) => {
  if (!url) return url;
  
  // Return unchanged if it's a relative URL
  if (url.startsWith('/')) return url;
  
  // Force HTTPS for all absolute URLs - always convert to HTTPS
  if (url.startsWith('http:')) {
    console.warn('HTTP URL encountered and converted to HTTPS:', url);
    return url.replace(/^http:\/\//i, 'https://');
  }
  
  // If URL doesn't start with http: or https:, assume it needs https://
  if (!url.startsWith('https://')) {
    // Only add https:// if it's not a relative URL and contains a domain
    if (url.includes('.') || url.includes('localhost')) {
      return `https://${url}`;
    }
  }
  
  return url;
};

// For safety, let's specifically set the backend URL to HTTPS
export const BACKEND_URL = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app';

// Export the API URL
export const API_URL = apiUrl; 