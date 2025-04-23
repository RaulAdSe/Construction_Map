import axios from 'axios';
import { ensureHttps } from './config';

// Make absolutely sure the base URL is secure
const SECURE_BASE_URL = ensureHttps('https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1');

// Create an axios instance with default settings
const api = axios.create({
  baseURL: SECURE_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add a request interceptor to add the auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Force HTTPS for all requests to prevent mixed content errors
    if (config.url && config.url.includes('://')) {
      config.url = ensureHttps(config.url);
    }
    
    // Force HTTPS in the baseURL as well
    if (config.baseURL && config.baseURL.includes('://')) {
      config.baseURL = ensureHttps(config.baseURL);
    }
    
    // Log the full URL being used (for debugging)
    console.log('Making API request to:', ensureHttps(config.baseURL + (config.url || '')));
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors for debugging
    console.error('Response error:', error);
    
    // Check for network errors that might be related to HTTPS/mixed content
    if (error.message && error.message.includes('Network Error')) {
      console.error('Network error detected - this could be a mixed content issue. Check HTTPS security.');
      console.error('Request URL:', error.config?.url);
      console.error('Request base URL:', error.config?.baseURL);
    }
    
    // Handle 401 Unauthorized by redirecting to login
    if (error.response && error.response.status === 401) {
      // Check if token is expired
      if (error.response.data && error.response.data.detail && 
          error.response.data.detail.includes('expired')) {
        console.log('Token has expired. Redirecting to login...');
      }
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default api; 