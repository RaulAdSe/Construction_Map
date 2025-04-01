import React, { useState, useEffect } from 'react';
import { ListGroup } from 'react-bootstrap';
import axios from 'axios';
import { getAuthAxios } from '../services/api';
import { API_URL } from '../config';

const MentionSuggestions = ({ 
  text, 
  position, 
  onSelectUser, 
  projectId, 
  isVisible, 
  setIsVisible 
}) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // Fetch project users when component mounts
  useEffect(() => {
    const fetchProjectUsers = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const response = await getAuthAxios().get(`${API_URL}/api/v1/projects/${projectId}/members`);
        setUsers(response.data);
      } catch (error) {
        console.error('Error fetching project users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectUsers();
  }, [projectId]);

  // Extract query text after @ symbol
  useEffect(() => {
    if (!isVisible) return;
    
    const getQueryFromText = () => {
      const lastAtSymbolIndex = text.lastIndexOf('@');
      if (lastAtSymbolIndex === -1) return '';
      
      const textAfterAt = text.slice(lastAtSymbolIndex + 1);
      // Extract everything until the next space or end of string
      const match = /^(\w*)/.exec(textAfterAt);
      return match ? match[0].toLowerCase() : '';
    };
    
    setMentionQuery(getQueryFromText());
  }, [text, isVisible]);

  // Filter users based on the query
  useEffect(() => {
    if (!isVisible) return;
    
    const filtered = users.filter(user => 
      user.username.toLowerCase().includes(mentionQuery.toLowerCase())
    );
    
    setFilteredUsers(filtered.slice(0, 5)); // Limit to 5 suggestions
  }, [mentionQuery, users, isVisible]);

  // Hide suggestions when no matches
  useEffect(() => {
    if (filteredUsers.length === 0 && !loading && isVisible) {
      setIsVisible(false);
    }
  }, [filteredUsers, loading, isVisible, setIsVisible]);

  if (!isVisible || filteredUsers.length === 0) return null;

  return (
    <div 
      className="mention-suggestions"
      style={{
        position: 'absolute',
        left: `${position.left}px`,
        top: `${position.top}px`,
        zIndex: 1000,
        width: '200px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}
    >
      <ListGroup>
        {loading ? (
          <ListGroup.Item>Loading...</ListGroup.Item>
        ) : (
          filteredUsers.map(user => (
            <ListGroup.Item 
              key={user.id}
              action
              onClick={() => {
                onSelectUser(user.username);
                setIsVisible(false);
              }}
              className="d-flex align-items-center"
            >
              <div 
                className="bg-secondary text-white rounded-circle me-2 d-flex align-items-center justify-content-center"
                style={{ width: 24, height: 24, fontSize: '0.8rem' }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span>{user.username}</span>
              {user.is_admin && (
                <small className="ms-1 text-muted">(admin)</small>
              )}
            </ListGroup.Item>
          ))
        )}
      </ListGroup>
    </div>
  );
};

export default MentionSuggestions; 