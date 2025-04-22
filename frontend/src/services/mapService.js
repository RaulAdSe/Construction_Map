import axios from 'axios';
import { API_URL, ensureHttps } from '../config';

// Create instance with auth header
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Make absolutely sure API_URL uses HTTPS
const SECURE_API_URL = ensureHttps(API_URL);

// Create api instance with default headers
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  // Set baseURL to SECURE_API_URL to ensure all requests use HTTPS
  baseURL: SECURE_API_URL
});

// Add auth header to each request and enforce HTTPS
api.interceptors.request.use(config => {
  const headers = getAuthHeader();
  config.headers = {
    ...config.headers,
    ...headers
  };
  
  // CRITICAL: Ensure URL uses HTTPS for all absolute URLs
  if (config.url) {
    // If it's an absolute URL (contains ://)
    if (config.url.includes('://')) {
      config.url = ensureHttps(config.url);
    } 
    // If it's a relative URL that doesn't start with / or baseURL
    else if (!config.url.startsWith('/') && !config.baseURL) {
      // Prepend API_URL to ensure correct endpoint
      config.url = `${SECURE_API_URL}/${config.url.replace(/^\/+/, '')}`;
    }
  }
  
  // Always ensure baseURL is HTTPS
  if (config.baseURL) {
    config.baseURL = ensureHttps(config.baseURL);
  }
  
  return config;
});

export const fetchProjects = async () => {
  try {
    // Force HTTPS for this critical request
    const projectsUrl = '/projects/';  // Ensure trailing slash for consistency with other endpoints
    // Log the full URL being used (for debugging)
    console.log('Fetching projects from:', ensureHttps(
      `${SECURE_API_URL}${projectsUrl.startsWith('/') ? projectsUrl : '/' + projectsUrl}`
    ));
    
    // Simply use relative paths since baseURL is set
    const response = await api.get(projectsUrl);
    return response.data;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
};

export const createProject = async (projectData) => {
  try {
    const response = await api.post('/projects/', projectData);
    return response.data;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  try {
    const response = await api.delete(`/projects/${projectId}/`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    throw error;
  }
};

export const fetchProjectById = async (projectId) => {
  try {
    const response = await api.get(`/projects/${projectId}/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching project ${projectId}:`, error);
    throw error;
  }
};

export const fetchMaps = async (projectId) => {
  try {
    console.log(`Fetching maps for project ${projectId}`);
    
    // Fix the URL construction to ensure consistency and include /v1/ in the path
    // Use /api/v1/maps/ with trailing slash to match endpoint expectations
    const url = `/maps/?project_id=${encodeURIComponent(projectId)}`;
    
    // Debug the final URL for troubleshooting
    // Note: This is just for the log display - the actual request uses api.get which already has the correct baseURL
    const fullUrl = new URL(
      `api/v1${url.startsWith('/') ? url : '/' + url}`, 
      SECURE_API_URL
    ).toString();
    console.log(`Request URL for maps: ${fullUrl}`);
    
    // Use the api instance which already has HTTPS enforcement
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching maps for project ${projectId}:`, error);
    // Add additional logging for debugging mixed content issues
    if (error.message && error.message.includes('Network Error')) {
      console.error('Network error detected - possibly a mixed content issue. Check if all URLs use HTTPS.');
      console.error('Request config:', error.config);
    }
    throw error;
  }
};

export const addMap = async (projectId, name, file, mapType = 'implantation') => {
  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    formData.append('project_id', projectId);
    formData.append('map_type', mapType);
    
    // Use api instance with correct headers and baseURL
    const headers = {
      ...getAuthHeader(),
      'Content-Type': 'multipart/form-data'
    };
    
    // Make absolutely sure we're using HTTPS 
    const secureBaseUrl = ensureHttps(SECURE_API_URL);
    console.log(`Using secure base URL for form upload: ${secureBaseUrl}`);
    
    // Create a new instance with the same baseURL for FormData
    const formApi = axios.create({
      baseURL: secureBaseUrl,
      headers
    });
    
    // Add interceptor to this instance too
    formApi.interceptors.request.use(config => {
      // Force HTTPS for all requests
      if (config.url && config.url.includes('://')) {
        config.url = ensureHttps(config.url);
      }
      if (config.baseURL) {
        config.baseURL = ensureHttps(config.baseURL);
      }
      return config;
    });
    
    // Log what we're sending for debugging
    console.log('Sending map upload request with data:', {
      projectId,
      name,
      mapType,
      fileType: file.type,
      fileSize: file.size,
      endpoint: `${secureBaseUrl}/maps/`
    });
    
    const response = await formApi.post('/maps/', formData);
    
    return response.data;
  } catch (error) {
    console.error('Error adding map:', error);
    
    // Enhanced error logging
    if (error.response) {
      // The request was made and the server responded with an error status
      console.error('Response error data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      
      if (error.response.status === 422) {
        console.error('Validation error. Check that all required fields are provided correctly.');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else if (error.message && error.message.includes('Network Error')) {
      console.error('Network error detected - possibly a mixed content issue. Check HTTPS security.');
    }
    
    throw error;
  }
};

export const getMapById = async (mapId) => {
  try {
    const response = await api.get(`/maps/${mapId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching map ${mapId}:`, error);
    throw error;
  }
};

export const deleteMap = async (mapId) => {
  try {
    const response = await api.delete(`/maps/${mapId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting map ${mapId}:`, error);
    throw error;
  }
};

export const updateMap = async (mapId, data) => {
  try {
    const response = await api.put(`/maps/${mapId}`, data);
    return response.data;
  } catch (error) {
    console.error(`Error updating map ${mapId}:`, error);
    throw error;
  }
}; 