import axios from 'axios';
import { API_URL, ensureHttps } from '../config';
import api from './api'; // Import the centralized API instance

// For debugging only
console.info('Using secure API URL:', ensureHttps(API_URL));

// Helper function to get auth header when needed outside of the api instance
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// CRITICAL: Use consistent endpoint formatting without leading slashes
const formatEndpoint = (endpoint) => {
  // Remove any leading slash for consistency
  if (endpoint.startsWith('/')) {
    endpoint = endpoint.substring(1);
  }
  return endpoint;
};

// Project functions
export const fetchProjects = async () => {
  try {
    console.debug('[MapService Debug] Fetching projects');
    const response = await api.get('projects');
    return response.data;
  } catch (error) {
    console.error('[MapService Error] Failed to fetch projects:', error);
    throw error;
  }
};

export const createProject = async (projectData) => {
  try {
    console.debug('[MapService Debug] Creating project');
    const response = await api.post('projects', projectData);
    return response.data;
  } catch (error) {
    console.error('[MapService Error] Failed to create project:', error);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  try {
    console.debug(`[MapService Debug] Deleting project ${projectId}`);
    const response = await api.delete(`projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error('[MapService Error] Failed to delete project:', error);
    throw error;
  }
};

export const fetchProjectById = async (projectId) => {
  try {
    console.debug(`[MapService Debug] Fetching project ${projectId}`);
    const response = await api.get(`projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error(`[MapService Error] Failed to fetch project with ID ${projectId}:`, error);
    throw error;
  }
};

// Map functions
/**
 * Fetch all maps for a specific project
 * @param {string|number} projectId - ID of the project to fetch maps for
 * @returns {Promise<Array>} - Promise resolving to an array of map objects
 */
export const fetchMaps = async (projectId) => {
  if (!projectId) {
    console.error('[MapService Error] Project ID is required');
    return [];
  }
  
  try {
    console.debug(`[MapService Debug] Fetching maps for project ${projectId}`);
    
    // According to the FastAPI docs, the correct endpoint is:
    // GET /api/v1/maps/ with project_id as a query parameter
    const response = await api.get('maps', {
      params: { project_id: projectId }
    });
    
    console.log(`[MapService] Successfully fetched ${response.data?.length || 0} maps for project ${projectId}`);
    
    // Ensure all file_urls use HTTPS
    if (response.data && Array.isArray(response.data)) {
      response.data.forEach(map => {
        if (map.file_url) {
          if (map.file_url.startsWith('http:')) {
            console.warn('[MapService] Converting HTTP URL to HTTPS:', map.file_url);
            map.file_url = map.file_url.replace(/^http:/i, 'https:');
          }
        }
        if (map.content_url) {
          if (map.content_url.startsWith('http:')) {
            console.warn('[MapService] Converting content_url HTTP to HTTPS');
            map.content_url = map.content_url.replace(/^http:/i, 'https:');
          }
        }
      });
    }
    
    return response.data;
  } catch (error) {
    console.error(`[MapService Error] Failed to fetch maps for project ${projectId}:`, error);
    
    // If unauthorized, redirect to login
    if (error.response && error.response.status === 401) {
      console.warn('[MapService] Token expired while fetching maps. Redirecting to login...');
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    
    // Fallback to empty array after logging the error
    return [];
  }
};

/**
 * Upload a new map to a project
 * @param {string|number} projectId - ID of the project to add the map to
 * @param {File} file - The map file to upload
 * @param {Object} metadata - Additional map metadata
 * @returns {Promise<Object>} - Promise resolving to the newly created map
 */
export const addMap = async (projectId, file, metadata) => {
  if (!projectId || !file) {
    throw new Error('Project ID and file are required');
  }
  
  try {
    console.debug(`[MapService Debug] Uploading map to project ${projectId}`);
    
    // Prepare form data for the upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);
    
    // Add metadata fields if provided
    if (metadata) {
      if (metadata.name) formData.append('name', metadata.name);
      if (metadata.description) formData.append('description', metadata.description);
      if (metadata.map_type) formData.append('map_type', metadata.map_type);
      if (metadata.transform_data) formData.append('transform_data', JSON.stringify(metadata.transform_data));
    }
    
    // According to FastAPI docs, the correct endpoint is:
    // POST /api/v1/maps/
    const response = await api.post('maps', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });
    
    console.log(`[MapService] Successfully uploaded map to project ${projectId}`);
    return response.data;
  } catch (error) {
    console.error(`[MapService Error] Failed to upload map to project ${projectId}:`, error);
    
    // Handle different error types
    if (error.response) {
      const status = error.response.status;
      
      if (status === 400) {
        throw new Error('Invalid map data. Please check the file and try again.');
      } else if (status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('Unauthorized. Please log in again.');
      } else if (status === 403) {
        throw new Error('You do not have permission to add maps to this project.');
      } else if (status === 413) {
        throw new Error('The map file is too large. Please try a smaller file.');
      } else {
        throw new Error(`Server error (${status}): ${error.response.data.detail || 'Unknown error'}`);
      }
    } else if (error.request) {
      throw new Error('No response from server. Please check your connection and try again.');
    } else {
      throw new Error(`Error: ${error.message}`);
    }
  }
};

/**
 * Get details of a specific map
 * @param {string|number} mapId - ID of the map to fetch
 * @returns {Promise<Object>} - Promise resolving to the map details
 */
export const getMapById = async (mapId) => {
  try {
    console.debug(`[MapService Debug] Fetching map ${mapId}`);
    const response = await api.get(`maps/${mapId}`);
    
    // Ensure file_url is HTTPS
    if (response.data && response.data.file_url) {
      // Convert HTTP to HTTPS if needed
      if (response.data.file_url.startsWith('http:')) {
        console.warn('[MapService] Converting HTTP URL to HTTPS:', response.data.file_url);
        response.data.file_url = response.data.file_url.replace(/^http:/i, 'https:');
      }
      
      // For non-protocol URLs that have a domain, add https://
      if (!response.data.file_url.startsWith('http') && 
          !response.data.file_url.startsWith('/') && 
          (response.data.file_url.includes('.') || response.data.file_url.includes('localhost'))) {
        console.warn('[MapService] Adding HTTPS protocol to URL:', response.data.file_url);
        response.data.file_url = 'https://' + response.data.file_url;
      }
    }
    
    // Also ensure content_url is HTTPS if present
    if (response.data && response.data.content_url) {
      if (response.data.content_url.startsWith('http:')) {
        console.warn('[MapService] Converting content_url from HTTP to HTTPS');
        response.data.content_url = response.data.content_url.replace(/^http:/i, 'https:');
      }
    }
    
    return response.data;
  } catch (error) {
    console.error(`[MapService Error] Failed to fetch map with ID ${mapId}:`, error);
    throw error;
  }
};

/**
 * Delete a specific map
 * @param {string|number} mapId - ID of the map to delete
 * @returns {Promise<Object>} - Promise resolving to the deletion result
 */
export const deleteMap = async (mapId) => {
  try {
    console.debug(`[MapService Debug] Deleting map ${mapId}`);
    const response = await api.delete(`maps/${mapId}`);
    return response.data;
  } catch (error) {
    console.error(`[MapService Error] Failed to delete map with ID ${mapId}:`, error);
    
    // Handle different error types
    if (error.response) {
      const status = error.response.status;
      
      if (status === 404) {
        throw new Error('Map not found. It may have been already deleted.');
      } else if (status === 401) {
        throw new Error('Unauthorized. Please log in again.');
      } else if (status === 403) {
        throw new Error('You do not have permission to delete this map.');
      } else if (status === 409) {
        throw new Error('Cannot delete map as it is currently in use.');
      } else {
        throw new Error(`Server error (${status}): ${error.response.data.detail || 'Unknown error'}`);
      }
    } else if (error.request) {
      throw new Error('No response from server. Please check your connection and try again.');
    } else {
      throw new Error(`Error: ${error.message}`);
    }
  }
};

/**
 * Update a specific map's metadata
 * @param {string|number} mapId - ID of the map to update
 * @param {Object} updateData - Data to update (name, description, etc.)
 * @returns {Promise<Object>} - Promise resolving to the updated map
 */
export const updateMap = async (mapId, updateData) => {
  try {
    console.debug(`[MapService Debug] Updating map ${mapId}`);
    const response = await api.patch(`maps/${mapId}`, updateData);
    return response.data;
  } catch (error) {
    console.error(`[MapService Error] Failed to update map with ID ${mapId}:`, error);
    
    if (error.response) {
      const status = error.response.status;
      
      if (status === 404) {
        throw new Error('Map not found.');
      } else if (status === 401) {
        throw new Error('Unauthorized. Please log in again.');
      } else if (status === 403) {
        throw new Error('You do not have permission to update this map.');
      } else {
        throw new Error(`Server error (${status}): ${error.response.data.detail || 'Unknown error'}`);
      }
    } else if (error.request) {
      throw new Error('No response from server. Please check your connection and try again.');
    } else {
      throw new Error(`Error: ${error.message}`);
    }
  }
};

/**
 * Create a new map (alternative method)
 * @param {FormData} formData - Form data with map file and metadata
 * @returns {Promise<Object>} - Promise resolving to the created map
 */
export const createMap = async (formData) => {
  try {
    console.debug('[MapService Debug] Creating map with formData');
    const response = await api.post('maps', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });
    return response.data;
  } catch (error) {
    console.error('[MapService Error] Failed to create map:', error);
    
    if (error.response) {
      const status = error.response.status;
      
      if (status === 400) {
        throw new Error('Invalid map data. Please check the file and try again.');
      } else if (status === 401) {
        throw new Error('Unauthorized. Please log in again.');
      } else if (status === 403) {
        throw new Error('You do not have permission to create maps.');
      } else {
        throw new Error(`Server error (${status}): ${error.response.data.detail || 'Unknown error'}`);
      }
    } else if (error.request) {
      throw new Error('No response from server. Please check your connection and try again.');
    } else {
      throw new Error(`Error: ${error.message}`);
    }
  }
};

/**
 * Get a preview image for a specific map
 * @param {string|number} mapId - ID of the map to get a preview for
 * @returns {Promise<string>} - Promise resolving to the preview URL
 */
export const getMapPreview = async (mapId) => {
  try {
    console.debug(`[MapService Debug] Fetching preview for map ${mapId}`);
    const response = await api.get(`maps/${mapId}/preview`);
    
    if (response.data && response.data.preview_url) {
      return ensureHttps(response.data.preview_url);
    }
    
    return null;
  } catch (error) {
    console.error(`[MapService Error] Failed to fetch preview for map ${mapId}:`, error);
    return null;
  }
};

/**
 * Perform API connectivity diagnostics to identify issues
 * @returns {Promise<Object>} - Promise resolving to diagnostic results
 */
export const performApiDiagnostics = async () => {
  const results = {
    success: false,
    health: null,
    endpoints: {},
    errors: [],
    suggestions: []
  };
  
  try {
    console.log('[MapService Diagnostics] Starting API connectivity tests');
    
    // Check base URL configuration
    const baseUrl = api.defaults.baseURL;
    results.baseUrl = baseUrl;
    results.endpoints.baseUrlValid = baseUrl && baseUrl.includes('/api/v1');
    
    if (!results.endpoints.baseUrlValid) {
      results.errors.push(`API base URL doesn't look right: ${baseUrl}`);
      results.suggestions.push('Check the API_URL setting in config.js');
    }
    
    // Test health endpoint
    try {
      console.log('[MapService Diagnostics] Testing health endpoint');
      const healthResponse = await fetch(`${baseUrl.replace('/api/v1', '')}/health`);
      results.health = {
        status: healthResponse.status,
        ok: healthResponse.ok
      };
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        results.health.data = healthData;
        console.log('[MapService Diagnostics] Health endpoint response:', healthData);
      }
    } catch (healthError) {
      results.health = {
        status: 'error',
        error: healthError.message
      };
      results.errors.push(`Health endpoint error: ${healthError.message}`);
    }
    
    // Test project endpoint
    try {
      console.log('[MapService Diagnostics] Testing projects endpoint');
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const projectsResponse = await fetch(`${baseUrl}/projects`, { headers });
      results.endpoints.projects = {
        status: projectsResponse.status,
        ok: projectsResponse.ok
      };
      
      if (projectsResponse.ok) {
        console.log('[MapService Diagnostics] Projects endpoint OK');
      } else {
        results.errors.push(`Projects endpoint error: ${projectsResponse.status} ${projectsResponse.statusText}`);
      }
    } catch (projectsError) {
      results.endpoints.projects = {
        status: 'error',
        error: projectsError.message
      };
      results.errors.push(`Projects endpoint error: ${projectsError.message}`);
    }
    
    // Test maps endpoint
    try {
      console.log('[MapService Diagnostics] Testing maps endpoint');
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const mapsResponse = await fetch(`${baseUrl}/maps`, { headers });
      results.endpoints.maps = {
        status: mapsResponse.status,
        ok: mapsResponse.status !== 404
      };
      
      if (mapsResponse.ok) {
        console.log('[MapService Diagnostics] Maps endpoint OK');
      } else if (mapsResponse.status === 401) {
        console.log('[MapService Diagnostics] Maps endpoint requires authentication (expected)');
        results.endpoints.maps.auth = true;
      } else if (mapsResponse.status === 404) {
        results.errors.push('Maps endpoint not found (404)');
      } else {
        results.errors.push(`Maps endpoint error: ${mapsResponse.status} ${mapsResponse.statusText}`);
      }
    } catch (mapsError) {
      results.endpoints.maps = {
        status: 'error',
        error: mapsError.message
      };
      results.errors.push(`Maps endpoint error: ${mapsError.message}`);
    }
    
    // Final evaluation
    results.success = results.health?.ok && (
      results.endpoints.projects?.ok || 
      results.endpoints.maps?.auth || 
      results.endpoints.maps?.ok
    );
    
    if (results.success) {
      results.suggestions.push('API connectivity appears good. If issues persist, check project_id parameter.');
    } else {
      if (results.errors.some(e => e.includes('401'))) {
        results.suggestions.push('Authentication issues detected. Try logging in again.');
      }
      if (results.errors.some(e => e.includes('404'))) {
        results.suggestions.push('Endpoint not found errors. Verify API base URL and backend deployment.');
      }
      if (results.errors.some(e => e.includes('Network Error') || e.includes('Failed to fetch'))) {
        results.suggestions.push('Network connectivity issues. Check for CORS/mixed content problems.');
      }
    }
    
    console.log('[MapService Diagnostics] Complete:', results);
    return results;
  } catch (error) {
    console.error('[MapService Diagnostics] Failed:', error);
    results.errors.push(`Diagnostic error: ${error.message}`);
    return results;
  }
}; 