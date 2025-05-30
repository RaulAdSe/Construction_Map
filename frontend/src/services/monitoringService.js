import axios from 'axios';
import { ensureHttps } from '../config';

// Use HTTPS for the base URL
const BASE_URL = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app';

// Create axios instance with auth header
const getAuthAxios = () => {
  const token = localStorage.getItem('token');
  const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  // Add interceptor to force HTTPS
  axiosInstance.interceptors.request.use(config => {
    // Ensure URL uses HTTPS
    if (config.url) {
      // If it's an absolute URL (contains ://)
      if (config.url.includes('://')) {
        config.url = config.url.replace(/^http:\/\//i, 'https://');
      }
    }
    
    // Also ensure baseURL uses HTTPS
    if (config.baseURL && config.baseURL.includes('://')) {
      config.baseURL = config.baseURL.replace(/^http:\/\//i, 'https://');
    }
    
    return config;
  });
  
  return axiosInstance;
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