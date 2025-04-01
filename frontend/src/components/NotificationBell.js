import React, { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'react-feather';
import { Badge, Button, Card, ListGroup, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Define API URL constant
const API_URL = 'http://localhost:8000/api/v1';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const notificationPanelRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_URL}/notifications`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        withCredentials: true
      });
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API_URL}/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        withCredentials: true
      });
      setUnreadCount(response.data);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`${API_URL}/notifications/${notificationId}`, {
        read: true
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true } 
          : notification
      ));
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API_URL}/notifications/mark-all-read`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      // Update local state
      setNotifications(notifications.map(notification => ({ ...notification, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId, e) => {
    e.stopPropagation(); // Prevent triggering the notification click
    
    try {
      await axios.delete(`${API_URL}/notifications/${notificationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        withCredentials: true
      });
      
      // Update local state
      const updatedNotifications = notifications.filter(
        notification => notification.id !== notificationId
      );
      setNotifications(updatedNotifications);
      
      // Update unread count if needed
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read if not already read
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Navigate to the link destination
    navigate(notification.link);
    setIsOpen(false);
  };

  const toggleNotificationPanel = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Poll for notifications periodically
  useEffect(() => {
    fetchUnreadCount();
    
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="notification-bell-container" style={{ 
      position: 'relative',
      display: 'inline-block',
      marginRight: '15px'
    }}>
      <div 
        className="notification-bell" 
        onClick={toggleNotificationPanel}
        style={{ 
          cursor: 'pointer',
          color: '#fff',
          padding: '5px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Bell size={28} color="#fff" />
        {unreadCount > 0 && (
          <Badge 
            bg="danger" 
            pill 
            style={{ 
              position: 'absolute', 
              top: '-5px', 
              right: '-5px',
              fontSize: '0.75rem',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </div>
      
      {isOpen && (
        <Card 
          ref={notificationPanelRef}
          style={{ 
            position: 'absolute', 
            top: '45px', 
            right: '0', 
            width: '350px',
            maxHeight: '400px',
            zIndex: 9999,
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
          }}
        >
          <Card.Header className="d-flex justify-content-between align-items-center">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Button 
                variant="link" 
                size="sm" 
                onClick={markAllAsRead}
              >
                Mark all as read
              </Button>
            )}
          </Card.Header>
          <ListGroup variant="flush" 
            style={{ 
              maxHeight: '300px', 
              overflowY: 'auto' 
            }}
          >
            {isLoading ? (
              <div className="text-center p-3">
                <Spinner animation="border" size="sm" /> Loading...
              </div>
            ) : notifications.length === 0 ? (
              <ListGroup.Item className="text-center text-muted py-3">
                No notifications
              </ListGroup.Item>
            ) : (
              notifications.map(notification => (
                <ListGroup.Item 
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`d-flex justify-content-between align-items-start ${!notification.read ? 'bg-light' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="ms-2 me-auto">
                    <div>{notification.message}</div>
                    <small className="text-muted">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </small>
                  </div>
                  <Button 
                    variant="link" 
                    className="text-danger p-0 ms-2"
                    onClick={(e) => deleteNotification(notification.id, e)}
                  >
                    <X size={16} />
                  </Button>
                </ListGroup.Item>
              ))
            )}
          </ListGroup>
        </Card>
      )}
    </div>
  );
};

export default NotificationBell; 