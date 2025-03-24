import React, { useEffect, useState } from 'react';
import { Toast } from 'react-bootstrap';

const Notification = ({ show, message, type = 'success' }) => {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [show, message]);
  
  // Map type to Bootstrap variant
  const getVariant = () => {
    switch (type) {
      case 'error':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      case 'success':
      default:
        return 'success';
    }
  };
  
  return (
    <Toast 
      className="position-fixed bottom-0 end-0 m-3"
      bg={getVariant()}
      show={visible}
      onClose={() => setVisible(false)}
      delay={3000}
      autohide
    >
      <Toast.Header closeButton={true}>
        <strong className="me-auto">Notification</strong>
      </Toast.Header>
      <Toast.Body className={type === 'error' ? 'text-white' : ''}>
        {message}
      </Toast.Body>
    </Toast>
  );
};

export default Notification; 