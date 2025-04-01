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
  const containerRef = useRef(null);

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
        // Only show suggestions if there's not a complete mention already
        const textAfterAt = text.substring(lastAtIndex + 1);
        const spaceAfterMention = textAfterAt.indexOf(' ');
        const isCompleteMention = spaceAfterMention !== -1 && textAfterAt.substring(0, spaceAfterMention).length > 0;
        
        if (!isCompleteMention) {
          // Calculate cursor position for suggestions
          calculateMentionPosition();
          setShowMentions(true);
          return;
        }
      }
    }
    
    // If we get here, no active mention is being typed
    setShowMentions(false);
  };

  // Calculate position for the mention suggestions dropdown
  const calculateMentionPosition = () => {
    if (!inputRef.current) return;
    
    const textarea = inputRef.current;
    const text = value;
    
    // Find the position of the last @ symbol before cursor
    const cursorPos = textarea.selectionStart;
    const lastAtIndex = text.lastIndexOf('@', cursorPos);
    if (lastAtIndex === -1) return;
    
    const textareaPosition = textarea.getBoundingClientRect();
    
    // Get all lines up to the current position
    const textBeforeCursor = text.substring(0, lastAtIndex);
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    
    // Get text on the current line up to the @ symbol
    const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const currentLineUpToAt = textBeforeCursor.substring(currentLineStart);
    
    // Create a hidden div with the same styling as the textarea
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.width = `${textarea.clientWidth}px`;
    div.style.padding = window.getComputedStyle(textarea).padding;
    div.style.font = window.getComputedStyle(textarea).font;
    div.style.lineHeight = window.getComputedStyle(textarea).lineHeight;
    
    // Create a span for text up to the @ symbol
    const span = document.createElement('span');
    span.textContent = currentLineUpToAt;
    div.appendChild(span);
    
    // Append to body, measure, then remove
    document.body.appendChild(div);
    const spanRect = span.getBoundingClientRect();
    document.body.removeChild(div);
    
    // Calculate line height
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 18;
    
    // Calculate the position
    const paddingLeft = parseFloat(window.getComputedStyle(textarea).paddingLeft) || 0;
    const paddingTop = parseFloat(window.getComputedStyle(textarea).paddingTop) || 0;
    
    // Position dropdown below and at the @ symbol
    const top = textareaPosition.top + paddingTop + (lineHeight * currentLineIndex) + lineHeight + window.scrollY;
    const left = textareaPosition.left + paddingLeft + spanRect.width + window.scrollX;
    
    // Ensure the suggestion box doesn't go out of viewport
    const maxLeft = window.innerWidth - 260; // 250px width + 10px margin
    const finalLeft = Math.min(left, maxLeft);
    
    setMentionPosition({ top, left: finalLeft });
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
    
    // Hide suggestions
    setShowMentions(false);
  };
  
  // Handle input keydown events
  const handleKeyDown = (e) => {
    // ESC key to dismiss mentions suggestions
    if (e.key === 'Escape' && showMentions) {
      e.preventDefault();
      setShowMentions(false);
    }
  };

  // Close mentions suggestion when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target)
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
    <div className="position-relative" ref={containerRef}>
      {label && <Form.Label htmlFor={id}>{label}</Form.Label>}
      <Form.Control
        ref={inputRef}
        id={id}
        as="textarea"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
      {showMentions && (
        <MentionSuggestions 
          text={value}
          position={mentionPosition}
          onSelectUser={handleUserSelect}
          projectId={projectId}
          isVisible={showMentions}
          setIsVisible={setShowMentions}
        />
      )}
    </div>
  );
};

export default MentionInput; 