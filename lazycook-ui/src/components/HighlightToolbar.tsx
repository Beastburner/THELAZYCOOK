import React, { useEffect, useRef, useState } from 'react';
import { FiFileText, FiX } from 'react-icons/fi';

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
          <FiFileText size={20} aria-hidden="true" />
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
          <FiX size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

