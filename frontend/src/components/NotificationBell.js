import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Trash } from 'react-feather';
import { Badge, Button, Card, ListGroup, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import '../styles/global.css';

// Define API URL constant
const API_URL = 'http://localhost:8000/api/v1';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const notificationPanelRef = useRef(null);
  const navigate = useNavigate();
  const notificationRef = useRef(null);
  const bellRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_URL}/notifications`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        withCredentials: true
      });
      
      if (response.data && Array.isArray(response.data.notifications)) {
        // Ensure newest notifications are at the top (should be handled by backend)
        const sortedNotifications = response.data.notifications.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        setNotifications(sortedNotifications);
        setUnreadCount(response.data.unread_count || 0);
      } else {
        console.error('Unexpected response format:', response.data);
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
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
      
      if (typeof response.data === 'number') {
        setUnreadCount(response.data);
      } else {
        console.error('Unexpected unread count format:', response.data);
      }
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

  const handleDeleteNotification = async (e, notificationId) => {
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
    
    // Close notification panel
    setIsOpen(false);
    
    // Navigate to the link destination if it exists
    if (notification.link) {
      // Parse the link to extract parameters
      try {
        const linkUrl = new URL(notification.link, window.location.origin);
        
        // Reset any userClosedModal flag when navigating to new event
        if (window.resetModalClosedFlag && typeof window.resetModalClosedFlag === 'function') {
          window.resetModalClosedFlag();
        }
        
        // Handle navigation based on the link structure
        if (linkUrl.pathname.startsWith('/project/')) {
          const projectId = linkUrl.pathname.split('/').pop();
          const eventId = linkUrl.searchParams.get('event');
          const commentId = linkUrl.searchParams.get('comment');
          
          // Navigate and include any query parameters
          navigate(`/project/${projectId}`, { 
            state: { 
              highlightEventId: eventId,
              highlightCommentId: commentId
            }
          });
        } else {
          // For other links, navigate directly
          navigate(notification.link);
        }
      } catch (error) {
        console.error('Error parsing notification link:', error);
        // Fallback to direct navigation
        navigate(notification.link);
      }
    } else {
      console.warn('Notification has no link to navigate to');
    }
  };

  const toggleNotifications = () => {
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
    <div className="notification-bell-container" style={{ position: 'relative', display: 'inline-block', marginRight: '15px', zIndex: 99999 }}>
      <div 
        ref={bellRef}
        onClick={toggleNotifications} 
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <Bell size={24} color="#fff" />
        {unreadCount > 0 && (
          <div
            className="notification-badge"
            style={{
              position: 'absolute',
              bottom: '-5px',
              right: '-5px',
              borderRadius: '50%',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              backgroundColor: '#dc3545',
              color: 'white',
              boxShadow: '0 0 0 2px #fff'
            }}
          >
            {unreadCount}
          </div>
        )}
      </div>

      {isOpen && (
        createPortal(
          <div 
            className="notification-overlay"
            onClick={(e) => {
              if (e.target.className === 'notification-overlay') {
                toggleNotifications();
              }
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              background: 'transparent'
            }}
          >
            <Card
              ref={notificationPanelRef}
              className="notification-panel"
              style={{
                position: 'absolute',
                top: bellRef.current ? bellRef.current.getBoundingClientRect().bottom + 5 : '60px',
                right: bellRef.current ? window.innerWidth - bellRef.current.getBoundingClientRect().right : '20px',
                width: '350px',
                maxHeight: '500px',
                overflowY: 'auto',
                zIndex: 100000,
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
              }}
            >
              <Card.Header className="d-flex justify-content-between align-items-center bg-light">
                <span className="fw-bold">Notifications</span>
                <div>
                  {unreadCount > 0 && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="text-primary p-0 me-2" 
                      onClick={markAllAsRead}
                      style={{ textDecoration: 'none' }}
                    >
                      Mark all as read
                    </Button>
                  )}
                </div>
              </Card.Header>
              <ListGroup variant="flush">
                {isLoading ? (
                  <div className="text-center p-3">
                    <Spinner animation="border" size="sm" className="me-2" />
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center p-3 text-muted">
                    No notifications
                  </div>
                ) : (
                  notifications.map(notification => (
                    <ListGroup.Item 
                      key={notification.id}
                      className={`notification-item ${!notification.read ? 'bg-light' : ''}`}
                      style={{ 
                        borderLeft: notification.read ? 'none' : '3px solid #0d6efd',
                        padding: '10px 15px',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="d-flex justify-content-between">
                        <div className="notification-content" style={{ flex: 1 }}>
                          <p className="mb-1 notification-text" style={{ fontWeight: notification.read ? 'normal' : 'bold' }}>
                            {notification.message}
                          </p>
                          <small className="text-muted">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </small>
                          {notification.related_type && (
                            <div className="mt-1">
                              <Badge bg="secondary" className="me-1">
                                {notification.related_type}
                              </Badge>
                              {notification.project_name && (
                                <Badge bg="info" className="me-1">
                                  {notification.project_name}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="notification-actions">
                          <Button 
                            variant="link" 
                            className="p-0 text-muted" 
                            onClick={(e) => handleDeleteNotification(e, notification.id)}
                            style={{ fontSize: '0.8rem' }}
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))
                )}
              </ListGroup>
            </Card>
          </div>,
          document.body
        )
      )}
    </div>
  );
};

export default NotificationBell; 