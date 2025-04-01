import translations from './translations';

// Default language
const DEFAULT_LANGUAGE = 'en';
const LANGUAGE_KEY = 'app_language';

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
 * Translates a given English text to Spanish if current language is Spanish
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

export default translate; 