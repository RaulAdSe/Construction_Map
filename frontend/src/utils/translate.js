import translations from './translations';

/**
 * Translates a given English text to Spanish
 * @param {string} text - The English text to translate
 * @param {object} customArgs - Optional replacement variables
 * @returns {string} - The translated Spanish text or the original if no translation exists
 */
export const translate = (text, customArgs = {}) => {
  if (!text) return '';
  
  let translatedText = translations[text] || text;
  
  // Handle any custom arguments/variables in the text
  if (Object.keys(customArgs).length > 0) {
    Object.keys(customArgs).forEach(key => {
      translatedText = translatedText.replace(`{${key}}`, customArgs[key]);
    });
  }
  
  return translatedText;
};

export default translate; 