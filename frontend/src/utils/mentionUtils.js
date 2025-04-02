import React from 'react';

/**
 * Parse text and highlight @mentions
 * @param {string} text - The text to parse for mentions
 * @param {function} onMentionClick - Optional callback when a mention is clicked
 * @returns {Array} Array of text and highlighted mentions elements
 */
export const parseAndHighlightMentions = (text, onMentionClick) => {
  if (!text) return [];
  
  // Regular expression to match @username
  // Username can contain letters, numbers, underscore, period, or dash
  const regex = /(@[\w\.-]+)/g;
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    // Check if this part is a mention
    if (part.match(regex)) {
      const username = part.substring(1); // Extract username without @ symbol
      return (
        <span 
          key={index} 
          className="mention-highlight" 
          style={{ 
            fontWeight: 'bold', 
            color: '#0d6efd',
            backgroundColor: 'rgba(13, 110, 253, 0.1)',
            padding: '1px 4px',
            borderRadius: '3px',
            cursor: onMentionClick ? 'pointer' : 'default'
          }}
          title={`View ${username}'s profile`}
          onClick={() => {
            if (onMentionClick) {
              onMentionClick(username);
            }
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

/**
 * Extract list of usernames from text that were mentioned with @
 * @param {string} text - The text to extract mentions from
 * @returns {Array} Array of mentioned usernames (without @ symbol)
 */
export const extractMentions = (text) => {
  if (!text) return [];
  
  // Updated regex to match more username formats
  const regex = /@([\w\.-]+)/g;
  const mentions = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    mentions.push(match[1]); // Capture the username without @
  }
  
  return mentions;
};

/**
 * Insert username at cursor position in textarea
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {string} username - Username to insert with @ prefix
 */
export const insertMention = (textarea, username) => {
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  // Find the position of the @ symbol
  const lastAtPos = text.lastIndexOf('@', start);
  if (lastAtPos === -1) return;
  
  // Extract the text after @ to check what's been typed
  const typed = text.substring(lastAtPos + 1, start);
  
  // Calculate what part of the text we need to replace
  const beforeAt = text.substring(0, lastAtPos);
  const afterCursor = text.substring(end);
  
  // Replace the @typed with @username
  const mention = `@${username} `;
  textarea.value = beforeAt + mention + afterCursor;
  
  // Place cursor after the inserted mention
  const newCursorPos = lastAtPos + mention.length;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  textarea.focus();
};

/**
 * Check if cursor is currently in a mention
 * @param {string} text - The full text
 * @param {number} cursorPos - Current cursor position
 * @returns {boolean} True if cursor is within a mention
 */
export const isCursorInMention = (text, cursorPos) => {
  if (!text) return false;
  
  // Find the last @ before cursor
  const lastAtPos = text.lastIndexOf('@', cursorPos - 1);
  if (lastAtPos === -1) return false;
  
  // Check if there's a space between @ and cursor
  const textBetween = text.substring(lastAtPos, cursorPos);
  return !textBetween.includes(' ');
};

/**
 * Create a controlled input handler that supports mentions
 * @param {function} setValue - State setter function for input value
 * @param {function} setShowMentions - Function to control mention suggestions visibility
 * @returns {function} Event handler for input changes
 */
export const createMentionInputHandler = (setValue, setShowMentions) => {
  return (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setValue(value);
    
    // Check if @ was just typed
    const lastChar = value.charAt(cursorPos - 1);
    const prevChar = value.charAt(cursorPos - 2);
    
    if (lastChar === '@' && (cursorPos === 1 || /\s/.test(prevChar))) {
      // Show mention suggestions
      if (setShowMentions) setShowMentions(true);
    }
  };
}; 