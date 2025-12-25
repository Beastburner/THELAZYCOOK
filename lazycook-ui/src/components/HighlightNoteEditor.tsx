import React, { useEffect, useRef, useState } from 'react';

interface HighlightNoteEditorProps {
  position: { x: number; y: number };
  highlightText: string;
  currentNote?: string;
  onSave: (note: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function HighlightNoteEditor({
  position,
  highlightText,
  currentNote = '',
  onSave,
  onDelete,
  onClose,
}: HighlightNoteEditorProps) {
  const [note, setNote] = useState(currentNote);
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNote(currentNote);
  }, [currentNote]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
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

  // Adjust position to keep editor in viewport
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (editorRef.current) {
      const rect = editorRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y + 20; // Position below highlight

      // Adjust if editor would go off-screen
      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 10;
      }
      if (x < 10) {
        x = 10;
      }
      if (y + rect.height > viewportHeight) {
        y = position.y - rect.height - 10; // Position above if no room below
      }
      if (y < 10) {
        y = 10;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  const handleSave = () => {
    onSave(note.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      ref={editorRef}
      className="lc-highlight-note-editor"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="lc-highlight-note-header">
        <span className="lc-highlight-note-icon">📌</span>
        <span className="lc-highlight-note-title">Highlight Note</span>
      </div>
      <div className="lc-highlight-note-text">
        "{highlightText}"
      </div>
      <textarea
        ref={textareaRef}
        className="lc-highlight-note-input"
        placeholder="Add a note about this highlight..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
      />
      <div className="lc-highlight-note-actions">
        <button
          className="lc-highlight-note-btn lc-highlight-note-save"
          onClick={handleSave}
        >
          Save
        </button>
        <button
          className="lc-highlight-note-btn lc-highlight-note-delete"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          Remove
        </button>
      </div>
      <div className="lc-highlight-note-hint">
        Press Ctrl+Enter to save
      </div>
    </div>
  );
}

