import translations from './translations';
import { useState, useEffect } from 'react';

// Default language
const DEFAULT_LANGUAGE = 'en';
const LANGUAGE_KEY = 'app_language';

// Track language changes with a simple subscription system
let listeners = [];
// Create a version counter to force re-renders
let versionCounter = 0;

/**
 * Get the current language from localStorage or use default
 * @returns {string} The current language code ('en' or 'es')
 */
export const getCurrentLanguage = () => {
  return localStorage.getItem(LANGUAGE_KEY) || DEFAULT_LANGUAGE;
};

/**
 * Set the current language in localStorage
 * @param {string} languageCode - The language code to set ('en' or 'es')
 */
export const setLanguage = (languageCode) => {
  if (languageCode === 'en' || languageCode === 'es') {
    localStorage.setItem(LANGUAGE_KEY, languageCode);
    // Increment version counter
    versionCounter++;
    // Notify all listeners
    listeners.forEach(listener => listener(languageCode, versionCounter));
    // Force a re-render by dispatching a custom event
    window.dispatchEvent(new Event('languageChange'));
  }
};

/**
 * Toggle between English and Spanish languages
 * @returns {string} The new language code after toggling
 */
export const toggleLanguage = () => {
  const currentLang = getCurrentLanguage();
  const newLang = currentLang === 'en' ? 'es' : 'en';
  setLanguage(newLang);
  return newLang;
};

/**
 * Subscribe to language changes
 * @param {Function} callback - Function to call when language changes
 * @returns {Function} Unsubscribe function
 */
export const onLanguageChange = (callback) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(listener => listener !== callback);
  };
};

/**
 * Hook to make components re-render when language changes
 * @returns {Object} Current language code and version
 */
export const useLanguage = () => {
  const [state, setState] = useState({
    language: getCurrentLanguage(),
    version: versionCounter
  });
  
  useEffect(() => {
    const handleLanguageChange = (lang, version) => {
      setState({ language: lang, version });
    };
    
    // Listen for language changes
    window.addEventListener('languageChange', () => {
      setState({ 
        language: getCurrentLanguage(), 
        version: versionCounter 
      });
    });
    
    const unsubscribe = onLanguageChange(handleLanguageChange);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange);
      unsubscribe();
    };
  }, []);
  
  return state.language;
};

/**
 * Translates a given English text to Spanish if current language is Spanish
 * Uses the language hook to ensure re-render on language changes
 * @param {string} text - The English text to translate
 * @param {object} customArgs - Optional replacement variables
 * @returns {string} - The translated text based on current language or the original if no translation exists
 */
export const translate = (text, customArgs = {}) => {
  if (!text) return '';
  
  // Only translate if language is Spanish
  const currentLang = getCurrentLanguage();
  let translatedText = currentLang === 'es' ? (translations[text] || text) : text;
  
  // Handle any custom arguments/variables in the text
  if (Object.keys(customArgs).length > 0) {
    Object.keys(customArgs).forEach(key => {
      translatedText = translatedText.replace(`{${key}}`, customArgs[key]);
    });
  }
  
  return translatedText;
};

/**
 * React component wrapper for translate to ensure re-renders
 * @param {Object} props - Component props
 * @param {string} props.text - Text to translate
 * @param {Object} props.args - Custom arguments
 * @returns {string} Translated text
 */
export const Translate = ({ text, args = {} }) => {
  // Using the hook ensures this component re-renders on language change
  useLanguage();
  return translate(text, args);
};

export default translate; 