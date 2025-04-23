// Global configuration settings
// Force HTTPS for all backend connections
let apiUrl = window.location.hostname === 'localhost'
  ? '/api/v1' // Use relative URL for local development
  : process.env.REACT_APP_API_URL || 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1'; // Force HTTPS in production

console.debug('[Config] Initial API URL:', apiUrl);

// Always ensure HTTPS is used, even if somehow HTTP appears in config
if (apiUrl.startsWith('http:')) {
  console.warn('[Config] HTTP URL detected in config, converting to HTTPS');
  apiUrl = apiUrl.replace(/^http:\/\//i, 'https://');
}

// CRITICAL: Set this flag to check if running from HTTPS
export const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
console.debug('[Config] Running in HTTPS mode:', isHttps);

// Validate URL structure
if (apiUrl.includes('://')) {
  // For absolute URLs, ensure they end with /api/v1
  if (!apiUrl.endsWith('/api/v1')) {
    if (apiUrl.includes('/api/v1')) {
      // Contains but doesn't end with /api/v1, which may cause path issues
      console.warn('[Config] API URL contains but does not end with /api/v1:', apiUrl);
    } else {
      // Add /api/v1 to the end of the URL
      console.warn('[Config] API URL missing /api/v1 path, adding it:', apiUrl);
      apiUrl = apiUrl.endsWith('/') ? `${apiUrl}api/v1` : `${apiUrl}/api/v1`;
    }
  }
}

// Helper function to ensure HTTPS is always used
export const ensureHttps = (url) => {
  if (!url) return url;
  
  // Return unchanged if it's a relative URL
  if (url.startsWith('/')) {
    console.debug('[Config] Keeping relative URL unchanged:', url);
    return url;
  }
  
  // Force HTTPS for all absolute URLs - always convert to HTTPS
  if (url.startsWith('http:')) {
    console.warn('[Config] HTTP URL encountered and converted to HTTPS:', url);
    return url.replace(/^http:\/\//i, 'https://');
  }
  
  // If URL doesn't start with http: or https:, and looks like a domain, add https://
  if (!url.startsWith('https://')) {
    // Only add https:// if it's not a relative URL and contains a domain
    if (url.includes('.') || url.includes('localhost') || url.includes('storage.googleapis.com')) {
      console.debug('[Config] Adding HTTPS protocol to URL:', url);
      return `https://${url}`;
    }
  }
  
  return url;
};

// Updated helper to check if the URL is potentially problematic
export const isMixedContentUrl = (url) => {
  if (!url) return false;
  
  // If we're on HTTPS and the URL is HTTP, it's mixed content
  if (isHttps && url.startsWith('http:')) {
    console.error('[Mixed Content] Detected insecure URL:', url);
    return true;
  }
  
  return false;
};

// For safety, let's specifically set the backend URL to HTTPS
export const BACKEND_URL = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app';

// Export the API URL (with explicit check for HTTPS)
export const API_URL = ensureHttps(apiUrl);

console.debug('[Config] Final API_URL:', API_URL);

// Add a global fetch interceptor to enforce HTTPS on all requests
if (typeof window !== 'undefined' && window.fetch) {
  // Store the original fetch
  const originalFetch = window.fetch;
  
  // Override fetch with our secure version
  window.fetch = function(url, options) {
    console.debug('[Fetch Interceptor] Processing URL:', url);
    
    // If URL is a string, ensure it uses HTTPS
    if (typeof url === 'string') {
      const originalUrl = url;
      url = ensureHttps(url);
      
      if (originalUrl !== url) {
        console.warn('[Fetch Interceptor] Converted URL from HTTP to HTTPS:', originalUrl, '->', url);
      }
    } 
    // If URL is a Request object with an http: URL
    else if (url instanceof Request) {
      const originalUrl = url.url;
      const secureUrl = ensureHttps(url.url);
      
      if (secureUrl !== url.url) {
        console.warn('[Fetch Interceptor] Converted Request URL from HTTP to HTTPS:', originalUrl, '->', secureUrl);
        // Create a new Request with the secure URL
        url = new Request(secureUrl, url);
      }
    }
    
    return originalFetch.call(window, url, options);
  };
  
  console.debug('[Config] Global fetch interceptor installed to enforce HTTPS');
}

// Add XMLHttpRequest interceptor to prevent mixed content
if (typeof window !== 'undefined' && window.XMLHttpRequest) {
  const originalOpen = XMLHttpRequest.prototype.open;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    console.debug('[XHR Interceptor] Processing URL:', url);
    
    // Ensure URL uses HTTPS
    if (typeof url === 'string') {
      const originalUrl = url;
      url = ensureHttps(url);
      
      if (originalUrl !== url) {
        console.warn('[XHR Interceptor] Converted URL from HTTP to HTTPS:', originalUrl, '->', url);
      }
    }
    
    return originalOpen.call(this, method, url, ...args);
  };
  
  console.debug('[Config] XMLHttpRequest interceptor installed to enforce HTTPS');
}

// Force HTTPS globally - add this to automatically fix mixed content
if (isHttps) {
  console.debug('[Config] Page loaded via HTTPS, ensuring all requests use HTTPS');
  
  // Monitor for mixed content warnings
  if (typeof window !== 'undefined') {
    window.addEventListener('error', function(e) {
      // Check if the error is related to mixed content
      if (e && e.message && 
          (e.message.includes('Mixed Content') || 
           e.message.includes('blocked due to CORS'))) {
        console.error('[Mixed Content Monitor] Detected mixed content error:', e.message);
      }
    }, true);
  }
}

// Add function to diagnose mixed content issues
export const diagnoseMixedContent = () => {
  const issues = [];
  
  // Check if we're on HTTPS
  if (!isHttps) {
    issues.push({
      severity: 'warning',
      message: 'Application is not running on HTTPS. Mixed content warnings may occur.'
    });
  }
  
  // Check API URL configuration
  if (apiUrl.startsWith('http:')) {
    issues.push({
      severity: 'critical',
      message: 'API URL is using HTTP instead of HTTPS',
      detail: apiUrl
    });
  }
  
  // Report results
  if (issues.length > 0) {
    console.error('[Mixed Content Diagnosis] Issues found:', issues);
  } else {
    console.log('[Mixed Content Diagnosis] No obvious issues found.');
  }
  
  return issues;
}; 