import React, { createContext, useContext } from 'react';
import translate from '../../utils/translate';

// Create a context for the translation function
export const TranslationContext = createContext();

/**
 * Hook to use translations in any component
 * @returns {Function} translate function
 */
export const useTranslation = () => {
  const t = useContext(TranslationContext);
  if (!t) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return t;
};

/**
 * Provider component that wraps the app to make translations available
 */
export const TranslationProvider = ({ children }) => {
  return (
    <TranslationContext.Provider value={translate}>
      {children}
    </TranslationContext.Provider>
  );
};

export default TranslationProvider; 