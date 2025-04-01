import React, { useCallback } from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useTranslation } from './TranslationProvider';

/**
 * Language Switcher component that displays a button to toggle between English and Spanish
 */
const LanguageSwitcher = () => {
  const { currentLanguage, toggleLanguage, translate } = useTranslation();
  
  const handleToggle = useCallback(() => {
    const newLanguage = toggleLanguage();
    console.log('Switched language to:', newLanguage);
    
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
    
    // Force component to re-render (React may batch updates)
    setTimeout(() => {
      // This is a hack to force a re-render if needed
      const forceUpdateEvent = new Event('forceLanguageUpdate');
      window.dispatchEvent(forceUpdateEvent);
    }, 0);
  }, [toggleLanguage]);
  
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
        key={`lang-switch-${currentLanguage}`} // Force re-render when language changes
      >
        {currentLanguage === 'en' ? '🇪🇸 ES' : '🇺🇸 EN'}
      </Button>
    </OverlayTrigger>
  );
};

export default LanguageSwitcher; 