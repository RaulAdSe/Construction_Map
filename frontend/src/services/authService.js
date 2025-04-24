import axios from 'axios';
import { API_URL, API_PATH, FULL_API_URL, ensureHttps } from '../config';

// Debug the values from config
console.log('[Auth Debug] Base URL:', API_URL);
console.log('[Auth Debug] API Path:', API_PATH);
console.log('[Auth Debug] Full API URL:', FULL_API_URL);

// Create instance with default config - using the base URL
const api = axios.create({
  baseURL: API_URL,
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

// Clear token if expired
export const clearExpiredToken = () => {
  const token = localStorage.getItem('token');
  if (token && isTokenExpired(token)) {
    console.warn('[Auth] Token expired, removing from storage');
    localStorage.removeItem('token');
    return true; // Token was expired and removed
  }
  return false; // Token is still valid or doesn't exist
};

// Add this function to check token before API calls
export const checkTokenBeforeApiCall = () => {
  const wasExpired = clearExpiredToken();
  if (wasExpired) {
    console.warn('[Auth] Expired token detected before API call - redirecting to login');
    // Only redirect if not already on login page
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    return false;
  }
  return true;
};

export const login = async (username, password) => {
  try {
    // Clear any expired tokens first
    clearExpiredToken();
    
    // Construct proper login URL using the full API URL
    const loginUrl = `${FULL_API_URL}/auth/login`;
    console.log('[Auth] Using login URL:', loginUrl);
    
    // Create form data
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('grant_type', 'password');
    
    // Make request
    const response = await axios.post(loginUrl, formData, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      withCredentials: true
    });
    
    // Store token and user data
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('[Auth] User data stored successfully');
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('[Auth] Login error:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('No token found');
    }
    
    // Construct proper logout URL
    const logoutUrl = `${FULL_API_URL}/auth/logout`;
    console.log('[Auth] Using logout URL:', logoutUrl);
    
    // Make request
    const response = await axios.post(logoutUrl, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    // Always clear tokens
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    return response.data;
  } catch (error) {
    console.error('[Auth] Logout error:', error);
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
    
    // Construct proper me URL
    const meUrl = `${FULL_API_URL}/auth/me`;
    console.log('[Auth] Using auth check URL:', meUrl);
    
    // Make request
    const response = await axios.get(meUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      withCredentials: true
    });
    
    return !!response.data;
  } catch (error) {
    console.error('[Auth] Auth check error:', error);
    return false;
  }
}; 