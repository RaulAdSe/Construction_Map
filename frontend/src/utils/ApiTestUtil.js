/**
 * API Test Utility
 * 
 * Provides tools to test API connectivity and diagnose issues.
 * Can be used via browser console for debugging deployment problems.
 */

import { API_URL, isHttps, ensureHttps } from '../config';
import { performApiDiagnostics } from '../services/mapService';

/**
 * Test basic API connectivity
 * @returns {Promise<Object>} - Results of API tests
 */
export const testApiConnectivity = async () => {
  console.log('🔍 API Test Utility - Testing connectivity');
  console.log('📡 API URL:', API_URL);
  console.log('🔒 Using HTTPS:', isHttps);
  
  // Run diagnostics
  try {
    const results = await performApiDiagnostics();
    console.log('✅ API diagnostics complete:', results);
    
    if (results.errors.length > 0) {
      console.error('❌ Problems detected:');
      results.errors.forEach(error => console.error(`  - ${error}`));
    }
    
    if (results.suggestions.length > 0) {
      console.log('💡 Suggestions:');
      results.suggestions.forEach(suggestion => console.log(`  - ${suggestion}`));
    }
    
    return results;
  } catch (error) {
    console.error('❌ API test failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Test a specific endpoint
 * @param {string} endpoint - Endpoint to test (without /api/v1)
 * @returns {Promise<Object>} - Results of endpoint test
 */
export const testEndpoint = async (endpoint) => {
  const fullUrl = `${API_URL}/${endpoint.replace(/^\//, '')}`;
  console.log(`🔍 Testing endpoint: ${endpoint}`);
  console.log(`📡 Full URL: ${fullUrl}`);
  
  try {
    // Get auth token if available
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    // Make the request
    const response = await fetch(fullUrl, { headers });
    
    // Basic response info
    const result = {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: {},
    };
    
    // Get headers
    response.headers.forEach((value, key) => {
      result.headers[key] = value;
    });
    
    // Try to get response body if possible
    try {
      if (response.headers.get('content-type')?.includes('application/json')) {
        result.data = await response.json();
      } else {
        result.text = await response.text();
      }
    } catch (bodyError) {
      result.bodyError = bodyError.message;
    }
    
    console.log(`✅ Response (${response.status}):`, result);
    return result;
  } catch (error) {
    console.error(`❌ Request failed:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Test maps endpoint with specific project ID
 * @param {string|number} projectId - Project ID to test with
 * @returns {Promise<Object>} - Results of maps endpoint test
 */
export const testMapsEndpoint = async (projectId) => {
  if (!projectId) {
    console.error('❌ Project ID is required');
    return { success: false, error: 'Project ID is required' };
  }
  
  console.log(`🔍 Testing maps endpoint with project_id=${projectId}`);
  
  // Test the endpoint
  return await testEndpoint(`maps?project_id=${projectId}`);
};

// Export as global for browser console use
if (typeof window !== 'undefined') {
  window.ApiTestUtil = {
    testApiConnectivity,
    testEndpoint,
    testMapsEndpoint,
    API_URL,
    isHttps
  };
  
  console.log('📊 API Test Utility available in console as ApiTestUtil');
  console.log('Try ApiTestUtil.testApiConnectivity() to diagnose issues');
}

export default {
  testApiConnectivity,
  testEndpoint,
  testMapsEndpoint
}; 