import axios from 'axios';
import { API_URL, ensureHttps } from '../config';
import api from '../api'; // Import the centralized API instance from the correct path

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

// Export the secure API domain and path for consistent usage
export const SECURE_API_DOMAIN = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app';
export const SECURE_API_PATH = '/api/v1';
export const SECURE_API_URL = `${SECURE_API_DOMAIN}${SECURE_API_PATH}`;

// For debugging only
console.info('[MapService] Using secure API URL:', SECURE_API_URL);

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
  try {
    console.log('[MapService] Using direct secure URL:', `${SECURE_API_URL}/maps/?project_id=${projectId}`);
    const response = await api.get(`/maps/?project_id=${projectId}`);
    
    // Process maps and convert URLs to https
    return response.data.map(map => {
      if (map.file_url && map.file_url.startsWith('http:')) {
        map.file_url = map.file_url.replace('http:', 'https:');
      }
      return map;
    });
  } catch (error) {
    console.error(`[MapService Error] Failed to fetch maps for project ${projectId}:`, error);
    
    // TEMPORARY FIX: Return empty array instead of throwing error to prevent app crash
    console.warn("[MapService] Returning empty array due to backend error. Please check server logs.");
    return [];
  }
};

/**
 * Upload a new map to a project
 * @param {string|number} projectId - ID of the project to add the map to
 * @param {string} name - Name of the map
 * @param {File} file - The map file to upload
 * @param {string} mapType - Type of map (implantation or overlay)
 * @param {Object} [additionalMetadata] - Any additional metadata for the map
 * @returns {Promise<Object>} - Promise resolving to the newly created map
 */
export const addMap = async (projectId, name, file, mapType, additionalMetadata = {}) => {
  if (!projectId || !file || !name) {
    throw new Error('Project ID, name and file are required');
  }
  
  try {
    console.debug(`[MapService Debug] Uploading map to project ${projectId}`);
    
    // Prepare form data for the upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);
    formData.append('name', name);
    formData.append('map_type', mapType || 'overlay');
    
    // Add any additional metadata
    if (additionalMetadata.description) {
      formData.append('description', additionalMetadata.description);
    }
    
    if (additionalMetadata.transform_data) {
      formData.append('transform_data', JSON.stringify(additionalMetadata.transform_data));
    }
    
    // Use simple endpoint and let interceptor standardize it
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
      } else if (status === 422) {
        // Handle validation errors from FastAPI
        const errorDetail = error.response.data.detail;
        console.log('Validation error details:', errorDetail);
        
        if (Array.isArray(errorDetail)) {
          // Extract meaningful error messages from FastAPI validation errors
          const errorMsgs = errorDetail.map(err => {
            // Get field name (last item in loc array)
            const field = err.loc[err.loc.length - 1];
            
            // Map common errors to user-friendly messages
            if (err.type === 'value_error.missing') {
              return `The ${field} field is required`;
            }
            
            if (err.type === 'type_error.none.not_allowed') {
              return `The ${field} field cannot be empty`;
            }
            
            // Return the original message if no mapping exists
            return `${field}: ${err.msg}`;
          });
          
          throw new Error(`Please check your map data: ${errorMsgs.join(', ')}`);
        } else {
          // For non-array errors, try to extract a meaningful message
          const errorMsg = typeof errorDetail === 'string' 
            ? errorDetail
            : JSON.stringify(errorDetail);
            
          throw new Error(`Server validation error: ${errorMsg}`);
        }
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
    
    // Use simpler path structure - let the interceptor standardize it
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
    
    // Use simple path format - interceptor will standardize it
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
    
    // Use simple path format - interceptor will standardize it
    const response = await api.put(`maps/${mapId}`, updateData);
    
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
    // Use simple path and let interceptor handle standardization
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
    
    // Use the correct endpoint pattern from documentation
    const response = await api.get(`maps/${mapId}/preview`);
    
    // For debugging in case of issues
    console.log(`[MapService] Map preview request URL: ${api.defaults.baseURL}/maps/${mapId}/preview`);
    
    if (response.data && response.data.preview_url) {
      return ensureHttps(response.data.preview_url);
    }
    
    return null;
  } catch (error) {
    console.error(`[MapService Error] Failed to fetch preview for map ${mapId}:`, error);
    
    // Check specifically for HTTP/HTTPS mixed content issues
    if (error.message && error.message.includes('Network Error')) {
      console.error('[MapService] Possible mixed content issue when fetching map preview. Check HTTPS configuration.');
    }
    
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