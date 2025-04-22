import axios from 'axios';
import { API_URL, ensureHttps } from '../config';

// Always use cloud URL to avoid localhost references in production
const AUTH_URL = ensureHttps(`${API_URL}/auth`);

// Create instance with default config
const api = axios.create({
  baseURL: AUTH_URL,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Add interceptor to force HTTPS
api.interceptors.request.use(config => {
  // Always ensure URL uses HTTPS
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
  
  // Only add token for non-login/register requests
  if (!config.url || (!config.url.includes('/login') && !config.url.includes('/register'))) {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  
  return config;
}, (error) => {
  console.error('Request error:', error);
  return Promise.reject(error);
});

// Check if token is expired
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    // JWT tokens are base64Url encoded in three parts: header.payload.signature
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const { exp } = JSON.parse(jsonPayload);
    
    // Check if expired (exp is in seconds, Date.now() is in milliseconds)
    return Date.now() >= exp * 1000;
  } catch (e) {
    console.error('Error checking token expiration:', e);
    return true; // If any error occurs, consider the token expired
  }
};

// Clear token if it's expired
export const clearExpiredToken = () => {
  const token = localStorage.getItem('token');
  if (token && isTokenExpired(token)) {
    console.log('Clearing expired token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return true;
  }
  return false;
};

export const login = async (username, password) => {
  try {
    console.log('Attempting login with API URL:', AUTH_URL);
    
    // Clear any expired tokens before login attempt
    clearExpiredToken();
    
    // Use URLSearchParams for proper x-www-form-urlencoded format
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('grant_type', 'password');
    
    // Ensure login URL is using HTTPS
    const url = ensureHttps(`${AUTH_URL}/login`);
    
    // Send login request without Authorization header
    const response = await axios.post(url, params, {
      withCredentials: true,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    // Store the token and user data if available
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('Auth service stored user data:', response.data.user);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('No token found');
    }
    
    const response = await api.post(`${AUTH_URL}/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return response.data;
  } catch (error) {
    console.error('Logout error:', error);
    // Still remove token on error
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    throw error;
  }
};

export const checkAuth = async () => {
  try {
    // Check if token is expired before making the request
    if (clearExpiredToken()) {
      return false;
    }
    
    const token = localStorage.getItem('token');
    
    if (!token) {
      return false;
    }
    
    const response = await api.get(`${AUTH_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return !!response.data;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}; 