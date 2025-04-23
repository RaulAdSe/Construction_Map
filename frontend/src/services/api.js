import axios from 'axios';
import { API_URL, ensureHttps } from '../config'; // Import from central config

// Add debug flag to control console output
const DEBUG = true; // Temporarily enable debugging

// CRITICAL FIX: Hardcode the secure API URL to prevent any protocol switching
const SECURE_API_URL = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1';

// Log the configured API URL for debugging
console.log('[API] Using hardcoded secure URL:', SECURE_API_URL);

// EXTRA CHECK: Ensure the URL is secure
if (SECURE_API_URL.startsWith('http:')) {
  console.error('[CRITICAL] SECURE_API_URL is not secure!');
  throw new Error('Insecure API URL detected - application halted for security');
}

// Add a mechanism to ensure that all URLs are HTTPS
const ensureSecureUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('http:')) {
    console.warn('[Security] Converting insecure URL:', url);
    return url.replace(/^http:/i, 'https:');
  }
  return url;
};

// Override the axios.create method to ensure it always uses HTTPS
const originalCreate = axios.create;
axios.create = function(config) {
  if (config && config.baseURL) {
    config.baseURL = ensureSecureUrl(config.baseURL);
  }
  return originalCreate.call(this, config);
};

// Create an axios instance with default settings
const api = axios.create({
  baseURL: SECURE_API_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// FINAL CHECK: Ensure the baseURL is secure
if (api.defaults.baseURL.startsWith('http:')) {
  console.error('[CRITICAL] API baseURL is still insecure after creation!');
  api.defaults.baseURL = api.defaults.baseURL.replace(/^http:/i, 'https:');
}

console.log('[API] Final baseURL:', api.defaults.baseURL);

// Add request interceptor to enforce HTTPS and add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Make a direct copy of the config to log
  const configCopy = { ...config };
  console.debug(`[URL Debug] Processing request to: ${configCopy.url || ''} with baseURL: ${configCopy.baseURL || ''}`);
  
  // Log query parameters if present
  if (config.params) {
    console.debug(`[URL Debug] Request has query parameters:`, config.params);
  }
  
  // Force HTTPS for all URLs (baseURL and URL)
  if (config.baseURL && config.baseURL.startsWith('http:')) {
    config.baseURL = config.baseURL.replace(/^http:/i, 'https:');
    console.warn('[Security] Forced HTTPS on baseURL:', config.baseURL);
  }
  
  if (config.url && config.url.startsWith('http:')) {
    config.url = config.url.replace(/^http:/i, 'https:');
    console.warn('[Security] Forced HTTPS on URL:', config.url);
  }

  // Log the "final" URL that will be requested
  try {
    // First check how axios will construct the full URL with params
    let axiosFullUrl;
    try {
      const paramsSerializer = config.paramsSerializer || axios.defaults.paramsSerializer;
      let queryString = '';
      
      if (config.params) {
        if (paramsSerializer) {
          queryString = paramsSerializer(config.params);
        } else {
          queryString = Object.entries(config.params)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        }
        
        queryString = queryString ? `?${queryString}` : '';
      }
      
      // Construct the URL how axios might do it
      axiosFullUrl = `${config.baseURL || ''}${config.url || ''}${queryString}`;
      console.debug('[URL Debug] Axios might construct URL as:', axiosFullUrl);
      
      // Check for HTTP in the constructed URL
      if (axiosFullUrl.startsWith('http:')) {
        console.error('[Critical] Axios might construct an HTTP URL:', axiosFullUrl);
      }
    } catch (axiosError) {
      console.error('[URL Debug] Error parsing axios URL construction:', axiosError);
    }
    
    // Now check with URL API
    const fullUrl = new URL(config.url || '', config.baseURL || window.location.origin).toString();
    console.log('[Request] Full URL:', fullUrl);
    
    // Final security check - replace any http: in the full URL with https:
    if (fullUrl.startsWith('http:')) {
      console.error('[Critical] Full URL still has HTTP protocol:', fullUrl);
      const secureUrl = fullUrl.replace(/^http:/i, 'https:');
      console.warn('[Security] Emergency protocol fix:', secureUrl);
      
      // Completely reconstruct the config to ensure HTTPS
      if (config.url && config.url.includes('://')) {
        config.url = secureUrl;
        config.baseURL = ''; // Clear baseURL to avoid duplication
      } else {
        // For relative URLs, fix the baseURL
        const urlObj = new URL(secureUrl);
        config.baseURL = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.endsWith(config.url || '') 
          ? urlObj.pathname.substring(0, urlObj.pathname.length - (config.url || '').length) 
          : urlObj.pathname}`;
        // Keep the original relative URL
      }
    }
  } catch (e) {
    console.error('[URL] Error processing URL:', e);
  }
  
  return config;
}, (error) => {
  if (DEBUG) console.error('Request error:', error);
  return Promise.reject(error);
});

// Add response interceptor to handle common responses
api.interceptors.response.use(
  response => {
    // Process response data to ensure all URLs use HTTPS
    if (response.data) {
      // Process array responses
      if (Array.isArray(response.data)) {
        response.data = response.data.map(item => {
          if (item && typeof item === 'object') {
            // Process all string properties that might be URLs
            Object.keys(item).forEach(key => {
              if (typeof item[key] === 'string' && 
                  (key.includes('url') || key.includes('link') || key.includes('path')) && 
                  item[key].includes('http')) {
                item[key] = ensureHttps(item[key]);
              }
            });
          }
          return item;
        });
      } 
      // Process single object responses
      else if (response.data && typeof response.data === 'object') {
        Object.keys(response.data).forEach(key => {
          if (typeof response.data[key] === 'string' && 
              (key.includes('url') || key.includes('link') || key.includes('path')) && 
              response.data[key].includes('http')) {
            response.data[key] = ensureHttps(response.data[key]);
          }
        });
      }
    }
    return response;
  },
  async error => {
    const originalRequest = error.config;
    
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401) {
      // Check if this was already a retry to avoid loops
      if (!originalRequest._retry) {
        console.warn('[Auth] Token expired, attempting refresh...');
        
        try {
          // Mark as retried
          originalRequest._retry = true;
          
          // Clear existing token
          localStorage.removeItem('token');
          
          // Check if we're not already on the login page to avoid redirect loops
          if (!window.location.pathname.includes('/login')) {
            // Redirect to login
            console.warn('[Auth] Redirecting to login after token expiration');
            window.location.href = '/login';
            return Promise.reject(new Error('Session expired. Please log in again.'));
          }
        } catch (refreshError) {
          console.error('[Auth] Error during token refresh:', refreshError);
        }
      }
    }
    
    // Log other errors only when debugging is enabled
    if (DEBUG) {
      if (error.response) {
        console.error('Response error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('Request error (no response):', error.request);
        
        // Specifically check for mixed content issues
        if (window.location.protocol === 'https:' && 
            originalRequest && 
            (originalRequest.url?.startsWith('http:') || originalRequest.baseURL?.startsWith('http:'))) {
          console.error('[Critical] Mixed content blocking may be preventing this request');
        }
      } else {
        console.error('Error setting up request:', error.message);
      }
    }
    
    return Promise.reject(error);
  }
);

// Export the api instance
export default api;

// Auth services
export const authService = {
  login: async (username, password) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('grant_type', 'password');
    
    const response = await api.post('/auth/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      
      // Store user info
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    }
    return null;
  },
  
  register: async (userData) => {
    return await api.post('/auth/register', userData);
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// Project services
export const projectService = {
  getProjects: async () => {
    // DIRECT FIX: Use a fully qualified HTTPS URL instead of relying on axios composition
    const directSecureUrl = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/projects/';
    console.debug(`[API Debug] Project service calling direct secure URL: ${directSecureUrl}`);
    
    try {
      // Create a secure config that explicitly uses the direct URL
      const secureConfig = {
        url: directSecureUrl,
        baseURL: '', // Remove baseURL to prevent axios from combining it with the URL
        headers: {}
      };
      
      // Add token if available
      const token = localStorage.getItem('token');
      if (token) {
        secureConfig.headers.Authorization = `Bearer ${token}`;
      }
      
      console.debug(`[Security] Making secure direct request to: ${directSecureUrl}`);
      return await api.get(directSecureUrl, secureConfig);
    } catch (error) {
      console.error('[Project API] Error fetching projects:', error);
      
      // FALLBACK: If axios request fails, try using fetch API directly
      if (error.message.includes('Network Error')) {
        console.warn('[Project API] Attempting fallback with fetch API');
        const token = localStorage.getItem('token');
        const response = await fetch(directSecureUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        
        if (!response.ok) {
          throw new Error(`Fetch API error: ${response.status} ${response.statusText}`);
        }
        
        return { data: await response.json() };
      }
      
      throw error;
    }
  },
  
  getProject: async (id) => {
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/projects/${id}`;
    console.debug(`[API Debug] Project service calling direct secure URL: ${directSecureUrl}`);
    
    // Create a secure config
    const secureConfig = {
      url: directSecureUrl,
      baseURL: '' // Remove baseURL to prevent axios from combining it
    };
    
    return await api.get(directSecureUrl, secureConfig);
  },
  
  createProject: async (projectData) => {
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/projects/';
    console.debug(`[API Debug] Project service calling direct secure URL: ${directSecureUrl}`);
    
    // Ensure HTTPS
    const secureConfig = {
      url: directSecureUrl,
      baseURL: '' // Remove baseURL to prevent axios from combining it
    };
    
    return await api.post(directSecureUrl, projectData, secureConfig);
  },
  
  updateProject: async (id, projectData) => {
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/projects/${id}`;
    console.debug(`[API Debug] Project service calling direct secure URL: ${directSecureUrl}`);
    
    // Ensure HTTPS
    const secureConfig = {
      url: directSecureUrl,
      baseURL: '' // Remove baseURL to prevent axios from combining it
    };
    
    return await api.put(directSecureUrl, projectData, secureConfig);
  },
  
  deleteProject: async (id) => {
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/projects/${id}`;
    console.debug(`[API Debug] Project service calling direct secure URL: ${directSecureUrl}`);
    
    // Ensure HTTPS
    const secureConfig = {
      url: directSecureUrl,
      baseURL: '' // Remove baseURL to prevent axios from combining it
    };
    
    return await api.delete(directSecureUrl, secureConfig);
  },
  
  // Get all project tags
  getProjectTags: async (projectId) => {
    const endpoint = `projects/${projectId}/tags`;
    console.debug(`[API Debug] Project service calling: ${endpoint}`);
    
    // Ensure HTTPS
    const secureConfig = {
      baseURL: ensureHttps(api.defaults.baseURL)
    };
    
    return await api.get(`/${endpoint}`, secureConfig);
  },
  
  // Get all project members
  getProjectMembers: async (projectId) => {
    const endpoint = `projects/${projectId}/members`;
    console.debug(`[API Debug] Project service calling: ${endpoint}`);
    
    // Ensure HTTPS
    const secureConfig = {
      baseURL: ensureHttps(api.defaults.baseURL)
    };
    
    return await api.get(`/${endpoint}`, secureConfig);
  },
  
  // Add a user to project
  addUserToProject: async (projectId, userId) => {
    const secureConfig = {
      baseURL: ensureHttps(api.defaults.baseURL)
    };
    
    return await api.post(`/projects/${projectId}/users`, { 
      user_id: userId
    }, secureConfig);
  },
  
  // Update a member's admin status
  updateMemberRole: async (projectId, userId, isAdmin) => {
    const secureConfig = {
      baseURL: ensureHttps(api.defaults.baseURL)
    };
    
    return await api.put(`/projects/${projectId}/members/${userId}/role`, {
      role: isAdmin ? "ADMIN" : "MEMBER" 
    }, secureConfig);
  },
  
  // Update a member's field in a project
  updateMemberField: async (projectId, userId, field) => {
    console.log(`API call: updateMemberField for project ${projectId}, user ${userId}, field "${field}"`);
    try {
      // Ensure field is a string
      const fieldValue = String(field).trim();
      console.log(`Sending field update with value: "${fieldValue}"`);
      
      const secureConfig = {
        baseURL: ensureHttps(api.defaults.baseURL),
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const response = await api.put(`/projects/${projectId}/users/${userId}/field`, 
        { field: fieldValue },
        secureConfig
      );
      
      console.log('Field update API response:', response);
      return response.data;
    } catch (error) {
      console.error('Field update API error:', error);
      throw error;
    }
  },
  
  // Remove a user from a project
  removeUserFromProject: async (projectId, userId) => {
    const secureConfig = {
      baseURL: ensureHttps(api.defaults.baseURL)
    };
    
    return await api.delete(`/projects/${projectId}/users/${userId}`, secureConfig);
  }
};

// Maps services - REMOVED duplicate service, now only in mapService.js

// Events services
export const eventService = {
  getEvents: async () => {
    // Ensure HTTPS
    const secureConfig = {
      baseURL: ensureHttps(api.defaults.baseURL)
    };
    
    return await api.get('/events/', secureConfig);
  },
  
  getEvent: async (id) => {
    // Ensure HTTPS
    const secureConfig = {
      baseURL: ensureHttps(api.defaults.baseURL)
    };
    
    return await api.get(`/events/${id}`, secureConfig);
  },
  
  createEvent: async (eventData) => {
    const formData = new FormData();
    formData.append('map_id', eventData.map_id);
    formData.append('title', eventData.title);
    formData.append('description', eventData.description);
    formData.append('x_coordinate', eventData.x_coordinate);
    formData.append('y_coordinate', eventData.y_coordinate);
    formData.append('status', eventData.status || 'open');
    
    if (eventData.image) {
      formData.append('image', eventData.image);
    }
    
    // Ensure HTTPS with multipart content-type
    const secureConfig = {
      baseURL: ensureHttps(api.defaults.baseURL),
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };
    
    return await api.post('/events/', formData, secureConfig);
  },
  
  updateEvent: async (id, eventData) => {
    const formData = new FormData();
    
    if (eventData.title) formData.append('title', eventData.title);
    if (eventData.description) formData.append('description', eventData.description);
    if (eventData.status) formData.append('status', eventData.status);
    if (eventData.image) formData.append('image', eventData.image);
    
    // Ensure HTTPS with multipart content-type
    const secureConfig = {
      baseURL: ensureHttps(api.defaults.baseURL),
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };
    
    return await api.put(`/events/${id}`, formData, secureConfig);
  },
  
  deleteEvent: async (id) => {
    // Ensure HTTPS
    const secureConfig = {
      baseURL: ensureHttps(api.defaults.baseURL)
    };
    
    return await api.delete(`/events/${id}`, secureConfig);
  }
}; 