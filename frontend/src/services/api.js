import axios from 'axios';

// Add debug flag to control console output
const DEBUG = true;  // Enable debug mode for development

const API_URL = 'http://localhost:8000/api/v1';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

// Development mode helper - creates a dummy token if none exists
const ensureDevToken = () => {
  if (process.env.NODE_ENV === 'development') {
    // Only create a token in development mode
    const token = localStorage.getItem('token');
    if (!token) {
      if (DEBUG) console.log('Creating development token for local testing');
      // This is a dummy token for development only - it will be accepted in DEBUG mode
      const devToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.devtoken';
      localStorage.setItem('token', devToken);
      return devToken;
    }
    return token;
  }
  return localStorage.getItem('token');
};

// Add auth token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = ensureDevToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    if (DEBUG) console.log(`Request to ${config.url} with auth token`);
  } else {
    if (DEBUG) console.warn(`Request to ${config.url} without auth token`);
  }
  return config;
}, (error) => {
  if (DEBUG) console.error('Request error:', error);
  return Promise.reject(error);
});

// Add response interceptor to handle common responses
apiClient.interceptors.response.use(
  response => {
    if (DEBUG) console.log(`Response from ${response.config.url}: status ${response.status}`);
    return response;
  },
  error => {
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401) {
      if (DEBUG) console.warn(`Unauthorized access to ${error.config.url}, creating new dev token`);
      
      // In development mode, try regenerating the token
      if (process.env.NODE_ENV === 'development') {
        localStorage.removeItem('token');
        ensureDevToken();
        // Don't redirect, just regenerate the token
        return axios(error.config);  // Retry the request with new token
      }
      
      // In production, redirect to login
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    
    // Log other errors only when debugging is enabled
    if (DEBUG) {
      if (error.response) {
        console.error('Response error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('Request error (no response):', error.request);
      } else {
        console.error('Error setting up request:', error.message);
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