import axios from 'axios';
import { API_URL, API_PATH, ensureHttps, isDevelopment } from './config';

// Debug flag - enable for development, disable for production
const DEBUG = isDevelopment || false;

// Always use secure connections
const SECURE_API_URL = ensureHttps(API_URL) + API_PATH;
console.log('API using base URL:', SECURE_API_URL);

// Create Axios instance with default config
const api = axios.create({
  baseURL: SECURE_API_URL,
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(config => {
  // First check if token is expired and handle it
  const { checkTokenBeforeApiCall } = require('./services/authService');
  if (!checkTokenBeforeApiCall()) {
    // Token was expired and user redirected, abort the request
    return Promise.reject(new Error('Token expired, redirecting to login'));
  }
  
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Always ensure URL uses HTTPS
  if (config.url) {
    // If it's an absolute URL (contains ://)
    if (config.url.includes('://')) {
      config.url = ensureHttps(config.url);
    }
  }
  
  // Ensure baseURL uses HTTPS
  if (config.baseURL) {
    config.baseURL = ensureHttps(config.baseURL);
  }
  
  // Standardize endpoint path structure
  if (config.url && !config.url.startsWith('http')) {
    // Remove any leading slash for consistent path handling
    const trimmedUrl = config.url.startsWith('/') ? config.url.substring(1) : config.url;
    
    // FIXED: Prevent duplicate /v1/ segments in URLs
    // Check if we already have /api/v1 in the baseURL and endpoint
    const hasApiV1InBaseUrl = config.baseURL && config.baseURL.includes('/api/v1');
    const hasApiV1InEndpoint = trimmedUrl.includes('/api/v1/');
    
    // If API_PATH is already in the baseURL, we don't need to add it again
    if (hasApiV1InBaseUrl && hasApiV1InEndpoint) {
      console.warn(`[API] Detected duplicate API path in URL: ${config.url}`);
      // Remove the duplicate /api/v1 segment
      config.url = trimmedUrl.replace('/api/v1/', '/');
      console.warn(`[API] Fixed to: ${config.url}`);
    }
    
    // FIXED: Map endpoints should always have the proper pattern without duplication
    if (trimmedUrl.startsWith('maps') && !hasApiV1InEndpoint) {
      // Use relative path if baseURL already includes API_PATH
      if (hasApiV1InBaseUrl) {
        config.url = `maps${trimmedUrl.replace(/^maps\/?/, '/')}`;
      } else {
        // Remove the baseURL since we're going to use a fully qualified path
        const originalBaseUrl = config.baseURL;
        config.baseURL = '';
        
        // Set the full URL path with proper structure
        config.url = `${SECURE_API_URL}/maps${trimmedUrl.replace(/^maps\/?/, '/')}`;
      }
      
      console.log(`[API] Standardized map endpoint: ${trimmedUrl} → ${config.url}`);
    }
    // Ensure other endpoints follow the same pattern
    else if ((trimmedUrl.startsWith('projects') || 
             trimmedUrl.startsWith('events') || 
             trimmedUrl.startsWith('auth')) && 
             !hasApiV1InEndpoint) {
      
      // Only standardize if base URL already has API path
      if (hasApiV1InBaseUrl) {
        const resourcePath = trimmedUrl.split('/')[0]; // Get resource name (projects, events, etc.)
        const restOfPath = trimmedUrl.replace(new RegExp(`^${resourcePath}\/?`), '');
        
        config.url = `${resourcePath}${restOfPath ? '/' + restOfPath : ''}`;
      } 
      // Otherwise use full qualified path
      else {
        const resourcePath = trimmedUrl.split('/')[0]; 
        const restOfPath = trimmedUrl.replace(new RegExp(`^${resourcePath}\/?`), '');
        
        // Reset baseURL and use fully qualified path
        config.baseURL = '';
        config.url = `${SECURE_API_URL}/${resourcePath}${restOfPath ? '/' + restOfPath : ''}`;
      }
      
      console.log(`[API] Standardized endpoint: ${trimmedUrl} → ${config.url}`);
    }
  }
  
  // Final check for duplicate /v1/ segments
  if (config.url && config.url.includes('/v1/v1/')) {
    console.warn(`[API] Fixing duplicate v1 segment in: ${config.url}`);
    config.url = config.url.replace('/v1/v1/', '/v1/');
  }
  
  return config;
}, error => {
  if (DEBUG) console.error('Request error:', error);
  return Promise.reject(error);
});

// Response interceptor to handle common errors
api.interceptors.response.use(
  response => response,
  error => {
    // Network errors
    if (!error.response) {
      console.error('Network Error:', error.message);
    } else {
      // Handle 401 Unauthorized - likely token expired
      if (error.response.status === 401) {
        console.warn('Unauthorized request - token may be expired');
        
        // If there's a specific token expired error, redirect to login
        if (error.response.data && 
            (error.response.data.detail === 'Token expired' || 
             error.response.data.detail === 'Not authenticated')) {
          
          console.warn('Token expired, redirecting to login');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          // Only redirect if not already on login page to avoid loops
          const currentPath = window.location.pathname;
          if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
            window.location.href = '/login';
          }
        }
      }
      
      // Log other error responses for debugging
      console.error(`API Error ${error.response.status}:`, error.response.data);
    }
    
    return Promise.reject(error);
  }
);

// Helper function to create secure direct HTTPS URLs
export const createSecureDirectUrl = (endpoint, queryParams = {}) => {
  // Base HTTPS URL for the API
  const baseSecureUrl = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1';
  
  // Remove any leading slash from the endpoint
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  // Build the URL with the endpoint
  let secureUrl = `${baseSecureUrl}/${cleanEndpoint}`;
  
  // Add query parameters if provided
  if (Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        params.append(key, value);
      }
    }
    
    const queryString = params.toString();
    if (queryString) {
      secureUrl += (secureUrl.includes('?') ? '&' : '?') + queryString;
    }
  }
  
  console.debug(`[API] Created secure direct URL: ${secureUrl}`);
  return secureUrl;
};

// Helper function to create a secure config for direct HTTPS URLs
export const createSecureConfig = (directUrl, customHeaders = {}) => {
  // Create config with the direct URL
  const config = {
    url: directUrl,
    baseURL: '', // Remove baseURL to prevent axios from combining it with the URL
    headers: { ...customHeaders }
  };
  
  // Add token if available
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
};

export default api; 