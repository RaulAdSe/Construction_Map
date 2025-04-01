import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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

  // Memoize the position calculation function
  const calculateMentionPosition = useCallback(() => {
    if (!inputRef.current) return;
    
    const textarea = inputRef.current;
    const text = value;
    
    // Find the position of the last @ symbol before cursor
    const cursorPos = textarea.selectionStart;
    const lastAtIndex = text.lastIndexOf('@', cursorPos);
    if (lastAtIndex === -1) return;
    
    // Get caret position in the textarea
    const textareaPosition = textarea.getBoundingClientRect();
    
    // Create a mirror div to calculate exact cursor position
    const mirror = document.createElement('div');
    
    // Copy the textarea's styling
    const style = window.getComputedStyle(textarea);
    
    // List of styles to copy
    const stylesToCopy = [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight',
      'letterSpacing', 'padding', 'border', 'boxSizing'
    ];
    
    stylesToCopy.forEach(styleName => {
      mirror.style[styleName] = style.getPropertyValue(styleName);
    });
    
    // Special handling for the width
    mirror.style.position = 'absolute';
    mirror.style.top = '0';
    mirror.style.left = '0';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflowWrap = 'break-word';
    mirror.style.width = `${textarea.offsetWidth}px`;
    
    // Create marker span
    const marker = document.createElement('span');
    marker.textContent = '|'; // Marker character
    
    // Split text at cursor position
    const textBeforeCaret = text.substring(0, lastAtIndex);
    const textAfterCaret = text.substring(lastAtIndex);
    
    // Add text before caret
    mirror.textContent = textBeforeCaret;
    
    // Add marker span
    mirror.appendChild(marker);
    
    // Add text after cursor
    const textNode = document.createTextNode(textAfterCaret);
    mirror.appendChild(textNode);
    
    // Append to body, get position, then remove
    document.body.appendChild(mirror);
    
    // Get marker position
    const markerPosition = marker.getBoundingClientRect();
    document.body.removeChild(mirror);
    
    // Calculate the position for the suggestions dropdown
    const top = markerPosition.top + markerPosition.height + window.scrollY;
    let left = markerPosition.left + window.scrollX;
    
    // Ensure the suggestion box doesn't go out of viewport
    const maxLeft = window.innerWidth - 260; // 250px width + 10px margin
    const finalLeft = Math.min(left, maxLeft);
    
    setMentionPosition({ top, left: finalLeft });
  }, [value]);

  // Memoize the input change handler
  const handleInputChange = useCallback((e) => {
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
  }, [onChange, calculateMentionPosition]);

  // Memoize the user selection handler
  const handleUserSelect = useCallback((username) => {
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
  }, [onChange]);
  
  // Memoize keydown handler
  const handleKeyDown = useCallback((e) => {
    // ESC key to dismiss mentions suggestions
    if (e.key === 'Escape' && showMentions) {
      e.preventDefault();
      setShowMentions(false);
    }
  }, [showMentions]);

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

  // Memoize the suggestions props to prevent unnecessary re-renders
  const mentionSuggestionProps = useMemo(() => ({
    text: value,
    position: mentionPosition,
    onSelectUser: handleUserSelect,
    projectId: projectId,
    isVisible: showMentions,
    setIsVisible: setShowMentions
  }), [value, mentionPosition, handleUserSelect, projectId, showMentions]);

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
      {showMentions && <MentionSuggestions {...mentionSuggestionProps} />}
    </div>
  );
};

export default React.memo(MentionInput); 