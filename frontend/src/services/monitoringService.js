import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance with auth header
const getAuthAxios = () => {
  const token = localStorage.getItem('token');
  return axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
};

// Health check endpoints
export const getServiceHealth = async () => {
  const response = await getAuthAxios().get('/api/v1/monitoring/health/service');
  return response.data;
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
  const response = await getAuthAxios().get('/api/v1/monitoring/health/system');
  return response.data;
};

// Metrics endpoints
export const getSystemMetrics = async () => {
  const response = await getAuthAxios().get('/api/v1/monitoring/metrics/system');
  return response.data;
};

export const getMetrics = async ({ name, startTime, endTime, limit, offset } = {}) => {
  let url = '/api/v1/monitoring/metrics';
  
  const params = {};
  if (name) params.name = name;
  if (startTime) params.start_time = startTime;
  if (endTime) params.end_time = endTime;
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;
  
  const response = await getAuthAxios().get(url, { params });
  return response.data;
};

export const createMetric = async (metricData) => {
  const response = await getAuthAxios().post('/api/v1/monitoring/metrics', metricData);
  return response.data;
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
  
  const response = await getAuthAxios().get(url, { params });
  return response.data;
};

export const getErrorLogs = async ({ limit = 100 } = {}) => {
  return getLogs({ level: 'ERROR', limit });
};

export const getSlowQueries = async ({ fromLog = false, limit = 50 } = {}) => {
  const params = { from_log: fromLog, limit };
  const response = await getAuthAxios().get('/api/v1/monitoring/logs/queries', { params });
  return response.data;
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
  
  const response = await getAuthAxios().get(url, { params });
  return response.data;
};

export const recordUserActivity = async (activityData) => {
  const response = await getAuthAxios().post('/api/v1/monitoring/user-activity', activityData);
  return response.data;
};

export const getUserActivityStats = async () => {
  try {
    const response = await getAuthAxios().get(`${API_URL}/api/v1/monitoring/user-activity/stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user activity statistics:', error);
    throw error;
  }
};

export const triggerUserActivityCleanup = async () => {
  try {
    const response = await getAuthAxios().post(`${API_URL}/api/v1/monitoring/user-activity/cleanup`);
    return response.data;
  } catch (error) {
    console.error('Error triggering user activity cleanup:', error);
    throw error;
  }
}; 