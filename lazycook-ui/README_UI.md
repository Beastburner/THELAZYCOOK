# LazyCook UI Components

This document describes the ChatGPT-like conversational UI components for LazyCook.

## Architecture

The UI is built with:
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations (optional)
- **React Markdown** for rendering assistant responses
- **Prism.js** for syntax highlighting (optional)

## Component Structure

### Context
- `context/ConversationsContext.tsx` - Manages conversation state, active chat, user info, and model selection

### Hooks
- `hooks/useAutoScroll.ts` - Auto-scrolls to bottom when new messages arrive

### UI Components
- `components/UI/CopyButton.tsx` - Reusable copy-to-clipboard button
- `components/UI/DarkModeToggle.tsx` - Light/dark mode switcher
- `components/UI/MessageBubble.tsx` - Individual message bubble with avatar and actions

### Main Components
- `components/Sidebar/ConversationList.tsx` - Left sidebar with conversation list, search, and new conversation button
- `components/Main/Topbar.tsx` - Top bar with conversation title, model selector, and actions menu
- `components/Main/MessageFeed.tsx` - Scrollable message feed with loading states
- `components/Main/Composer.tsx` - Input area with autosizing textarea, quick prompts, and send button

## Layout

### Desktop (≥768px)
- **Left Sidebar (260px fixed)**: Logo, New Conversation, conversation list, user info, dark mode toggle
- **Main Area (flex-grow)**: Topbar, MessageFeed, Composer
- Two-column layout with sidebar always visible

### Mobile (<768px)
- **Sidebar**: Hidden by default, accessible via hamburger menu
- **Main Area**: Full width
- Overlay when sidebar is open

## Features

### Message Feed
- User messages: Right-aligned, blue background
- Assistant messages: Left-aligned, white/gray background with markdown rendering
- Streaming support: Loading indicator with animated dots
- Auto-scroll: Automatically scrolls to bottom on new messages
- Actions: Regenerate and Edit buttons appear on hover (assistant messages only)

### Composer
- **Autosizing textarea**: Grows up to 8 rows (200px max height)
- **Keyboard shortcuts**:
  - `Enter` - Send message
  - `Shift+Enter` - New line
- **Quick prompts**: Chips above input for common prompts (Explain, Summarize, Translate)
- **Voice input**: Placeholder button (disabled, coming soon)

### Code Blocks
- Syntax highlighting via Prism.js
- Copy button (always visible)
- Download and Edit buttons (only for programming languages)
- Language detection and file extension mapping

### Accessibility
- All interactive elements have `aria-label` attributes
- Keyboard navigation: Tab order follows visual flow
- Focus indicators: Visible ring on focus
- Color contrast: Meets WCAG AA standards

## Styling

### Tailwind Configuration
- Custom colors in `tailwind.config.js`:
  - Light mode: `light.*` colors
  - Dark mode: `dark.*` colors
- Dark mode: Class-based (`dark:` prefix)
- Border radius: `rounded-2xl` (1rem) for soft corners

### Theme Tokens
```css
Light Mode:
- Background: white (#ffffff)
- Surface: #f9fafb
- Text: #111827
- Border: #e5e7eb

Dark Mode:
- Background: #0b0b0f
- Surface: #12121a
- Text: rgba(255, 255, 255, 0.92)
- Border: rgba(255, 255, 255, 0.08)
```

## State Management

Conversation state is managed via React Context (`ConversationsContext`):
- `chats`: Array of all conversations
- `activeChatId`: Currently selected conversation ID
- `email`, `plan`, `token`: User authentication info
- `model`: Selected AI model (gemini/grok/mixed)

Local storage persistence:
- Conversations saved to `lazycook_chats`
- Active chat ID saved to `lazycook_active_chat`
- Auth info saved to `lazycook_auth`

## API Integration

All API calls remain unchanged:
- `POST /auth/login` - User authentication
- `GET /auth/me` - Get user info
- `POST /ai/run` - Send message to AI

The UI only changes how responses are displayed, not the API contract.

## Testing

### Manual Testing Checklist
- [ ] Create new conversation
- [ ] Send message (Enter key)
- [ ] Send message with newline (Shift+Enter)
- [ ] Switch between conversations
- [ ] Rename conversation
- [ ] Delete conversation
- [ ] Copy code block
- [ ] Download code (programming languages only)
- [ ] Edit code (programming languages only)
- [ ] Toggle dark mode
- [ ] Mobile responsive behavior
- [ ] Keyboard navigation (Tab, Enter, Escape)

### E2E Test (Suggested)
```typescript
// Example Cypress test
describe('LazyCook UI', () => {
  it('creates conversation and sends message', () => {
    cy.visit('/');
    cy.get('[aria-label="New conversation"]').click();
    cy.get('textarea[aria-label="Message input"]').type('Hello{enter}');
    cy.contains('Hello').should('be.visible');
  });
});
```

## Build

```bash
npm run build
```

No backend changes required. All changes are frontend-only.

## Dependencies Added

- `tailwindcss` - Utility-first CSS framework
- `@tailwindcss/typography` - Typography plugin for prose styling
- `framer-motion` - Animation library (optional, can be removed)
- `prismjs` - Syntax highlighting (optional, can use CSS-only)

## Notes

- The old `App.css` is kept for backward compatibility but most styles are now in Tailwind
- CodeBlock component maintains existing functionality (copy, download, edit)
- MarkdownContent uses Tailwind classes instead of custom CSS classes
- All components are TypeScript with proper type definitions

