import React, { useCallback } from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useMobile } from './MobileProvider';
import translate from '../../utils/translate';

/**
 * Mobile Mode Switcher component that displays a button to toggle between desktop and mobile views
 */
const MobileSwitcher = () => {
  const { isMobile, toggleMobileMode } = useMobile();
  
  const handleToggle = useCallback(() => {
    const newMode = toggleMobileMode();
    console.log('Switched to', newMode ? 'mobile' : 'desktop', 'mode');
    
    // Force component to re-render (React may batch updates)
    setTimeout(() => {
      // This is a hack to force a re-render if needed
      const forceUpdateEvent = new Event('forceMobileUpdate');
      window.dispatchEvent(forceUpdateEvent);
    }, 0);
  }, [toggleMobileMode]);
  
  const tooltip = (
    <Tooltip id="mobile-tooltip">
      {isMobile 
        ? translate('Switch to Desktop View') 
        : translate('Switch to Mobile View')}
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
        className="mobile-switcher"
        aria-label={`Switch to ${isMobile ? 'Desktop' : 'Mobile'} View`}
        key={`mobile-switch-${isMobile}`} // Force re-render when mode changes
      >
        {isMobile ? '💻' : '📱'}
      </Button>
    </OverlayTrigger>
  );
};

export default MobileSwitcher; 