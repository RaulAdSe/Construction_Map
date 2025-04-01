import React, { createContext, useContext, useEffect } from 'react';
import translate, { 
  setLanguage, 
  getCurrentLanguage, 
  toggleLanguage,
  useLanguage
} from '../../utils/translate';

// Create a context for translation functions and language state
export const TranslationContext = createContext();

/**
 * Hook to use translations and language functions in any component
 * @returns {Object} translation utilities and current language
 */
export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

/**
 * Provider component that wraps the app to make translations available
 */
export const TranslationProvider = ({ children }) => {
  // Use our custom hook to track language and re-render on changes
  const currentLanguage = useLanguage();
  
  // Handler for toggling language
  const handleToggleLanguage = () => {
    const newLang = toggleLanguage();
    return newLang;
  };
  
  // Handler for setting a specific language
  const handleSetLanguage = (lang) => {
    setLanguage(lang);
  };
  
  // Value to provide to the context
  const contextValue = {
    translate,
    currentLanguage,
    toggleLanguage: handleToggleLanguage,
    setLanguage: handleSetLanguage
  };
  
  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
};

export default TranslationProvider; 