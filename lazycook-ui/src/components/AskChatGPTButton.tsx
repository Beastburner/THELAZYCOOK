import { useEffect, useState } from 'react';
import logoTextImg from '../assets/logo-text.png';

interface AskChatGPTButtonProps {
  position: { x: number; y: number };
  selectedText: string;
  onAsk: (text: string) => void;
  onClose: () => void;
}

export default function AskChatGPTButton({ position, selectedText, onAsk, onClose }: AskChatGPTButtonProps) {
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    // Adjust position to keep button in viewport
    const buttonWidth = 140; // Approximate button width
    const buttonHeight = 40;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y - 50; // Position above selection

    // Adjust if button would go off-screen
    if (x + buttonWidth / 2 > viewportWidth) {
      x = viewportWidth - buttonWidth / 2 - 10;
    }
    if (x - buttonWidth / 2 < 10) {
      x = buttonWidth / 2 + 10;
    }
    if (y < 10) {
      y = position.y + 30; // Position below selection if no room above
    }
    if (y + buttonHeight > viewportHeight) {
      y = viewportHeight - buttonHeight - 10;
    }

    setAdjustedPosition({ x, y });
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close on clicks inside the button
      const target = event.target as HTMLElement;
      if (!target.closest('.lc-ask-chatgpt-btn')) {
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

  const handleAsk = (promptType: 'explain' | 'what' | 'summarize' | 'simplify') => {
    let prompt = '';
    switch (promptType) {
      case 'explain':
        prompt = `Explain this clearly:\n"${selectedText}"`;
        break;
      case 'what':
        prompt = `What does this mean?\n"${selectedText}"`;
        break;
      case 'summarize':
        prompt = `Summarize this:\n"${selectedText}"`;
        break;
      case 'simplify':
        prompt = `Simplify this:\n"${selectedText}"`;
        break;
    }
    onAsk(prompt);
    onClose();
  };

  return (
    <div
      className="lc-ask-chatgpt-btn"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="lc-ask-chatgpt-main"
        onClick={() => handleAsk('explain')}
        title="Ask LAZYCOOK about this text"
      >
        <span>Ask</span>
        <img src={logoTextImg} alt="LAZYCOOK" className="lc-ask-lazycook-logo" />
      </button>
      <div className="lc-ask-chatgpt-options">
        <button
          className="lc-ask-chatgpt-option"
          onClick={() => handleAsk('explain')}
          title="Explain this clearly"
        >
          Explain
        </button>
        <button
          className="lc-ask-chatgpt-option"
          onClick={() => handleAsk('what')}
          title="What does this mean?"
        >
          What?
        </button>
        <button
          className="lc-ask-chatgpt-option"
          onClick={() => handleAsk('summarize')}
          title="Summarize this"
        >
          Summarize
        </button>
        <button
          className="lc-ask-chatgpt-option"
          onClick={() => handleAsk('simplify')}
          title="Simplify this"
        >
          Simplify
        </button>
      </div>
    </div>
  );
}

