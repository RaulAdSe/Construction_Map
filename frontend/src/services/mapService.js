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
    // Use relative path with properly encoded query parameter
    const response = await api.get(`/maps?project_id=${encodeURIComponent(projectId)}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching maps for project ${projectId}:`, error);
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
    
    // Create a new instance with the same baseURL for FormData
    const formApi = axios.create({
      baseURL: SECURE_API_URL,
      headers
    });
    
    const response = await formApi.post('/maps', formData);
    
    return response.data;
  } catch (error) {
    console.error('Error adding map:', error);
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