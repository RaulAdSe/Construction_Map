import axios from 'axios';

// Add debug flag to control console output
const DEBUG = true; // Set to true to help troubleshoot the current issues

const API_URL = 'http://localhost:8000/api/v1';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 10000, // 10 second timeout
});

// Add auth token to requests if available
apiClient.interceptors.request.use((config) => {
  // Log all requests when debugging
  if (DEBUG) console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
  
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  if (DEBUG) console.error('Request error:', error);
  return Promise.reject(error);
});

// Track failed requests for potential retry
const failedRequestQueue = [];
let isRefreshing = false;

// Add response interceptor to handle common responses
apiClient.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    const originalRequest = error.config;
    
    // Log all errors in debug mode
    if (DEBUG) {
      if (error.response) {
        console.error('Response error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('Request error (no response):', error.request);
        console.error('Is this a CORS issue?', error.message.includes('Network Error'));
      } else {
        console.error('Error setting up request:', error.message);
      }
    }
    
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401) {
      if (DEBUG) console.warn('Unauthorized access, redirecting to login');
      // Check if we're not already on the login page to avoid redirect loops
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    
    // Handle CORS or network errors with retry logic
    if (!error.response && error.message.includes('Network Error') && !originalRequest._retry) {
      originalRequest._retry = true;
      
      if (DEBUG) console.log(`Retrying failed request to: ${originalRequest.url}`);
      
      try {
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return apiClient(originalRequest);
      } catch (retryError) {
        if (DEBUG) console.error('Retry failed:', retryError);
        return Promise.reject(retryError);
      }
    }
    
    // Handle 500 server errors with retry
    if (error.response && error.response.status === 500 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      if (DEBUG) console.log(`Retrying failed request after server error: ${originalRequest.url}`);
      
      try {
        // Wait 2 seconds before retrying a server error
        await new Promise(resolve => setTimeout(resolve, 2000));
        return apiClient(originalRequest);
      } catch (retryError) {
        if (DEBUG) console.error('Server error retry failed:', retryError);
        return Promise.reject(retryError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Export the apiClient instance
export { apiClient };
export default apiClient;

// Auth services
export const authService = {
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await apiClient.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
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
    return await apiClient.post('/auth/register', userData);
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// Project services
export const projectService = {
  getProjects: async () => {
    return await apiClient.get('/projects/');
  },
  
  getProject: async (id) => {
    return await apiClient.get(`/projects/${id}`);
  },
  
  createProject: async (projectData) => {
    return await apiClient.post('/projects/', projectData);
  },
  
  updateProject: async (id, projectData) => {
    return await apiClient.put(`/projects/${id}`, projectData);
  },
  
  deleteProject: async (id) => {
    return await apiClient.delete(`/projects/${id}`);
  },
  
  // Get all project tags
  getProjectTags: async (projectId) => {
    return await apiClient.get(`/projects/${projectId}/tags`);
  },
  
  // Get all project members
  getProjectMembers: async (projectId) => {
    return await apiClient.get(`/projects/${projectId}/members`);
  },
  
  // Add a user to project
  addUserToProject: async (projectId, userId) => {
    return await apiClient.post(`/projects/${projectId}/users`, { 
      user_id: userId
    });
  },
  
  // Update a member's admin status
  updateMemberRole: async (projectId, userId, isAdmin) => {
    return await apiClient.put(`/projects/${projectId}/members/${userId}/role`, {
      role: isAdmin ? "ADMIN" : "MEMBER" 
    });
  },
  
  // Update a member's field in a project
  updateMemberField: async (projectId, userId, field) => {
    console.log(`API call: updateMemberField for project ${projectId}, user ${userId}, field "${field}"`);
    try {
      // Ensure field is a string
      const fieldValue = String(field).trim();
      console.log(`Sending field update with value: "${fieldValue}"`);
      
      const response = await apiClient.put(`/projects/${projectId}/users/${userId}/field`, 
        { field: fieldValue },
        { 
          headers: {
            'Content-Type': 'application/json'
          }
        }
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
    return await apiClient.delete(`/projects/${projectId}/users/${userId}`);
  }
};

// Maps services
export const mapService = {
  getMaps: async () => {
    return await apiClient.get('/maps/');
  },
  
  getMap: async (id) => {
    return await apiClient.get(`/maps/${id}`);
  },
  
  createMap: async (mapData) => {
    const formData = new FormData();
    formData.append('project_id', mapData.project_id);
    formData.append('name', mapData.name);
    formData.append('file', mapData.file);
    
    return await apiClient.post('/maps/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  updateMap: async (id, mapData) => {
    const formData = new FormData();
    formData.append('name', mapData.name);
    
    if (mapData.file) {
      formData.append('file', mapData.file);
    }
    
    return await apiClient.put(`/maps/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  deleteMap: async (id) => {
    return await apiClient.delete(`/maps/${id}`);
  }
};

// Events services
export const eventService = {
  getEvents: async () => {
    return await apiClient.get('/events/');
  },
  
  getEvent: async (id) => {
    return await apiClient.get(`/events/${id}`);
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
    
    return await apiClient.post('/events/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  updateEvent: async (id, eventData) => {
    const formData = new FormData();
    
    if (eventData.title) formData.append('title', eventData.title);
    if (eventData.description) formData.append('description', eventData.description);
    if (eventData.status) formData.append('status', eventData.status);
    if (eventData.image) formData.append('image', eventData.image);
    
    return await apiClient.put(`/events/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  deleteEvent: async (id) => {
    return await apiClient.delete(`/events/${id}`);
  }
}; 