import React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useTranslation } from './TranslationProvider';

/**
 * Language Switcher component that displays a button to toggle between English and Spanish
 */
const LanguageSwitcher = () => {
  const { currentLanguage, toggleLanguage, translate } = useTranslation();
  
  const handleToggle = () => {
    const newLanguage = toggleLanguage();
    
    // Update user's language preference if they're logged in
    try {
      const userDataStr = localStorage.getItem('user');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        userData.language_preference = newLanguage;
        localStorage.setItem('user', JSON.stringify(userData));
        console.log('Updated user language preference:', newLanguage);
      }
    } catch (error) {
      console.error('Error saving user language preference:', error);
    }
  };
  
  const tooltip = (
    <Tooltip id="language-tooltip">
      {currentLanguage === 'en' 
        ? 'Cambiar a Español' 
        : 'Switch to English'}
    </Tooltip>
  );
  
  return (
    <OverlayTrigger
      placement="bottom"
      overlay={tooltip}
    >
      <Button 
        variant="outline-light" 
        onClick={handleToggle}
        className="language-switcher"
        aria-label={`Switch to ${currentLanguage === 'en' ? 'Spanish' : 'English'}`}
      >
        {currentLanguage === 'en' ? '🇪🇸 ES' : '🇺🇸 EN'}
      </Button>
    </OverlayTrigger>
  );
};

export default LanguageSwitcher; 