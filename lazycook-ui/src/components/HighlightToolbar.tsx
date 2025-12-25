import React, { useEffect, useRef, useState } from 'react';

type HighlightColor = "yellow" | "blue" | "green" | "pink" | "purple";

interface HighlightToolbarProps {
  position: { x: number; y: number };
  onColorSelect: (color: HighlightColor) => void;
  onClose: () => void;
  onRemove?: () => void;
  onNote?: () => void;
  showRemove?: boolean;
  showNote?: boolean;
  currentHighlight?: { note?: string } | null;
}

const COLORS: HighlightColor[] = ["yellow", "blue", "green", "pink", "purple"];

export default function HighlightToolbar({ position, onColorSelect, onClose, onRemove, onNote, showRemove = false, showNote = false, currentHighlight }: HighlightToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep toolbar in viewport
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y - 50; // Position above selection

      // Adjust if toolbar would go off-screen
      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 10;
      }
      if (x < 10) {
        x = 10;
      }
      if (y < 10) {
        y = position.y + 30; // Position below selection if no room above
      }
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 10;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  return (
    <div
      ref={toolbarRef}
      className="lc-highlight-toolbar"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {COLORS.map((color) => (
        <button
          key={color}
          className={`lc-highlight-color-btn lc-highlight-color-${color}`}
          onClick={() => {
            onColorSelect(color);
            onClose();
          }}
          aria-label={`Highlight with ${color}`}
          title={color.charAt(0).toUpperCase() + color.slice(1)}
        />
      ))}
      {showNote && onNote && (
        <button
          className={`lc-highlight-note-btn ${!currentHighlight?.note ? 'pulse' : ''}`}
          onClick={() => {
            onNote();
            onClose();
          }}
          aria-label="Add note"
          title="Add note to highlight"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Stack of notes (background layer) */}
            <rect x="2.5" y="3.5" width="10" height="10" rx="0.5" fill="#FFD700" opacity="0.5" stroke="currentColor" strokeWidth="0.8"/>
            {/* Main sticky note */}
            <rect x="2" y="2.5" width="10" height="10" rx="0.5" fill="#FFEB3B" stroke="currentColor" strokeWidth="1"/>
            {/* Curled corner effect */}
            <path d="M11.5 12L12.5 13L11.5 13Z" fill="#FFC107"/>
            <path d="M12 12L13 13L12.5 13Z" fill="#FFC107"/>
            {/* Three horizontal lines (text lines) */}
            <line x1="4" y1="5.5" x2="10.5" y2="5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            <line x1="4" y1="7.5" x2="10.5" y2="7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            <line x1="4" y1="9.5" x2="10.5" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            {/* Pink thumbtack */}
            <circle cx="8" cy="4" r="1.2" fill="#FF4081" stroke="currentColor" strokeWidth="0.3"/>
            <circle cx="7.7" cy="3.7" r="0.3" fill="#FFB3D9" opacity="0.8"/>
            <line x1="8" y1="5.2" x2="8.4" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          </svg>
        </button>
      )}
      {showRemove && onRemove && (
        <button
          className="lc-highlight-remove-btn"
          onClick={() => {
            onRemove();
            onClose();
          }}
          aria-label="Remove highlight"
          title="Remove highlight"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

