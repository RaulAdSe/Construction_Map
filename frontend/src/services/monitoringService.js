import axios from 'axios';

// Extract the base URL without the /api/v1 part
const getBaseUrl = () => {
  // If REACT_APP_API_URL is defined
  if (process.env.REACT_APP_API_URL) {
    // If it ends with /api/v1, remove it to get the base URL
    if (process.env.REACT_APP_API_URL.endsWith('/api/v1')) {
      return process.env.REACT_APP_API_URL.slice(0, -7); // Remove '/api/v1'
    }
    // Otherwise check if it has /api/v1/ in the middle (for potential cloud URLs)
    if (process.env.REACT_APP_API_URL.includes('/api/v1/')) {
      return process.env.REACT_APP_API_URL.split('/api/v1/')[0];
    }
    // If neither, return as is
    return process.env.REACT_APP_API_URL;
  }
  // Default to localhost:8000
  return 'http://localhost:8000';
};

const BASE_URL = getBaseUrl();

// Create axios instance with auth header
const getAuthAxios = () => {
  const token = localStorage.getItem('token');
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
};

// Health check endpoints
export const getServiceHealth = async () => {
  try {
    const response = await getAuthAxios().get('/api/v1/monitoring/health/service');
    return response.data;
  } catch (error) {
    console.error('Error fetching service health:', error);
    throw error;
  }
};

export const getDatabaseHealth = async () => {
  try {
    const response = await getAuthAxios().get('/api/v1/monitoring/health/db');
    return response.data;
  } catch (error) {
    console.error('Error fetching database health:', error);
    
    // Return a default error state if the backend request fails
    if (error.response) {
      // The server responded with a status code outside the 2xx range
      console.error('Server error:', error.response.data);
    }
    
    throw error;
  }
};

export const getSystemHealth = async () => {
  try {
    const response = await getAuthAxios().get('/api/v1/monitoring/health/system');
    return response.data;
  } catch (error) {
    console.error('Error fetching system health:', error);
    throw error;
  }
};

// Metrics endpoints
export const getSystemMetrics = async () => {
  try {
    const response = await getAuthAxios().get('/api/v1/monitoring/metrics/system');
    return response.data;
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    throw error;
  }
};

export const getMetrics = async ({ name, startTime, endTime, limit, offset } = {}) => {
  let url = '/api/v1/monitoring/metrics';
  
  const params = {};
  if (name) params.name = name;
  if (startTime) params.start_time = startTime;
  if (endTime) params.end_time = endTime;
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;
  
  try {
    const response = await getAuthAxios().get(url, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching metrics:', error);
    throw error;
  }
};

export const createMetric = async (metricData) => {
  try {
    const response = await getAuthAxios().post('/api/v1/monitoring/metrics', metricData);
    return response.data;
  } catch (error) {
    console.error('Error creating metric:', error);
    throw error;
  }
};

// Logs endpoints
export const getLogs = async ({ level, startTime, endTime, search, limit } = {}) => {
  let url = '/api/v1/monitoring/logs';
  
  const params = {};
  if (level) params.level = level;
  if (startTime) params.start_time = startTime;
  if (endTime) params.end_time = endTime;
  if (search) params.search = search;
  if (limit) params.limit = limit;
  
  try {
    const response = await getAuthAxios().get(url, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
};

export const getErrorLogs = async ({ limit = 100 } = {}) => {
  return getLogs({ level: 'ERROR', limit });
};

export const getSlowQueries = async ({ fromLog = false, limit = 50 } = {}) => {
  const params = { from_log: fromLog, limit };
  try {
    const response = await getAuthAxios().get('/api/v1/monitoring/logs/queries', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching slow queries:', error);
    throw error;
  }
};

// User activity endpoints
export const getUserActivity = async ({ userId, username, action, userType, startTime, endTime, limit = 50 } = {}) => {
  let url = '/api/v1/monitoring/user-activity';
  
  const params = {};
  if (userId) params.user_id = userId;
  if (username) params.username = username;
  if (action) params.action = action;
  if (userType) params.user_type = userType;
  if (startTime) params.start_time = startTime;
  if (endTime) params.end_time = endTime;
  if (limit) params.limit = limit;
  
  try {
    const response = await getAuthAxios().get(url, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching user activities:', error);
    throw error;
  }
};

export const recordUserActivity = async (activityData) => {
  try {
    const response = await getAuthAxios().post('/api/v1/monitoring/user-activity', activityData);
    return response.data;
  } catch (error) {
    console.error('Error recording user activity:', error);
    throw error;
  }
};

export const getUserActivityStats = async () => {
  try {
    const response = await getAuthAxios().get('/api/v1/monitoring/user-activity/stats');
    return response.data;
  } catch (error) {
    console.error('Error fetching user activity statistics:', error);
    throw error;
  }
};

export const triggerUserActivityCleanup = async () => {
  try {
    const response = await getAuthAxios().post('/api/v1/monitoring/user-activity/cleanup');
    return response.data;
  } catch (error) {
    console.error('Error triggering user activity cleanup:', error);
    throw error;
  }
}; 