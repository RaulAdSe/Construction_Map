import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MapViewer from './pages/MapViewer';
import ProjectList from './pages/ProjectList';
import './assets/styles/App.css';
import { TranslationProvider } from './components/common/TranslationProvider';
import { MobileProvider } from './components/common/MobileProvider';
import { setLanguage } from './utils/translate';
import { checkAuth, clearExpiredToken } from './services/authService';
// Import API Test Utility for debugging
import './utils/ApiTestUtil';
// Import z-index fixes (should be imported last to override other styles)
import './assets/styles/zindex-fix.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Add state variables to force re-render on language/mobile mode changes
  const [languageKey, setLanguageKey] = useState(0);
  const [mobileKey, setMobileKey] = useState(0);
  
  useEffect(() => {
    // Listen for forced language updates
    const handleForceLanguageUpdate = () => {
      setLanguageKey(prev => prev + 1);
    };
    window.addEventListener('forceLanguageUpdate', handleForceLanguageUpdate);
    
    // Listen for forced mobile mode updates
    const handleForceMobileUpdate = () => {
      setMobileKey(prev => prev + 1);
    };
    window.addEventListener('forceMobileUpdate', handleForceMobileUpdate);
    
    return () => {
      window.removeEventListener('forceLanguageUpdate', handleForceLanguageUpdate);
      window.removeEventListener('forceMobileUpdate', handleForceMobileUpdate);
    };
  }, []);
  
  useEffect(() => {
    // Clear expired tokens on app startup
    clearExpiredToken();
    
    // Check if user is authenticated
    const checkAuthentication = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        setIsAuthenticated(true);
        
        // Load user's language preference
        try {
          const userData = JSON.parse(localStorage.getItem('user') || '{}');
          if (userData.language_preference) {
            // Set language based on user preference
            setLanguage(userData.language_preference);
            console.log('Loaded user language preference:', userData.language_preference);
          }
        } catch (error) {
          console.error('Error loading user language preference:', error);
        }
      }
    };
    
    checkAuthentication();
  }, []);
  
  const handleLogin = () => {
    setIsAuthenticated(true);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };
  
  return (
    <TranslationProvider>
      <MobileProvider>
        <Router>
          <Routes key={`routes-${languageKey}-${mobileKey}`}>
            <Route 
              path="/" 
              element={isAuthenticated ? <Navigate to="/projects" /> : <LoginPage onLogin={handleLogin} />} 
            />
            <Route 
              path="/projects" 
              element={isAuthenticated ? <ProjectList onLogout={handleLogout} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/project/:projectId" 
              element={isAuthenticated ? <MapViewer onLogout={handleLogout} /> : <Navigate to="/" />} 
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </MobileProvider>
    </TranslationProvider>
  );
}

export default App; 