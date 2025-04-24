// Global configuration settings
// Force HTTPS for all backend connections
let apiUrl = window.location.hostname === 'localhost'
  ? '' // Use relative URL for local development
  : process.env.REACT_APP_API_URL || 'https://construction-map-backend-ypzdt6srya-uc.a.run.app'; // Force HTTPS in production

console.debug('[Config] Initial API URL:', apiUrl);

// Set development environment flag
export const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
console.debug('[Config] Running in development mode:', isDevelopment);

// Always ensure HTTPS is used, even if somehow HTTP appears in config
if (apiUrl.startsWith('http:')) {
  console.warn('[Config] HTTP URL detected in config, converting to HTTPS');
  apiUrl = apiUrl.replace(/^http:\/\//i, 'https://');
}

// CRITICAL: Set this flag to check if running from HTTPS
export const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
console.debug('[Config] Running in HTTPS mode:', isHttps);

// Remove '/api/v1' from the base URL if it's there
// We'll add it separately as API_PATH
if (apiUrl.endsWith('/api/v1')) {
  console.warn('[Config] Removing /api/v1 from base URL as it will be added separately');
  apiUrl = apiUrl.substring(0, apiUrl.length - 7); // Remove '/api/v1'
} else if (apiUrl.includes('/api/v1/')) {
  console.warn('[Config] URL contains /api/v1/ with trailing path, normalizing');
  const pattern = /^(.*?)\/api\/v1\/.*$/;
  const match = apiUrl.match(pattern);
  if (match) {
    apiUrl = match[1]; // Take everything before /api/v1/
    console.log('[Config] Base URL normalized to:', apiUrl);
  }
}

// Ensure localhost URLs have the correct format
if (window.location.hostname === 'localhost') {
  // For frontend on localhost, ensure absolute API URL if it's not a relative URL
  if (!apiUrl.startsWith('/') && apiUrl !== '') {
    console.log('[Config] Using absolute API URL for localhost frontend:', apiUrl);
  }
}

// Update for new frontend domain
export const FRONTEND_URL = isHttps
  ? 'https://construction-map-frontend-77413952899.us-central1.run.app'
  : window.location.origin;

// Helper function to ensure HTTPS is always used
export const ensureHttps = (url) => {
  if (!url) return url;
  
  // Return unchanged if it's a relative URL
  if (url.startsWith('/')) {
    return url;
  }
  
  // Force HTTPS for all absolute URLs - always convert to HTTPS
  if (url.startsWith('http:')) {
    const secureUrl = url.replace(/^http:/i, 'https:');
    console.warn('[Config] HTTP URL converted to HTTPS:', url, '->', secureUrl);
    return secureUrl;
  }
  
  // If URL doesn't start with http: or https:, and looks like a domain, add https://
  if (!url.startsWith('https://')) {
    // Only add https:// if it's not a relative URL and contains a domain
    if (url.includes('.') || url.includes('localhost') || url.includes('storage.googleapis.com')) {
      const secureUrl = `https://${url}`;
      console.warn('[Config] Added HTTPS protocol to URL:', url, '->', secureUrl);
      return secureUrl;
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

// Export the base URL without /api/v1 (with explicit check for HTTPS)
export const API_URL = ensureHttps(apiUrl);

// Export the API path for consistent usage across the application
export const API_PATH = '/api/v1';

// Full API URL is the combination of base URL and path
export const FULL_API_URL = API_URL + API_PATH;

console.debug('[Config] Final API_URL (base):', API_URL);
console.debug('[Config] API_PATH:', API_PATH);
console.debug('[Config] FULL_API_URL:', FULL_API_URL);

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
      
      // Fix API endpoint paths
      if (url.includes('construction-map-backend') && !url.includes('/api/v1/')) {
        // If URL points to backend but doesn't have /api/v1/
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        
        // Check if we need to add /api/v1
        if (!path.startsWith('/api/v1/') && 
            (path.startsWith('/maps') || 
             path.startsWith('/projects') || 
             path.startsWith('/events') || 
             path.startsWith('/auth'))) {
          
          const newUrl = url.replace(path, '/api/v1' + path);
          console.warn('[Fetch Interceptor] Adding missing /api/v1 path:', url, '->', newUrl);
          url = newUrl;
        }
      }
      
      if (originalUrl !== url) {
        console.warn('[Fetch Interceptor] Modified URL:', originalUrl, '->', url);
      }
    } 
    // If URL is a Request object with an http: URL
    else if (url instanceof Request) {
      const originalUrl = url.url;
      let secureUrl = ensureHttps(url.url);
      
      // Fix API endpoint paths
      if (secureUrl.includes('construction-map-backend') && !secureUrl.includes('/api/v1/')) {
        // If URL points to backend but doesn't have /api/v1/
        const urlObj = new URL(secureUrl);
        const path = urlObj.pathname;
        
        // Check if we need to add /api/v1
        if (!path.startsWith('/api/v1/') && 
            (path.startsWith('/maps') || 
             path.startsWith('/projects') || 
             path.startsWith('/events') || 
             path.startsWith('/auth'))) {
          
          secureUrl = secureUrl.replace(path, '/api/v1' + path);
          console.warn('[Fetch Interceptor] Adding missing /api/v1 path to Request:', url.url, '->', secureUrl);
        }
      }
      
      if (secureUrl !== url.url) {
        console.warn('[Fetch Interceptor] Modified Request URL:', originalUrl, '->', secureUrl);
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
      
      // Fix API endpoint paths
      if (url.includes('construction-map-backend') && !url.includes('/api/v1/')) {
        // If URL points to backend but doesn't have /api/v1/
        try {
          const urlObj = new URL(url);
          const path = urlObj.pathname;
          
          // Check if we need to add /api/v1
          if (!path.startsWith('/api/v1/') && 
              (path.startsWith('/maps') || 
               path.startsWith('/projects') || 
               path.startsWith('/events') || 
               path.startsWith('/auth'))) {
            
            const newUrl = url.replace(path, '/api/v1' + path);
            console.warn('[XHR Interceptor] Adding missing /api/v1 path:', url, '->', newUrl);
            url = newUrl;
          }
        } catch (e) {
          console.error('[XHR Interceptor] Error processing URL:', e);
        }
      }
      
      if (originalUrl !== url) {
        console.warn('[XHR Interceptor] Modified URL:', originalUrl, '->', url);
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