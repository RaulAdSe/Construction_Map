import React, { useState, useRef, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import MentionSuggestions from './MentionSuggestions';
import { insertMention, parseAndHighlightMentions } from '../utils/mentionUtils';

const MentionInput = ({
  value,
  onChange,
  placeholder,
  rows = 3,
  projectId,
  label,
  id,
  isReadOnly = false,
  className = ''
}) => {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef(null);
  const displayRef = useRef(null);

  // Check for @ character while typing
  const handleInputChange = (e) => {
    const text = e.target.value;
    onChange(text);
    
    // Check if @ was typed
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Check if @ is at the start or has a space before it
      const charBeforeAt = lastAtIndex > 0 ? text[lastAtIndex - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
        // Calculate cursor position for suggestions
        calculateMentionPosition();
        setShowMentions(true);
      }
    }
  };

  // Calculate position for the mention suggestions dropdown
  const calculateMentionPosition = () => {
    if (!inputRef.current) return;
    
    const { selectionStart } = inputRef.current;
    const textBeforeCursor = value.substring(0, selectionStart);
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLineLength = lines[currentLineIndex].length;
    
    // Create a temporary span to measure text width
    const tempSpan = document.createElement('span');
    tempSpan.style.font = getComputedStyle(inputRef.current).font;
    tempSpan.style.position = 'absolute';
    tempSpan.style.visibility = 'hidden';
    tempSpan.textContent = lines[currentLineIndex];
    document.body.appendChild(tempSpan);
    
    const charWidth = tempSpan.getBoundingClientRect().width / Math.max(1, currentLineLength);
    document.body.removeChild(tempSpan);
    
    // Get input element position and dimensions
    const inputRect = inputRef.current.getBoundingClientRect();
    
    // Calculate line height based on the input
    const lineHeight = parseInt(getComputedStyle(inputRef.current).lineHeight) || 20;
    
    // Calculate position
    const top = inputRect.top + lineHeight * currentLineIndex + lineHeight + 5;
    let left = inputRect.left + (currentLineLength * charWidth);
    
    // Ensure suggestion box is visible within viewport
    const viewportWidth = window.innerWidth;
    if (left + 200 > viewportWidth) { // 200px is assumed width of suggestion box
      left = viewportWidth - 220; // 20px margin from edge
    }
    
    setMentionPosition({ top, left });
  };

  // Handle when user selects a username from suggestions
  const handleUserSelect = (username) => {
    if (!inputRef.current) return;
    
    // Insert mention at cursor position
    insertMention(inputRef.current, username);
    
    // Trigger onChange to update parent component's state
    const newEvent = {
      target: {
        value: inputRef.current.value
      }
    };
    onChange(newEvent.target.value);
    
    // Focus back on input
    inputRef.current.focus();
  };

  // Close mentions suggestion when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target) &&
        (!displayRef.current || !displayRef.current.contains(event.target))
      ) {
        setShowMentions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Render a read-only version with highlighted mentions
  if (isReadOnly) {
    return (
      <div 
        ref={displayRef}
        className={`form-control ${className}`} 
        style={{ 
          minHeight: rows * 24,
          whiteSpace: 'pre-wrap'
        }}
      >
        {parseAndHighlightMentions(value)}
      </div>
    );
  }

  // Render editable input with mentions support
  return (
    <div className="position-relative">
      {label && <Form.Label htmlFor={id}>{label}</Form.Label>}
      <Form.Control
        ref={inputRef}
        id={id}
        as="textarea"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
      <MentionSuggestions 
        text={value}
        position={mentionPosition}
        onSelectUser={handleUserSelect}
        projectId={projectId}
        isVisible={showMentions}
        setIsVisible={setShowMentions}
      />
    </div>
  );
};

export default MentionInput; 