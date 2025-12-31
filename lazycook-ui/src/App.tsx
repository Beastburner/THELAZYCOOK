import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import MarkdownContent from "./MarkdownContent";
import HighlightToolbar from "./components/HighlightToolbar";
import HighlightNoteEditor from "./components/HighlightNoteEditor";
import AskChatGPTButton from "./components/AskChatGPTButton";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FiArrowRight } from "react-icons/fi";
import emojisData from "./emojis.json";
import logoImg from "./assets/logo.png";
import logoTextImg from "./assets/logo-text.png";
import { signIn, signUp, signInWithGoogle, logOut, onAuthChange, getIdToken } from "./firebase";
import { setUserDoc, getUserDoc, updateUserPlan, updateUserSubscription, setChatDoc, subscribeToUserChats } from "./firebase";
import type { User } from "firebase/auth";
import PlanSelector from "./components/PlanSelector";

type Plan = "GO" | "PRO" | "ULTRA";
type Model = "gemini" | "grok" | "mixed";
type Role = "user" | "assistant";

type Highlight = {
  id: string;
  text: string;
  color: "yellow" | "blue" | "green" | "pink" | "purple";
  note?: string;
  createdAt: number;
};

type Message = {
  id: string;
  role: Role;
  content: string;
  confidenceScore?: number;
  highlights?: Highlight[];
};

type Chat = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
};

// Strict mapping (backend is source of truth)
const PLAN_MODELS: Record<Plan, Model[]> = {
  GO: ["gemini"],
  PRO: ["grok"],
  ULTRA: ["mixed"],
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/**
 * Determine user plan from email address
 * Test emails: go@lazycook.ai -> GO, pro@lazycook.ai -> PRO, ultra@lazycook.ai -> ULTRA
 */
function getPlanFromEmail(email: string): Plan {
  const e = email.toLowerCase();
  if (e.includes("ultra@lazycook.ai") || e === "ultra@lazycook.ai") {
    return "ULTRA";
  }
  if (e.includes("pro@lazycook.ai") || e === "pro@lazycook.ai") {
    return "PRO";
  }
  if (e.includes("go@lazycook.ai") || e === "go@lazycook.ai") {
    return "GO";
  }
  // Default fallback based on email content
  if (e.includes("ultra")) return "ULTRA";
  if (e.includes("pro")) return "PRO";
  return "GO";
}

/**
 * Refined ChatGPT-Style Title Generation
 * 
 * Generates chat titles from user messages following ChatGPT's discipline:
 * - 3-6 words (prefer 4-5 for optimal readability)
 * - Sentence case
 * - Verb + Object OR Noun phrase
 * - Neutral, scannable, predictable
 * - Preserves key concepts and topics
 */
function generateChatTitle(userMessage: string, aiResponse?: string): string {
  if (!userMessage || !userMessage.trim()) return "New chat";
  
  // Normalize whitespace
  let text = userMessage.trim().replace(/\s+/g, " ");
  
  // Remove emojis, quotes, and excessive punctuation (keep hyphens for compound words)
  text = text.replace(/[^\w\s\-]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Check if message is just a greeting/politeness (hard safety)
  const greetingPatterns = [
    /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\s*$/i,
    /^(please|thanks|thank you|thx|ty)\s*$/i,
    /^(ok|okay|sure|yes|no|yep|nope)\s*$/i,
  ];
  
  if (greetingPatterns.some(pattern => pattern.test(text))) {
    return "New chat";
  }
  
  // Remove greeting/politeness prefixes (but keep the rest)
  text = text.replace(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)[\s,]+/i, '');
  text = text.replace(/^(please|thanks|thank you|thx|ty)[\s,]+/i, '');
  text = text.replace(/^(i want|i need|i would like|i\'d like|can you|could you|would you|help me|help with|assist|please help|tell me|explain|show me)[\s,]+/i, '');
  text = text.trim();
  
  // Remove question words at start (convert questions to statements)
  text = text.replace(/^(what|how|why|when|where|which|who|can|could|would|should|is|are|do|does|did|will|tell|explain|show)\s+/i, '');
  text = text.replace(/\?+$/, '').trim();
  
  if (!text || text.length < 3) {
    // If user message is too short, try to extract from AI response
    if (aiResponse && aiResponse.length > 20) {
      const aiText = aiResponse
        .replace(/[#*`\[\]()]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 150);
      
      const aiWords = aiText.toLowerCase().split(/\s+/)
        .filter(w => w.length > 3 && !['that', 'this', 'with', 'from', 'have', 'been', 'will', 'would'].includes(w))
        .slice(0, 4);
      
      if (aiWords.length >= 3) {
        return aiWords
          .map((word, index) => index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)
          .join(' ');
      }
    }
    return "New chat";
  }
  
  // Split into words
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  
  // Remove only the most common filler words (be selective)
  const fillerWords = ['the', 'a', 'an', 'this', 'that', 'my', 'me', 'i', 'you', 'your', 'very', 'really', 'just', 'with', 'for', 'from', 'about'];
  let meaningfulWords = words.filter(w => !fillerWords.includes(w) && w.length > 1);
  
  // If we removed too many words, use original words but skip obvious fillers
  if (meaningfulWords.length < 3) {
    meaningfulWords = words.filter(w => !['i', 'me', 'my', 'you', 'your', 'the', 'a', 'an', 'this', 'that'].includes(w) && w.length > 1);
  }
  
  // If still not enough, include all words except single characters
  if (meaningfulWords.length < 3) {
    meaningfulWords = words.filter(w => w.length > 1);
  }
  
  if (meaningfulWords.length === 0) return "New chat";
  
  // Extract 4-5 meaningful words (optimal for readability, allow 3-6 range)
  const targetLength = Math.min(Math.max(meaningfulWords.length, 3), 5);
  const titleWords = meaningfulWords.slice(0, targetLength);
  
  // Ensure we have at least 3 words (hard safety)
  if (titleWords.length < 3) {
    // Try to include more words from original if needed
    const additionalWords = words.filter(w => !titleWords.includes(w) && w.length > 1).slice(0, 3 - titleWords.length);
    titleWords.push(...additionalWords);
    
    if (titleWords.length < 3) {
      return "New chat";
    }
  }
  
  // Convert to sentence case (first letter uppercase, rest lowercase)
  const title = titleWords
    .map((word, index) => {
      if (index === 0) {
        // First word: capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
  
  // Final validation: ensure title is meaningful
  if (title.length < 5 || title.split(' ').length < 3) {
    return "New chat";
  }
  
  return title || "New chat";
}

// Component to render LazyCook with red Z
function LazyCookText({ className }: { className?: string }) {
  return (
    <span className={className}>
      La<span className="lc-red-z">z</span>yCook
    </span>
  );
}

function analyzeSentiment(text: string): { sentiment: 'positive' | 'neutral' | 'negative' | 'question' | 'excited'; score: number } {
  const lowerText = text.toLowerCase();
  
  // Positive sentiment indicators
  const positiveWords = ['great', 'excellent', 'wonderful', 'amazing', 'perfect', 'awesome', 'fantastic', 'brilliant', 'outstanding', 'superb', 'delighted', 'pleased', 'happy', 'glad', 'success', 'solved', 'fixed', 'working', 'good', 'nice', 'helpful', 'useful', 'efficient', 'optimized', 'streamlined'];
  const positivePhrases = ['well done', 'good job', 'thank you', 'thanks', 'appreciate', 'love it', 'exactly what', 'perfect solution'];
  
  // Negative sentiment indicators
  const negativeWords = ['error', 'failed', 'broken', 'wrong', 'bad', 'terrible', 'awful', 'horrible', 'problem', 'issue', 'bug', 'crash', 'doesn\'t work', 'not working', 'disappointed', 'frustrated', 'confused', 'stuck'];
  const negativePhrases = ['not working', 'doesn\'t work', 'can\'t', 'cannot', 'unable to', 'failed to', 'error occurred'];
  
  // Question indicators
  const questionWords = ['how', 'what', 'why', 'when', 'where', 'which', 'who', 'can you', 'could you', 'would you', 'should i', 'is it', 'are you'];
  
  // Excitement indicators
  const excitedWords = ['wow', 'awesome', 'amazing', 'incredible', 'fantastic', 'brilliant', 'excellent'];
  const hasExclamation = text.includes('!');
  
  let positiveScore = 0;
  let negativeScore = 0;
  let questionScore = 0;
  let excitedScore = 0;
  
  // Count positive indicators
  positiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    positiveScore += (text.match(regex) || []).length;
  });
  positivePhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) positiveScore += 2;
  });
  
  // Count negative indicators
  negativeWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    negativeScore += (text.match(regex) || []).length;
  });
  negativePhrases.forEach(phrase => {
    if (lowerText.includes(phrase)) negativeScore += 2;
  });
  
  // Count question indicators
  questionWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    questionScore += (text.match(regex) || []).length;
  });
  if (text.includes('?')) questionScore += 2;
  
  // Count excitement indicators
  excitedWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    excitedScore += (text.match(regex) || []).length;
  });
  if (hasExclamation) excitedScore += 1;
  
  // Determine sentiment
  if (questionScore > 0 && questionScore >= Math.max(positiveScore, negativeScore)) {
    return { sentiment: 'question', score: questionScore };
  }
  if (excitedScore > 0 && excitedScore >= 2) {
    return { sentiment: 'excited', score: excitedScore };
  }
  if (negativeScore > positiveScore && negativeScore > 0) {
    return { sentiment: 'negative', score: negativeScore };
  }
  if (positiveScore > 0) {
    return { sentiment: 'positive', score: positiveScore };
  }
  
  return { sentiment: 'neutral', score: 0 };
}

function cleanProResponse(content: string): string {
  /**
   * Clean PRO version responses by removing JSON artifacts and metadata
   * while PRESERVING markdown formatting for proper rendering
   */
  let cleaned = content;

  // Step 1: Only remove JSON code blocks (not regular markdown code blocks)
  // Check if content is wrapped in ```json blocks (which should be removed)
  if (cleaned.trim().startsWith('```json') && cleaned.includes('```')) {
    const start = cleaned.indexOf('```json') + 7;
    const end = cleaned.lastIndexOf('```');
    if (end > start) {
      cleaned = cleaned.substring(start, end).trim();
    }
  }

  // Step 2: Try to extract from JSON if it's still JSON (but preserve markdown in the content)
  try {
    const data = JSON.parse(cleaned);
    if (typeof data === 'object' && data !== null) {
      // Try multiple possible field names from PRO optimizer responses
      cleaned = data.optimized_solution || 
                data.optimization || 
                data.content || 
                data.response || 
                (typeof data === 'string' ? data : JSON.stringify(data));
      // If extracted content is still JSON, try to get the actual text
      if (typeof cleaned === 'object') {
        cleaned = JSON.stringify(cleaned);
      }
      // Ensure it's a string
      if (typeof cleaned !== 'string') {
        cleaned = String(cleaned);
      }
    }
  } catch {
    // Not JSON, continue with text cleaning
  }

  // Step 3: Remove JSON field names if they leaked through (but preserve markdown syntax)
  // Only remove if they appear at the start of lines or in specific JSON patterns
  cleaned = cleaned.replace(/^"optimized_solution":\s*"?/gm, '');
  cleaned = cleaned.replace(/^"optimization":\s*"?/gm, '');
  cleaned = cleaned.replace(/^"content":\s*"?/gm, '');
  cleaned = cleaned.replace(/^"response":\s*"?/gm, '');
  cleaned = cleaned.replace(/^"changes_made":\s*\[/gm, '');
  cleaned = cleaned.replace(/^"errors_fixed":\s*\[/gm, '');
  cleaned = cleaned.replace(/^"enhancements":\s*\[/gm, '');
  // Also remove inline patterns
  cleaned = cleaned.replace(/"optimized_solution":\s*"?/g, '');
  cleaned = cleaned.replace(/"optimization":\s*"?/g, '');
  cleaned = cleaned.replace(/"content":\s*"?/g, '');

  // Step 4: Remove trailing quotes/commas from JSON artifacts (only at start/end of content)
  cleaned = cleaned.replace(/^["']+/g, ''); // Remove leading quotes
  cleaned = cleaned.replace(/["']+$/g, ''); // Remove trailing quotes
  cleaned = cleaned.replace(/^[,}\]]+/g, ''); // Remove leading JSON punctuation
  cleaned = cleaned.replace(/[,}\]]+$/g, ''); // Remove trailing JSON punctuation

  // Step 5: Fix escaped characters (but preserve actual newlines)
  cleaned = cleaned.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

  // Step 6: Remove confidence ratings and metadata at the end (preserve markdown)
  // Remove patterns like "Confidence Rating: 0.92" at the end
  cleaned = cleaned.replace(/\n\s*Confidence\s*(?:Rating|Score)?\s*:?\s*[\d.]+\s*$/i, '');
  cleaned = cleaned.replace(/\n\s*Rating\s*:?\s*[\d.]+\s*$/i, '');
  cleaned = cleaned.replace(/\n\s*Score\s*:?\s*[\d.]+\s*$/i, '');
  // Remove standalone confidence lines (but not if part of markdown)
  cleaned = cleaned.replace(/^Confidence\s*(?:Rating|Score)?\s*:?\s*[\d.]+\s*$/gim, '');
  
  // Step 7: Remove other metadata patterns
  cleaned = cleaned.replace(/\n\s*Quality\s*Score\s*:?\s*[\d.]+\s*$/i, '');
  cleaned = cleaned.replace(/\n\s*Iterations\s*:?\s*\d+\s*$/i, '');
  cleaned = cleaned.replace(/\n\s*Processing\s*Time\s*:?\s*[\d.]+s?\s*$/i, '');

  // Step 8: Normalize excessive line breaks (but preserve markdown double newlines)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n'); // Max 3 newlines

  // Step 9: Remove any remaining JSON array syntax at the very end
  cleaned = cleaned.replace(/\s*\],?\s*$/g, '');

  // Step 10: Ensure proper paragraph breaks for better readability
  // Only add double newlines between sentences if there's a single newline
  // This helps with readability without breaking markdown lists/code blocks
  cleaned = cleaned.replace(/([.!?])\s*\n([A-Z][a-z])/g, '$1\n\n$2');

  // Step 11: Clean up excessive whitespace (but preserve markdown indentation)
  // Only clean up multiple spaces in the middle of lines, not at line starts (for markdown lists)
  cleaned = cleaned.replace(/([^\n])[ \t]{2,}([^\n])/g, '$1 $2'); // Multiple spaces to single space (not at line start)
  
  // Step 12: Final trim
  cleaned = cleaned.trim();

  return cleaned;
}

function enhanceWithEmojis(content: string): string {
  // Load emojis from JSON
  const stepEmojisFromJSON = [
    emojisData.professional.SUCCESS,
    emojisData.professional.KEY_POINT,
    emojisData.conversational.ARROW_RIGHT,
    emojisData.professional.NEXT_STEP,
    emojisData.reaction.SPARKLES,
    emojisData.reaction.THINKING,
    emojisData.reaction.FIRE,
    emojisData.professional.CONCEPT
  ];
  
  // Split content by code blocks to preserve them
  const codeBlockRegex = /(```[\s\S]*?```|`[^`]+`)/g;
  const parts: Array<{ type: 'code' | 'text'; content: string }> = [];
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[0] });
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.substring(lastIndex) });
  }
  
  // If no code blocks found, treat entire content as text
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }
  
  // Process only text parts
  const processedParts = parts.map(part => {
    if (part.type === 'code') {
      return part.content; // Keep code blocks unchanged
    }
    
    let text = part.content;
    
    // Split text into sentences for better sentiment analysis
    // Better sentence splitting that handles various punctuation and line breaks
    const sentenceRegex = /([.!?]+\s+|\.\n|\n\n+|\.\s+$)/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentence = text.substring(lastIndex, match.index + match[0].length);
      if (sentence.trim().length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex);
      if (remaining.trim().length > 0) {
        sentences.push(remaining);
      }
    }
    
    // If no sentences found, treat entire text as one sentence
    if (sentences.length === 0) {
      sentences.push(text);
    }
    
    // First, add emojis to numbered steps in the text (not too frequently)
    // Pattern: "1.", "2.", "3." or "1)", "2)", "3)" at the start of a line or after whitespace
    const stepEmojis = stepEmojisFromJSON;
    let stepEmojiIndex = 0;
    let processedText = text;
    
    // Find all numbered steps
    const stepPattern = /(^|\n|\s)(\d+)([.)])\s+/g;
    const stepMatches: Array<{ fullMatch: string; number: number; replacement: string }> = [];
    let stepMatch;
    
    while ((stepMatch = stepPattern.exec(text)) !== null) {
      const stepNumber = parseInt(stepMatch[2], 10);
      if (stepNumber >= 1 && stepNumber <= 50) { // Reasonable step range
        stepMatches.push({
          fullMatch: stepMatch[0],
          number: stepNumber,
          replacement: stepMatch[0] // Will be updated if emoji is added
        });
      }
    }
    
    // Add emojis to steps, but not too frequently
    // If there are many steps (5+), add emoji to every 2nd or 3rd step
    // If there are few steps (1-4), add emoji to all of them
    const stepEmojiInterval = stepMatches.length > 5 ? 2 : 1;
    
    stepMatches.forEach((match) => {
      // Add emoji to steps: first 3 always get emoji, then every Nth step
      if (match.number <= 3 || (match.number - 1) % stepEmojiInterval === 0) {
        const emoji = stepEmojis[stepEmojiIndex % stepEmojis.length];
        stepEmojiIndex++;
        // Replace the step pattern with step + emoji
        match.replacement = match.fullMatch.replace(/(\d+)([.)])\s+/, `$1$2 ${emoji} `);
        // Replace in processed text
        processedText = processedText.replace(match.fullMatch, match.replacement);
      }
    });
    
    // Now process sentences for other emojis (sentiment-based)
    const processedSentences: string[] = [];
    let emojiCount = 0;
    // Calculate max emojis based on text length - more emojis for longer responses
    const textLength = processedText.length;
    const maxEmojis = Math.min(Math.max(2, Math.floor(textLength / 200)), 8); // 2-8 emojis based on length
    
    // Re-split processed text into sentences (since we modified it)
    const processedSentenceRegex = /([.!?]+\s+|\.\n|\n\n+|\.\s+$)/g;
    const processedSentencesList: string[] = [];
    let lastIdx = 0;
    let procMatch;
    
    while ((procMatch = processedSentenceRegex.exec(processedText)) !== null) {
      const sentence = processedText.substring(lastIdx, procMatch.index + procMatch[0].length);
      if (sentence.trim().length > 0) {
        processedSentencesList.push(sentence);
      }
      lastIdx = procMatch.index + procMatch[0].length;
    }
    
    if (lastIdx < processedText.length) {
      const remaining = processedText.substring(lastIdx);
      if (remaining.trim().length > 0) {
        processedSentencesList.push(remaining);
      }
    }
    
    if (processedSentencesList.length === 0) {
      processedSentencesList.push(processedText);
    }
    
    // Distribute emojis evenly throughout the text
    const emojiInterval = processedSentencesList.length > maxEmojis ? Math.floor(processedSentencesList.length / maxEmojis) : 1;
    
    processedSentencesList.forEach((sentence, index) => {
      const trimmedSentence = sentence.trim();
      
      if (!trimmedSentence || trimmedSentence.length < 5) {
        processedSentences.push(sentence);
        return;
      }
      
      // Skip if this sentence already has a step emoji (to avoid double emojis)
      const stepEmojiPattern = new RegExp(`[\\d]+[.)]\\s+[${stepEmojis.join('')}]`, 'g');
      if (stepEmojiPattern.test(trimmedSentence)) {
        processedSentences.push(sentence);
        return;
      }
      
      // Analyze sentiment for this sentence
      const sentimentResult = analyzeSentiment(trimmedSentence);
      
      // Add emoji if:
      // 1. We haven't exceeded the limit
      // 2. Either sentiment is strong OR it's at an interval position
      const shouldAddEmoji = emojiCount < maxEmojis && (
        sentimentResult.score > 0 || 
        (index > 0 && index % emojiInterval === 0 && emojiCount < maxEmojis - 1)
      );
      
      if (shouldAddEmoji) {
        let emoji = '';
        
        if (sentimentResult.score > 0) {
          switch (sentimentResult.sentiment) {
            case 'positive':
              emoji = [
                emojisData.reaction.SPARKLES,
                emojisData.professional.APPROVAL,
                emojisData.reaction.FIRE,
                emojisData.reaction.HUNDRED
              ][Math.floor(Math.random() * 4)];
              break;
            case 'excited':
              emoji = [
                emojisData.reaction.FIRE,
                emojisData.reaction.SPARKLES,
                emojisData.reaction.HUNDRED,
                emojisData.reaction.LAUGHTER
              ][Math.floor(Math.random() * 4)];
              break;
            case 'question':
              emoji = [
                emojisData.reaction.THINKING,
                emojisData.reaction.EYES,
                emojisData.professional.EXPLANATION
              ][Math.floor(Math.random() * 3)];
              break;
            case 'negative':
              emoji = [
                emojisData.professional.WARNING,
                emojisData.expressive.MELTING,
                emojisData.professional.IMPORTANT
              ][Math.floor(Math.random() * 3)];
              break;
            case 'neutral':
              // For neutral, only add if it's a greeting or helpful phrase
              if (/^(hello|hi|hey|greetings)\b/gi.test(trimmedSentence)) {
                emoji = emojisData.expressive.FOLDED_HANDS;
              } else if (/\b(how can i|what can i|let me know)\b/gi.test(trimmedSentence)) {
                emoji = emojisData.reaction.SPARKLES;
              }
              break;
          }
        } else {
          // For sentences without strong sentiment, add subtle emojis at intervals
          const subtleEmojis = [
            emojisData.reaction.SPARKLES,
            emojisData.professional.CONCEPT,
            emojisData.professional.KEY_POINT
          ];
          emoji = subtleEmojis[Math.floor(Math.random() * subtleEmojis.length)];
        }
        
        if (emoji) {
          // Add emoji at the end of the sentence (before punctuation if it exists)
          const hasPunctuation = /[.!?]$/.test(trimmedSentence);
          if (hasPunctuation) {
            processedSentences.push(sentence.replace(/([.!?]+)$/, ' ' + emoji + '$1'));
          } else {
            processedSentences.push(sentence.trim() + ' ' + emoji + (sentence.endsWith('\n') ? '\n' : ''));
          }
          emojiCount++;
        } else {
          processedSentences.push(sentence);
        }
      } else {
        processedSentences.push(sentence);
      }
    });
    
    return processedSentences.join('');
  });
  
  return processedParts.join('');
}

function MessageItem({ 
  message, 
  onRegenerate,
  onUpdateHighlights,
  highlightEnabled = true,
  onAskChatGPT
}: { 
  message: Message; 
  onRegenerate?: () => void;
  onUpdateHighlights?: (highlights: Highlight[]) => void;
  highlightEnabled?: boolean;
  onAskChatGPT?: (text: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [liked, setLiked] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [selectedHighlightId, setSelectedHighlightId] = useState("");
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteEditorPosition, setNoteEditorPosition] = useState({ x: 0, y: 0 });
  const [showAskChatGPT, setShowAskChatGPT] = useState(false);
  const [askChatGPTPosition, setAskChatGPTPosition] = useState({ x: 0, y: 0 });
  const [askChatGPTText, setAskChatGPTText] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle clicks on highlighted text and text selection
  useEffect(() => {
    if (message.role !== "assistant" || !contentRef.current || !highlightEnabled) return;

    // Handle clicks on highlighted text using event delegation
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const highlightElement = target.closest('.lc-highlight');
      
      if (highlightElement) {
        // Clicked on a highlight - show toolbar with delete option
        e.preventDefault();
        e.stopPropagation();
        
        const highlightText = highlightElement.getAttribute('data-highlight-text') || highlightElement.textContent?.trim() || '';
        const highlightId = highlightElement.getAttribute('data-highlight-id') || '';
        
        if (highlightText && onUpdateHighlights) {
          const rect = highlightElement.getBoundingClientRect();
          setToolbarPosition({
            x: rect.left + rect.width / 2,
            y: rect.top,
          });
          setSelectedText(highlightText);
          setSelectedHighlightId(highlightId);
          setShowToolbar(true);
          window.getSelection()?.removeAllRanges();
        }
        return;
      }
    };

    const handleTextSelection = (e: MouseEvent | TouchEvent) => {
      // Don't show toolbar if clicking on a highlight or Ask ChatGPT button (that's handled by handleClick)
      const target = e.target as HTMLElement;
      if (target?.closest('.lc-highlight') || target?.closest('.lc-ask-chatgpt-btn')) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setShowToolbar(false);
        setShowAskChatGPT(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();

      // Only show toolbar/Ask ChatGPT if text is selected and it's within this message
      if (selectedText.length > 0 && contentRef.current?.contains(range.commonAncestorContainer)) {
        // Check if selection is inside code blocks (don't allow highlighting code or asking about code)
        let node: Node | null = range.commonAncestorContainer;
        let isInCodeBlock = false;
        while (node && node !== contentRef.current) {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            ((node as Element).tagName === 'CODE' || 
             (node as Element).closest('.lc-code-block-wrapper') ||
             (node as Element).closest('pre'))
          ) {
            isInCodeBlock = true;
            break;
          }
          node = node.parentNode;
        }

        if (isInCodeBlock) {
          setShowToolbar(false);
          setShowAskChatGPT(false);
          return;
        }

        const rect = range.getBoundingClientRect();
        const position = {
          x: rect.left + rect.width / 2,
          y: rect.top,
        };

        // Show highlight toolbar if highlighting is enabled
        if (highlightEnabled) {
          setToolbarPosition(position);
          setSelectedText(selectedText);
          setShowToolbar(true);
        }

        // Always show Ask ChatGPT button (independent of highlight feature)
        if (onAskChatGPT) {
          setAskChatGPTPosition(position);
          setAskChatGPTText(selectedText);
          setShowAskChatGPT(true);
        }
      } else {
        setShowToolbar(false);
        setShowAskChatGPT(false);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      handleTextSelection(e);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Small delay to ensure selection is complete on mobile
      setTimeout(() => {
        handleTextSelection(e);
      }, 100);
    };

    const contentElement = contentRef.current;
    contentElement?.addEventListener('click', handleClick, true); // Use capture phase
    contentElement?.addEventListener('mouseup', handleMouseUp);
    contentElement?.addEventListener('touchend', handleTouchEnd);

    // Hide Ask ChatGPT when selection is cleared
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
        setShowAskChatGPT(false);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      contentElement?.removeEventListener('click', handleClick, true);
      contentElement?.removeEventListener('mouseup', handleMouseUp);
      contentElement?.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [message.role, message.content, highlightEnabled, onUpdateHighlights, onAskChatGPT]);

  // Track mobile state for regenerate button visibility
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 900);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleColorSelect = (color: Highlight["color"]) => {
    if (!selectedText || !onUpdateHighlights) return;

    const currentHighlights = message.highlights || [];
    
    // Check if this exact text is already highlighted (by text or ID)
    const existingIndex = currentHighlights.findIndex(
      (h) => selectedHighlightId ? h.id === selectedHighlightId : h.text === selectedText
    );

    let newHighlights: Highlight[];

    if (existingIndex >= 0) {
      // If same color, remove highlight (toggle off)
      if (currentHighlights[existingIndex].color === color) {
        newHighlights = currentHighlights.filter((_, i) => i !== existingIndex);
      } else {
        // If different color, update to new color (preserve id, note, createdAt)
        newHighlights = [...currentHighlights];
        newHighlights[existingIndex] = { 
          ...currentHighlights[existingIndex],
          color 
        };
      }
    } else {
      // Add new highlight with id and createdAt
      newHighlights = [...currentHighlights, { 
        id: uid("highlight"),
        text: selectedText, 
        color,
        createdAt: Date.now()
      }];
    }

    onUpdateHighlights(newHighlights);
    setShowToolbar(false);
    
    // Clear selection
    window.getSelection()?.removeAllRanges();
  };

  const handleRemoveHighlight = () => {
    if (!selectedText || !onUpdateHighlights) return;

    const currentHighlights = message.highlights || [];
    const newHighlights = currentHighlights.filter(
      (h) => selectedHighlightId ? h.id !== selectedHighlightId : h.text !== selectedText
    );

    onUpdateHighlights(newHighlights);
    setShowToolbar(false);
    setShowNoteEditor(false);
    
    // Clear selection
    window.getSelection()?.removeAllRanges();
  };

  const handleNoteSave = (note: string) => {
    if (!selectedHighlightId && !selectedText || !onUpdateHighlights) return;

    const currentHighlights = message.highlights || [];
    const newHighlights = currentHighlights.map(h => {
      const matches = selectedHighlightId ? h.id === selectedHighlightId : h.text === selectedText;
      return matches ? { ...h, note: note || undefined } : h;
    });

    onUpdateHighlights(newHighlights);
    setShowNoteEditor(false);
  };

  const handleOpenNoteEditor = () => {
    const currentHighlight = message.highlights?.find(
      h => selectedHighlightId ? h.id === selectedHighlightId : h.text === selectedText
    );
    
    if (currentHighlight) {
      setNoteEditorPosition(toolbarPosition);
      setShowNoteEditor(true);
      setShowToolbar(false);
    }
  };

  // Check if selected text is already highlighted
  const currentHighlight = message.highlights?.find(
    h => selectedHighlightId ? h.id === selectedHighlightId : h.text === selectedText
  );
  const isAlreadyHighlighted = !!currentHighlight;

  return (
    <div 
      className={`lc-msg ${message.role === "user" ? "is-user" : "is-assistant"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="lc-msg-inner">
        <div className="lc-msg-role">
          {message.role === "user" ? "You" : (
            // Show loading text in role area if message is empty
            (!message.content || message.content.trim().length === 0) ? (
              <span className="lc-typing-text">
                <LazyCookText /> is cooking
                <span className="lc-typing-dots">
                  <span className="lc-typing-dot">.</span>
                  <span className="lc-typing-dot">.</span>
                  <span className="lc-typing-dot">.</span>
                </span>
              </span>
            ) : (
              <LazyCookText />
            )
          )}
        </div>
        <div className="lc-msg-content" ref={contentRef}>
          {message.role === "assistant" ? (
            message.content && message.content.trim().length > 0 ? (
              <>
                <MarkdownContent 
                  content={message.content} 
                  highlights={message.highlights}
                  onHighlightClick={(text, event) => {
                    // This is a fallback - main handling is done via event delegation in handleClick
                    if (!highlightEnabled || !onUpdateHighlights) return;
                    
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const target = event.target as HTMLElement;
                    const rect = target.getBoundingClientRect();
                    setToolbarPosition({
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    });
                    setSelectedText(text);
                    setShowToolbar(true);
                    window.getSelection()?.removeAllRanges();
                  }}
                />
                {message.confidenceScore !== undefined && (
                  <div className="lc-confidence-score">
                    Confidence Score: {message.confidenceScore.toFixed(2)}
                  </div>
                )}
              </>
            ) : null
          ) : (
            message.content
          )}
        </div>
        {showToolbar && message.role === "assistant" && highlightEnabled && (
          <HighlightToolbar
            position={toolbarPosition}
            onColorSelect={handleColorSelect}
            onClose={() => setShowToolbar(false)}
            onRemove={handleRemoveHighlight}
            onNote={handleOpenNoteEditor}
            showRemove={isAlreadyHighlighted}
            showNote={isAlreadyHighlighted}
            currentHighlight={currentHighlight}
          />
        )}
        {showNoteEditor && message.role === "assistant" && highlightEnabled && currentHighlight && (
          <HighlightNoteEditor
            position={noteEditorPosition}
            highlightText={currentHighlight.text}
            currentNote={currentHighlight.note}
            onSave={handleNoteSave}
            onDelete={handleRemoveHighlight}
            onClose={() => setShowNoteEditor(false)}
          />
        )}
        {showAskChatGPT && message.role === "assistant" && onAskChatGPT && (
          <AskChatGPTButton
            position={askChatGPTPosition}
            selectedText={askChatGPTText}
            onAsk={onAskChatGPT}
            onClose={() => {
              setShowAskChatGPT(false);
              window.getSelection()?.removeAllRanges();
            }}
          />
        )}
        {showAskChatGPT && message.role === "assistant" && onAskChatGPT && (
          <AskChatGPTButton
            position={askChatGPTPosition}
            selectedText={askChatGPTText}
            onAsk={onAskChatGPT}
            onClose={() => {
              setShowAskChatGPT(false);
              window.getSelection()?.removeAllRanges();
            }}
          />
        )}
        {message.role === "assistant" && (isHovered || isMobile) && message.content && message.content.trim().length > 0 && (
          <div className="lc-msg-actions">
            <button
              className="lc-msg-action-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message.content);
                } catch (err) {
                  console.error('Copy failed:', err);
                }
              }}
              aria-label="Copy message"
              title="Copy"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.5 4.5H3.5C2.67157 4.5 2 5.17157 2 6V12.5C2 13.3284 2.67157 14 3.5 14H10C10.8284 14 11.5 13.3284 11.5 12.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 2H12.5C13.3284 2 14 2.67157 14 3.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 2C5.5 1.72386 5.72386 1.5 6 1.5H12.5C12.7761 1.5 13 1.72386 13 2V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className={`lc-msg-action-btn ${liked ? 'is-active' : ''}`}
              onClick={() => setLiked(!liked)}
              aria-label="Thumbs up"
              title="Good response"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 7.5H4.5V13.5H2.5C2.22386 13.5 2 13.2761 2 13V8C2 7.72386 2.22386 7.5 2.5 7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.5 7.5V6.5C4.5 5.67157 5.17157 5 6 5H7.5C7.77614 5 8 5.22386 8 5.5V6.5L6.5 10.5H11.5C12.3284 10.5 13 9.82843 13 9V8.5C13 8.22386 12.7761 8 12.5 8H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="lc-msg-action-btn"
              onClick={() => {}}
              aria-label="Thumbs down"
              title="Bad response"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.5 8.5H11.5V2.5H13.5C13.7761 2.5 14 2.72386 14 3V8C14 8.27614 13.7761 8.5 13.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11.5 8.5V9.5C11.5 10.3284 10.8284 11 10 11H8.5C8.22386 11 8 10.7761 8 10.5V9.5L9.5 5.5H4.5C3.67157 5.5 3 6.17157 3 7V7.5C3 7.77614 3.22386 8 3.5 8H6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="lc-msg-action-btn"
              onClick={() => {}}
              aria-label="Share"
              title="Share"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 8C11.8284 8 12.5 7.32843 12.5 6.5C12.5 5.67157 11.8284 5 11 5C10.1716 5 9.5 5.67157 9.5 6.5C9.5 7.32843 10.1716 8 11 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 11C5.82843 11 6.5 10.3284 6.5 9.5C6.5 8.67157 5.82843 8 5 8C4.17157 8 3.5 8.67157 3.5 9.5C3.5 10.3284 4.17157 11 5 11Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 3L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 8L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="lc-msg-action-btn"
              onClick={onRegenerate}
              aria-label="Regenerate"
              title="Regenerate response"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.5 8C1.5 11.5899 4.41015 14.5 8 14.5C9.61061 14.5 11.0899 13.9528 12.2803 13.0196" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14.5 8C14.5 4.41015 11.5899 1.5 8 1.5C6.38939 1.5 4.91015 2.04724 3.71967 2.98039" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M5.5 11.5L1.5 8L5.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.5 4.5L14.5 8L10.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="lc-msg-action-btn"
              onClick={() => {}}
              aria-label="More options"
              title="More"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="4" r="1" fill="currentColor"/>
                <circle cx="8" cy="8" r="1" fill="currentColor"/>
                <circle cx="8" cy="12" r="1" fill="currentColor"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
  
  // Debug: Log API base URL (remove in production if needed)
  if (import.meta.env.DEV) {
    console.log("🔗 [FRONTEND] API_BASE:", API_BASE);
    console.log("🔗 [FRONTEND] VITE_API_BASE env:", import.meta.env.VITE_API_BASE);
  }

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("1234");
  const [token, setToken] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatCopyStatus, setChatCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const [model, setModel] = useState<Model>("gemini");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTopbarMenu, setShowTopbarMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [prompt, setPrompt] = useState("");
  
  // Highlight feature toggle (default: enabled)
  const [highlightEnabled, setHighlightEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("lazycook_highlight_enabled");
      return saved !== null ? saved === 'true' : true; // Default to enabled
    }
    return true;
  });
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const topbarMenuRef = useRef<HTMLDivElement>(null);

  // Sidebar starts closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 900;
    }
    return true;
  });
  
  // Close sidebar on mobile when window resizes to mobile size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 900 && sidebarOpen) {
        setSidebarOpen(false);
      } else if (window.innerWidth > 900 && !sidebarOpen) {
        setSidebarOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  // Close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (topbarMenuRef.current && !topbarMenuRef.current.contains(event.target as Node)) {
        setShowTopbarMenu(false);
      }
    };

    if (showModelDropdown || showUserMenu || showTopbarMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModelDropdown, showUserMenu, showTopbarMenu]);

  // Escape key to close topbar menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTopbarMenu) {
        setShowTopbarMenu(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showTopbarMenu]);
  const [searchQuery, setSearchQuery] = useState("");

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId]
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Check if user is at bottom of chat - ChatGPT exact behavior
  const checkScrollPosition = () => {
    if (!threadRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = threadRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Show arrow when NOT at bottom (distance from bottom > threshold)
    // Lower threshold on mobile for better UX (20px vs 120px) - more sensitive on mobile
    const threshold = window.innerWidth <= 900 ? 20 : 120;
    const shouldShow = distanceFromBottom > threshold;
    setShowScrollToBottom(shouldShow);
  };

  // Scroll to bottom function - ChatGPT exact behavior
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      // Hide arrow after scrolling starts
      setTimeout(() => {
        checkScrollPosition();
      }, 100);
    }
  };

  useEffect(() => {
    if (!threadRef.current || !messagesEndRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = threadRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const threshold = window.innerWidth <= 900 ? 50 : 120;
    const isNearBottom = distanceFromBottom < threshold; // User is near bottom
    
    // Only auto-scroll if user is already near bottom
    // Hide arrow when new message arrives AND user is near bottom
    if (isNearBottom) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      setShowScrollToBottom(false); // Hide arrow when at bottom
    } else {
      // User scrolled up - show arrow after a brief delay
      setTimeout(checkScrollPosition, 100);
    }
  }, [activeChat?.messages.length, loading]);

  // Add scroll listener to thread
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    
    // Initial check
    checkScrollPosition();
    
    // Use passive listener for better performance
    const handleScroll = () => {
      checkScrollPosition();
    };
    
    thread.addEventListener('scroll', handleScroll, { passive: true });
    // Also listen to touch events for mobile scrolling
    thread.addEventListener('touchmove', handleScroll, { passive: true });
    // Listen to touch end to catch when user stops scrolling
    thread.addEventListener('touchend', handleScroll, { passive: true });
    
    // Also check on resize (mobile orientation change)
    const handleResize = () => {
      setTimeout(checkScrollPosition, 100);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      thread.removeEventListener('scroll', handleScroll);
      thread.removeEventListener('touchmove', handleScroll);
      thread.removeEventListener('touchend', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeChat, activeChatId]);

  // ---- Firebase Auth State Listener ----
  useEffect(() => {
    setAuthLoading(true);
    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        setFirebaseUser(user);
        setEmail(user.email || "");
        
        // Get Firebase ID token
        let idToken: string | null = null;
        try {
          idToken = await getIdToken();
          if (!idToken) {
            throw new Error("Failed to get ID token");
          }
          setToken(idToken);
        } catch (error: any) {
          console.error("Error getting ID token:", error);
          setError("Failed to authenticate. Please try again.");
          setAuthLoading(false);
          return;
        }
        
        // Check if user document exists in Firestore
        let userDoc;
        try {
          userDoc = await getUserDoc(user.uid);
        } catch (error: any) {
          console.error("Error fetching user doc:", error);
          // If it's a permissions error, treat as new user (Firestore rules not set up yet)
          if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Missing or insufficient permissions')) {
            console.warn("Firestore permissions error - treating as new user. Please set up Firestore security rules.");
            userDoc = null;
          } else {
            // Other errors - show warning but continue as new user
            console.warn("Firestore read error, treating as new user:", error);
            userDoc = null;
          }
        }
        
        try {
          if (!userDoc || !userDoc.plan) {
            // New user - show plan selector
            setIsNewUser(true);
            setShowPlanSelector(true);
            // Set default plan based on email (but don't save yet)
            const defaultPlan = getPlanFromEmail(user.email || "");
            setPlan(defaultPlan);
            // Set model to match default plan
            const allowedModel = PLAN_MODELS[defaultPlan]?.[0];
            if (allowedModel) {
              setModel(allowedModel);
            }
          } else {
            // Existing user - use their saved plan
            const savedPlan = userDoc.plan as Plan;
            setPlan(savedPlan);
            setIsNewUser(false);
            setShowPlanSelector(false);
            
            // Auto-select allowed model for the plan
            const allowedModel = PLAN_MODELS[savedPlan]?.[0];
            if (allowedModel) {
              setModel(allowedModel);
            }
            
            // Update last login (don't fail if this errors)
            try {
              await setUserDoc(user.uid, {
                lastLoginAt: new Date().toISOString()
              });
            } catch (error) {
              console.warn("Failed to update last login:", error);
            }
          }
        } catch (error) {
          console.error("Error processing user data:", error);
          setError("Failed to load user data. Please try again.");
        }
      } else {
        setFirebaseUser(null);
        setEmail("");
        setToken(null);
        setPlan(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Track local message updates to prevent Firestore from overwriting them
  const localMessageUpdates = useRef<Map<string, { messages: Message[], timestamp: number }>>(new Map());

  // ---- Load chats from Firestore when user is authenticated ----
  useEffect(() => {
    if (!firebaseUser) {
      // If not authenticated, use empty state
      setChats([]);
      setActiveChatId(null);
      localMessageUpdates.current.clear();
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let isInitialLoad = true;

    const loadChats = async () => {
      try {
        // Subscribe to real-time updates
        unsubscribe = subscribeToUserChats(firebaseUser.uid, (firestoreChats) => {
          // Convert Firestore data to Chat format
          const convertedChats: Chat[] = firestoreChats.map((doc: any) => {
            const chatId = doc.id;
            const firestoreMessages: Message[] = doc.messages || [];
            
            // Check if we have more recent local updates for this chat
            const localUpdate = localMessageUpdates.current.get(chatId);
            if (localUpdate && localUpdate.timestamp > Date.now() - 5000) {
              // Use local messages if they're more recent (within last 5 seconds)
              // This prevents Firestore from overwriting messages we just added
              console.log(`🔄 [FRONTEND] Using local messages for chat ${chatId} (more recent)`);
              return {
                id: chatId,
                title: doc.title || "New chat",
                createdAt: doc.createdAt?.toMillis?.() || doc.createdAt || Date.now(),
                messages: localUpdate.messages,
              };
            }
            
            return {
              id: chatId,
              title: doc.title || "New chat",
              createdAt: doc.createdAt?.toMillis?.() || doc.createdAt || Date.now(),
              messages: firestoreMessages,
            };
          });

          setChats((prevChats) => {
            // Merge with existing chats to preserve any local changes
            const mergedChats = convertedChats.map((firestoreChat) => {
              const existingChat = prevChats.find(c => c.id === firestoreChat.id);
              if (existingChat) {
                // If we have local updates, prefer them if they're newer
                const localUpdate = localMessageUpdates.current.get(firestoreChat.id);
                if (localUpdate && localUpdate.timestamp > Date.now() - 5000) {
                  return { ...firestoreChat, messages: localUpdate.messages };
                }
                // Otherwise, merge messages - keep local if they have more messages
                if (existingChat.messages.length > firestoreChat.messages.length) {
                  return existingChat; // Keep local version if it has more messages
                }
              }
              return firestoreChat;
            });
            
            // Add any local-only chats (not yet in Firestore)
            const localOnlyChats = prevChats.filter(
              c => !convertedChats.find(fc => fc.id === c.id)
            );
            
            return [...mergedChats, ...localOnlyChats];
          });

          // Set active chat only on initial load
          if (isInitialLoad && convertedChats.length > 0) {
            // Try to restore from localStorage first (for migration)
            const savedActive = localStorage.getItem("lazycook_active_chat");
            const foundChat = convertedChats.find(c => c.id === savedActive);
            setActiveChatId(foundChat?.id || convertedChats[0].id);
            if (savedActive) localStorage.removeItem("lazycook_active_chat"); // Clean up
            isInitialLoad = false;
          }
        });
      } catch (error) {
        console.error("Error loading chats from Firestore:", error);
        // Fallback: create empty chat
        const first: Chat = { id: uid("chat"), title: "New chat", createdAt: Date.now(), messages: [] };
        setChats([first]);
        setActiveChatId(first.id);
      }
    };

    loadChats();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [firebaseUser]);

  // ---- Save chat to Firestore when it changes ----
  useEffect(() => {
    if (!firebaseUser || chats.length === 0) return;

    // Only save the active chat to reduce Firestore writes
    const saveActiveChat = async () => {
      if (!activeChatId) return;
      
      const activeChat = chats.find(c => c.id === activeChatId);
      if (!activeChat) return;
      
      try {
        await setChatDoc(firebaseUser.uid, activeChat.id, {
          title: activeChat.title,
          createdAt: activeChat.createdAt,
          messages: activeChat.messages,
        });
        console.log("💾 [FRONTEND] Saved active chat to Firestore");
      } catch (error) {
        console.error(`Error saving active chat ${activeChat.id} to Firestore:`, error);
        // If it's a resource exhaustion error, wait longer before retrying
        if (error instanceof Error && error.message.includes('resource-exhausted')) {
          console.warn("⚠️ [FRONTEND] Firestore resource exhausted, will retry later");
        }
      }
    };

    // Increased debounce time to reduce write frequency (2 seconds instead of 500ms)
    const timeoutId = setTimeout(saveActiveChat, 2000);
    return () => clearTimeout(timeoutId);
  }, [chats, firebaseUser, activeChatId]);

  // ---- Save active chat ID to localStorage (for quick restore) ----
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem("lazycook_active_chat", activeChatId);
    }
  }, [activeChatId]);

  // Persist highlight setting
  useEffect(() => {
    localStorage.setItem("lazycook_highlight_enabled", String(highlightEnabled));
  }, [highlightEnabled]);

  // Auto-resize textarea like ChatGPT - grows and shrinks with content
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to get accurate scrollHeight
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Set new height, respecting min and max
      const minHeight = 44;
      const maxHeight = 200;
      const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [prompt]);

  // Highlight Analytics
  type HighlightAnalytics = {
    totalHighlights: number;
    byColor: Record<string, number>;
    mostHighlightedWords: string[];
    avgHighlightsPerMessage: number;
    messagesWithHighlights: number;
  };

  const analyzeHighlights = (messages: Message[]): HighlightAnalytics => {
    const highlights = messages.flatMap(m => m.highlights || []);
    
    const wordFrequency: Record<string, number> = {};
    highlights.forEach(h => {
      h.text.split(/\s+/).forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
        if (cleanWord.length > 2) { // Ignore very short words
          wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;
        }
      });
    });

    return {
      totalHighlights: highlights.length,
      byColor: highlights.reduce((acc, h) => {
        acc[h.color] = (acc[h.color] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      mostHighlightedWords: Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word),
      avgHighlightsPerMessage: highlights.length / Math.max(1, messages.length),
      messagesWithHighlights: messages.filter(m => m.highlights?.length).length
    };
  };

  // Export Highlights Functions
  const exportHighlights = (chat: Chat) => {
    return chat.messages.flatMap((msg, index) =>
      (msg.highlights || []).map(h => ({
        text: h.text,
        color: h.color,
        note: h.note,
        messageIndex: index,
        createdAt: h.createdAt
      }))
    );
  };

  // Unused functions - commented out to fix TypeScript build errors
  // Can be uncommented if needed in the future
  /*
  const exportHighlightsAsJSON = (chat: Chat) => {
    const highlights = exportHighlights(chat);
    return JSON.stringify({
      chatTitle: chat.title,
      createdAt: new Date(chat.createdAt).toISOString(),
      highlights: highlights,
      analytics: analyzeHighlights(chat.messages)
    }, null, 2);
  };

  const exportHighlightsAsMarkdown = (chat: Chat) => {
    const highlights = exportHighlights(chat);
    const analytics = analyzeHighlights(chat.messages);
    
    let markdown = `# Highlights – ${chat.title}\n\n`;
    markdown += `**Created:** ${new Date(chat.createdAt).toLocaleDateString()}\n\n`;
    markdown += `**Total Highlights:** ${analytics.totalHighlights}\n\n`;
    markdown += `---\n\n`;

    if (highlights.length === 0) {
      markdown += `*No highlights in this chat.*\n`;
      return markdown;
    }

    const colorEmojis: Record<string, string> = {
      yellow: '🟡',
      blue: '🔵',
      green: '🟢',
      pink: '🩷',
      purple: '🟣'
    };

    highlights.forEach((h, idx) => {
      const emoji = colorEmojis[h.color] || '📌';
      markdown += `## ${emoji} Highlight ${idx + 1}\n\n`;
      markdown += `**Text:** ${h.text}\n\n`;
      if (h.note) {
        markdown += `**Note:** ${h.note}\n\n`;
      }
      markdown += `**Color:** ${h.color}\n\n`;
      markdown += `**Message Index:** ${h.messageIndex}\n\n`;
      markdown += `---\n\n`;
    });

    markdown += `## Analytics\n\n`;
    markdown += `- **Total Highlights:** ${analytics.totalHighlights}\n`;
    markdown += `- **By Color:** ${Object.entries(analytics.byColor).map(([c, n]) => `${c}: ${n}`).join(', ')}\n`;
    markdown += `- **Most Highlighted Words:** ${analytics.mostHighlightedWords.join(', ')}\n`;
    markdown += `- **Avg Highlights per Message:** ${analytics.avgHighlightsPerMessage.toFixed(2)}\n`;
    markdown += `- **Messages with Highlights:** ${analytics.messagesWithHighlights}\n`;

    return markdown;
  };
  */

  // Unused functions - commented out to fix TypeScript build errors
  // Can be uncommented if needed in the future
  /*
  const copyHighlightsToClipboard = async (chat: Chat) => {
    try {
      const json = exportHighlightsAsJSON(chat);
      await navigator.clipboard.writeText(json);
      return true;
    } catch (error) {
      console.error('Failed to copy highlights:', error);
      return false;
    }
  };

  const downloadHighlightsAsJSON = (chat: Chat) => {
    const json = exportHighlightsAsJSON(chat);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `highlights-${chat.title.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadHighlightsAsMarkdown = (chat: Chat) => {
    const markdown = exportHighlightsAsMarkdown(chat);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `highlights-${chat.title.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  */

  const logout = async () => {
    try {
      await logOut();
      setToken(null);
      setPlan(null);
      setEmail("");
      setFirebaseUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      setError("Failed to logout");
    }
  };

  const login = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      // Try to sign in first
      try {
        await signIn(email, password);
      } catch (signInError: any) {
        // If user doesn't exist, try to sign up (for test emails)
        if (signInError.code === "auth/user-not-found") {
          // Create account if it doesn't exist (useful for test emails)
          try {
            await signUp(email, password);
          } catch (signUpError: any) {
            throw new Error(signUpError.message || "Failed to create account");
          }
        } else if (signInError.code === "auth/wrong-password") {
          throw new Error("Incorrect password. Please try again.");
        } else if (signInError.code === "auth/invalid-email") {
          throw new Error("Invalid email address");
        } else if (signInError.code === "auth/weak-password") {
          throw new Error("Password should be at least 6 characters");
        } else {
          throw new Error(signInError.message || "Login failed");
        }
      }

      // User is now authenticated via Firebase Auth state listener
      // The listener will handle setting token, plan, etc.
      
    } catch (e: any) {
      const errorMessage = e.message || "Login failed";
      setError(errorMessage);
      console.error("Login error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // User is now authenticated via Firebase Auth state listener
    } catch (e: any) {
      const errorMessage = e.message || "Google sign-in failed";
      setError(errorMessage);
      console.error("Google sign-in error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = async (newPlan: Plan) => {
    if (!firebaseUser) return;
    
    try {
      // Update plan in Firestore
      await updateUserPlan(firebaseUser.uid, newPlan);
      
      // Update subscription (mock)
      await updateUserSubscription(firebaseUser.uid, {
        plan: newPlan,
        status: 'active',
        startDate: new Date().toISOString(),
        paymentMethod: 'mock_payment'
      });
      
      // Store initial user data if new user
      if (isNewUser) {
        await setUserDoc(firebaseUser.uid, {
          email: firebaseUser.email,
          plan: newPlan,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        });
        setIsNewUser(false);
      }
      
      // Update local state
      setPlan(newPlan);
      setShowPlanSelector(false);
      
      // Auto-select allowed model for the new plan
      const allowed = PLAN_MODELS[newPlan]?.[0];
      if (allowed) setModel(allowed);
    } catch (error) {
      console.error("Error updating plan:", error);
      setError("Failed to update plan. Please try again.");
    }
  };

  const newChat = async () => {
    if (!firebaseUser) {
      setError("Please sign in to create a new chat");
      return;
    }

    const c: Chat = { id: uid("chat"), title: "New chat", createdAt: Date.now(), messages: [] };
    
    // Add to local state immediately for instant UI update
    setChats((prev) => [c, ...prev]);
    setActiveChatId(c.id);
    setPrompt("");
    setError(null);
    
    // Save to Firestore
    try {
      await setChatDoc(firebaseUser.uid, c.id, {
        title: c.title,
        createdAt: c.createdAt,
        messages: c.messages,
      });
    } catch (error) {
      console.error("Error creating new chat in Firestore:", error);
      setError("Failed to create new chat. Please try again.");
    }
    
    // Reset textarea height after creating new chat
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '44px';
    }
  };

  const updateChatMessages = (chatId: string, updater: (m: Message[]) => Message[]) => {
    setChats((prev) => {
      const updated = prev.map((c) => {
        if (c.id === chatId) {
          const updatedMessages = updater(c.messages);
          // Track this update locally to prevent Firestore from overwriting it
          localMessageUpdates.current.set(chatId, {
            messages: updatedMessages,
            timestamp: Date.now()
          });
          // Clear the local update after 10 seconds (by then it should be saved to Firestore)
          setTimeout(() => {
            localMessageUpdates.current.delete(chatId);
          }, 10000);
          return { ...c, messages: updatedMessages };
        }
        return c;
      });
      return updated;
    });
  };

  // Refresh token periodically (Firebase tokens expire after 1 hour)
  useEffect(() => {
    if (!firebaseUser) return;

    const refreshToken = async () => {
      try {
        const newToken = await getIdToken();
        setToken(newToken);
      } catch (error) {
        console.error("Error refreshing token:", error);
      }
    };

    // Refresh token every 50 minutes
    const interval = setInterval(refreshToken, 50 * 60 * 1000);
    
    // Also refresh on mount
    refreshToken();

    return () => clearInterval(interval);
  }, [firebaseUser]);

  const runAI = async () => {
    if (!token || !plan || !firebaseUser) {
      if (!plan) {
        setError("Please select a plan to use AI features");
        setShowPlanSelector(true);
      }
      return;
    }
    const text = prompt.trim();
    if (!text) return;
    if (!PLAN_MODELS[plan].includes(model)) {
      setError("Upgrade plan to access this model.");
      return;
    }

    // If no active chat, create a new one (title will be set from response)
    let chatId = activeChatId;
    if (!chatId || !chats.find((c) => c.id === chatId)) {
      const newChat: Chat = {
        id: uid("chat"),
        title: "New chat", // Will be updated when response arrives
        createdAt: Date.now(),
        messages: [],
      };
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      chatId = newChat.id;
      
      // Save new chat to Firestore
      try {
        await setChatDoc(firebaseUser.uid, newChat.id, {
          title: newChat.title,
          createdAt: newChat.createdAt,
          messages: newChat.messages,
        });
      } catch (error) {
        console.error("Error creating new chat in Firestore:", error);
      }
    }
    
    console.log("🔍 [FRONTEND] Sending request with chat_id:", chatId);

    setLoading(true);
    setError(null);

    const userMsg: Message = { id: uid("m"), role: "user", content: text };
    const assistantMsg: Message = { id: uid("m"), role: "assistant", content: "" };

    // Add messages immediately to local state
    console.log("➕ [FRONTEND] Adding user and assistant messages to chat:", chatId);
    updateChatMessages(chatId, (m) => {
      const updated = [...m, userMsg, assistantMsg];
      console.log("✅ [FRONTEND] Messages added. Total messages in chat:", updated.length);
      return updated;
    });
    
    // Immediately save to Firestore to prevent race conditions
    try {
      const currentChat = chats.find(c => c.id === chatId) || { id: chatId, title: "New chat", createdAt: Date.now(), messages: [] };
      const updatedMessages = [...currentChat.messages, userMsg, assistantMsg];
      await setChatDoc(firebaseUser.uid, chatId, {
        title: currentChat.title,
        createdAt: currentChat.createdAt,
        messages: updatedMessages,
      });
      console.log("💾 [FRONTEND] Messages saved to Firestore immediately");
    } catch (error) {
      console.error("⚠️ [FRONTEND] Failed to save messages immediately, will retry:", error);
      // Continue anyway - the debounced save will retry
    }
    
    setPrompt("");
    // Reset textarea height immediately after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '44px';
    }

    try {
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
      
      const res = await fetch(`${API_BASE}/ai/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-ID": firebaseUser?.uid || email || "anon",
          "X-User-Plan": plan || "GO",
        },
        body: JSON.stringify({ prompt: text, model, chat_id: chatId }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Check if response is ok before parsing
      if (!res.ok) {
        let errorDetail = "Request failed";
        try {
          const errorData = await res.json();
          errorDetail = errorData.detail || errorData.message || errorDetail;
        } catch {
          // If JSON parsing fails, use status text
          errorDetail = res.statusText || `HTTP ${res.status}`;
        }
        throw new Error(errorDetail);
      }
      
      // Parse JSON response
      let data;
      try {
        const text = await res.text();
        if (!text || text.trim() === "") {
          throw new Error("Empty response from server");
        }
        data = JSON.parse(text);
        console.log("📥 [FRONTEND] Received API response:", data);
      } catch (parseError) {
        console.error("❌ [FRONTEND] Failed to parse JSON response:", parseError);
        throw new Error("Invalid response from server. Please try again.");
      }

      // Extract response - lazycook_grok_gemini.py provides unified mixed response for ULTRA
      // All models (GO, PRO, ULTRA) now return data.response with unified content
      // PRO version might also have data.optimization field
      let content = data.response || data.optimization || JSON.stringify(data.responses ?? data, null, 2);
      console.log("📝 [FRONTEND] Extracted content:", content?.substring(0, 100) + "...");
      // Ensure content is always a string
      content = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      
      // Clean PRO version responses to remove JSON artifacts and extract content properly
      if (plan === 'PRO') {
        content = cleanProResponse(content);
      }
      
      // Extract confidence score from API response
      const confidenceScore = data.quality_score || data.metadata?.quality_score || data.quality_metrics?.combined || undefined;
      
      // Enhance content with emojis for better engagement (applies to all plans including PRO)
      // This ensures PRO responses get emojis just like GO responses
      content = enhanceWithEmojis(content);
      
      console.log("💬 [FRONTEND] Updating chat messages with content length:", content?.length);
      
      // Update the assistant message with the response
      updateChatMessages(chatId, (m) => {
        const next = [...m];
        // Try to find by ID first
        let idx = next.findIndex((x) => x.id === assistantMsg.id);
        
        // If not found by ID, find the last assistant message with empty content
        if (idx < 0) {
          console.warn("⚠️ [FRONTEND] Assistant message not found by ID, searching for last empty assistant message");
          // Find the last assistant message that's empty (the one we just added)
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === "assistant" && (!next[i].content || next[i].content.trim() === "")) {
              idx = i;
              console.log("✅ [FRONTEND] Found empty assistant message at index:", idx);
              break;
            }
          }
        }
        
        if (idx >= 0) {
          console.log("✅ [FRONTEND] Updating assistant message at index:", idx, "with content length:", content?.length);
          next[idx] = { ...next[idx], content, confidenceScore };
        } else {
          console.error("❌ [FRONTEND] Could not find assistant message! Adding new one.");
          // Fallback: add the message at the end
          next.push({ ...assistantMsg, content, confidenceScore });
        }
        
        // Immediately save updated messages to Firestore
        const updatedMessages = next;
        setChatDoc(firebaseUser.uid, chatId, {
          title: chats.find(c => c.id === chatId)?.title || "New chat",
          createdAt: chats.find(c => c.id === chatId)?.createdAt || Date.now(),
          messages: updatedMessages,
        }).catch(error => {
          console.error("⚠️ [FRONTEND] Failed to save response to Firestore:", error);
        });
        
        return updatedMessages;
      });
      
      // Update chat title from user message (ChatGPT-style: generate from first meaningful user prompt)
      // Use the user message that was just sent (text variable) and optionally AI response (content)
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === chatId && (c.title === "New chat" || c.messages.length === 2)) {
            const title = generateChatTitle(text, content);
            return { ...c, title };
          }
          return c;
        })
      );
    } catch (e) {
      console.error("❌ [FRONTEND] Error in runAI:", e);
      const errorMessage = (e as Error).message || "Unknown error occurred";
      console.error("❌ [FRONTEND] Error message:", errorMessage);
      const isTimeout = errorMessage.includes('aborted') || errorMessage.includes('timeout') || errorMessage.includes('Failed to fetch');
      
      // Ensure error message is shown in the chat
      updateChatMessages(chatId, (m) => {
        const next = [...m];
        // Try to find by ID first
        let idx = next.findIndex((x) => x.id === assistantMsg.id);
        
        // If not found, find the last empty assistant message
        if (idx < 0) {
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === "assistant" && (!next[i].content || next[i].content.trim() === "")) {
              idx = i;
              break;
            }
          }
        }
        
        const errorContent = isTimeout 
          ? "Request timed out. The AI is processing your request, but it's taking longer than expected. Please try again or check your connection." 
          : `Error: ${errorMessage}`;
        
        if (idx >= 0) {
          next[idx] = { 
            ...next[idx], 
            content: errorContent
          };
        } else {
          // If still not found, add error message at the end
          next.push({ 
            ...assistantMsg, 
            content: errorContent
          });
        }
        
        // Save error state to Firestore
        setChatDoc(firebaseUser.uid, chatId, {
          title: chats.find(c => c.id === chatId)?.title || "New chat",
          createdAt: chats.find(c => c.id === chatId)?.createdAt || Date.now(),
          messages: next,
        }).catch(error => {
          console.error("⚠️ [FRONTEND] Failed to save error state to Firestore:", error);
        });
        
        return next;
      });
      
      setError(isTimeout ? "Request timed out. Please try again." : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onComposerKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runAI();
    }
  };

  const regenerateResponse = async (assistantMessageId: string) => {
    if (!token || !plan || !activeChat) return;
    
    // Find the assistant message and the user message before it
    const messages = activeChat.messages;
    const assistantIndex = messages.findIndex(m => m.id === assistantMessageId);
    if (assistantIndex === -1 || messages[assistantIndex].role !== 'assistant') return;
    
    // Find the previous user message
    let userMessage: Message | null = null;
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i];
        break;
      }
    }
    
    if (!userMessage) {
      setError('No user message found to regenerate from');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/ai/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-ID": firebaseUser?.uid || email || "anon",
          "X-User-Plan": plan || "GO",
        },
        body: JSON.stringify({ prompt: userMessage.content, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");

      // Extract response - lazycook_grok_gemini.py provides unified mixed response for ULTRA
      // All models (GO, PRO, ULTRA) now return data.response with unified content
      // PRO version might also have data.optimization field
      let content = data.response || data.optimization || JSON.stringify(data.responses ?? data, null, 2);
      // Ensure content is always a string
      content = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      
      // Clean PRO version responses to remove JSON artifacts and extract content properly
      if (plan === 'PRO') {
        content = cleanProResponse(content);
      }
      
      // Extract confidence score from API response
      const confidenceScore = data.quality_score || data.metadata?.quality_score || data.quality_metrics?.combined || undefined;
      
      // Enhance content with emojis for better engagement (applies to all plans including PRO)
      // This ensures PRO responses get emojis just like GO responses
      content = enhanceWithEmojis(content);
      
      // Update the assistant message with new content
      updateChatMessages(activeChat.id, (m) => {
        const next = [...m];
        const idx = next.findIndex((x) => x.id === assistantMessageId);
        if (idx >= 0) next[idx] = { ...next[idx], content, confidenceScore };
        return next;
      });
    } catch (e) {
      updateChatMessages(activeChat.id, (m) => {
        const next = [...m];
        const idx = next.findIndex((x) => x.id === assistantMessageId);
        if (idx >= 0) next[idx] = { ...next[idx], content: `Error: ${(e as Error).message}` };
        return next;
      });
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyWholeChat = async () => {
    if (!activeChat) return;
    
    const chatText = activeChat.messages
      .map((m) => {
        const role = m.role === "user" ? "You" : "LazyCook";
        return `${role}:\n${m.content}\n\n`;
      })
      .join("---\n\n");
    
    try {
      await navigator.clipboard.writeText(chatText);
      setChatCopyStatus('copied');
      setTimeout(() => setChatCopyStatus('idle'), 2000);
    } catch (err) {
      setChatCopyStatus('error');
      setTimeout(() => setChatCopyStatus('idle'), 3000);
    }
  };

  const downloadChatAsPDF = async () => {
    if (!activeChat) {
      alert('No active chat to download.');
      return;
    }
    
    let loadingMsg: HTMLDivElement | null = null;
    let pdfContainer: HTMLDivElement | null = null;
    
    try {
      // Show loading indicator
      loadingMsg = document.createElement('div');
      loadingMsg.id = 'pdf-loading-indicator';
      loadingMsg.style.position = 'fixed';
      loadingMsg.style.top = '20px';
      loadingMsg.style.right = '20px';
      loadingMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      loadingMsg.style.color = 'white';
      loadingMsg.style.padding = '12px 20px';
      loadingMsg.style.borderRadius = '8px';
      loadingMsg.style.zIndex = '10000';
      loadingMsg.textContent = 'Generating PDF...';
      document.body.appendChild(loadingMsg);

      // Create a temporary container for PDF rendering (hidden but visible for rendering)
      pdfContainer = document.createElement('div');
      if (!pdfContainer) {
        throw new Error('Failed to create PDF container');
      }
      
      // TypeScript guard - pdfContainer is now guaranteed to be non-null
      const container = pdfContainer;
      
      container.id = 'pdf-container-temp';
      container.style.position = 'absolute';
      container.style.left = '-99999px'; // Move off-screen but keep visible for canvas
      container.style.top = '0';
      container.style.width = '768px';
      container.style.maxWidth = '768px';
      container.style.margin = '0 auto'; // Center the container
      container.style.backgroundColor = '#0b0b0f';
      container.style.color = 'rgba(255, 255, 255, 0.92)';
      container.style.padding = '24px';
      container.style.fontFamily = 'system-ui, Avenir, Helvetica, Arial, sans-serif';
      container.style.overflow = 'visible';
      container.style.zIndex = '0'; // Must be 0 or positive for html2canvas
      container.style.opacity = '1'; // MUST be visible for html2canvas to work
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);

      console.log('PDF: Container created, messages count:', activeChat.messages.length);

      // Add title
      const titleDiv = document.createElement('div');
      titleDiv.style.fontSize = '20px';
      titleDiv.style.fontWeight = 'bold';
      titleDiv.style.marginBottom = '8px';
      titleDiv.style.color = 'rgba(255, 255, 255, 0.92)';
      titleDiv.textContent = activeChat.title || "Chat Conversation";
      container.appendChild(titleDiv);

      // Add date
      const dateDiv = document.createElement('div');
      dateDiv.style.fontSize = '12px';
      dateDiv.style.color = 'rgba(255, 255, 255, 0.5)';
      dateDiv.style.marginBottom = '24px';
      dateDiv.textContent = new Date(activeChat.createdAt).toLocaleString();
      container.appendChild(dateDiv);

      // Clone and render messages
      activeChat.messages.forEach((m) => {
        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '24px';
        msgDiv.style.display = 'flex';
        msgDiv.style.flexDirection = 'column';
        msgDiv.style.gap = '8px';

        // Role label
        const roleDiv = document.createElement('div');
        roleDiv.style.fontSize = '13px';
        roleDiv.style.fontWeight = '600';
        roleDiv.style.color = 'rgba(255, 255, 255, 0.7)';
        roleDiv.style.marginBottom = '4px';
        if (m.role === 'user') {
          roleDiv.textContent = 'You';
        } else {
          roleDiv.innerHTML = 'La<span style="color: #ff4444; font-weight: 700;">z</span>yCook';
        }
        msgDiv.appendChild(roleDiv);

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.style.fontSize = '14px';
        contentDiv.style.lineHeight = '1.6';
        contentDiv.style.color = 'rgba(255, 255, 255, 0.92)';
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.style.wordWrap = 'break-word';
        
        if (m.role === 'assistant') {
          // For assistant messages, we need to render markdown
          // Simple markdown to HTML conversion for PDF
          let htmlContent = m.content
            // Code blocks (multiline)
            .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_match, _lang, code) => {
              return `<pre style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; overflow-x: auto; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; margin: 12px 0; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word;"><code>${code.trim()}</code></pre>`;
            })
            // Inline code
            .replace(/`([^`\n]+)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">$1</code>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 700;">$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em style="font-style: italic;">$1</em>')
            // Headings
            .replace(/^#### (.+)$/gm, '<h4 style="font-size: 16px; font-weight: 700; margin: 16px 0 8px 0; line-height: 1.3;">$1</h4>')
            .replace(/^### (.+)$/gm, '<h3 style="font-size: 18px; font-weight: 700; margin: 18px 0 10px 0; line-height: 1.3;">$1</h3>')
            .replace(/^## (.+)$/gm, '<h2 style="font-size: 20px; font-weight: 700; margin: 20px 0 12px 0; line-height: 1.3;">$1</h2>')
            .replace(/^# (.+)$/gm, '<h1 style="font-size: 24px; font-weight: 700; margin: 24px 0 14px 0; line-height: 1.3;">$1</h1>')
            // Lists
            .replace(/^\- (.+)$/gm, '<li style="margin: 4px 0; padding-left: 8px;">$1</li>')
            .replace(/^(\d+)\. (.+)$/gm, '<li style="margin: 4px 0; padding-left: 8px;">$2</li>')
            // Line breaks
            .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
            .replace(/\n/g, '<br>');
          
          // Wrap in paragraph if not already wrapped
          if (!htmlContent.startsWith('<')) {
            htmlContent = `<p style="margin: 8px 0;">${htmlContent}</p>`;
          } else {
            htmlContent = `<div>${htmlContent}</div>`;
          }
          
          // Replace LazyCook with red z
          htmlContent = htmlContent.replace(/LazyCook/gi, 'La<span style="color: #ff4444; font-weight: 700;">z</span>yCook');
          
          contentDiv.innerHTML = htmlContent;
        } else {
          contentDiv.textContent = m.content;
        }
        
        msgDiv.appendChild(contentDiv);
        container.appendChild(msgDiv);
      });

      // Wait for DOM to update and images/fonts to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('PDF: Container dimensions:', {
        width: container.scrollWidth,
        height: container.scrollHeight,
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight
      });

      // Capture as canvas
      console.log('PDF: Starting html2canvas...');
      const canvas = await html2canvas(container, {
        backgroundColor: '#0b0b0f',
        scale: window.devicePixelRatio || 2,
        useCORS: true,
        width: container.scrollWidth,
        height: container.scrollHeight,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight,
      });

      console.log('PDF: Canvas created:', {
        width: canvas.width,
        height: canvas.height
      });

      // DO NOT remove container yet - wait until after PDF is saved
      // Remove loading indicator only
      if (loadingMsg && loadingMsg.parentElement) {
        document.body.removeChild(loadingMsg);
      }

      // Convert canvas to PDF
      console.log('PDF: Converting canvas to image...');
      const imgData = canvas.toDataURL('image/png');
      if (!imgData || imgData === 'data:,') {
        throw new Error('Failed to convert canvas to image');
      }
      console.log('PDF: Image data created, length:', imgData.length);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      console.log('PDF: PDF document created');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate scaling to fit page width (always scale to width, split by height)
      const pageMargin = 10; // 10mm margin on each side
      const availableWidth = pdfWidth - (pageMargin * 2);
      const availableHeight = pdfHeight - (pageMargin * 2);
      
      // ALWAYS scale to fit width (don't scale to fit height, that makes content too narrow)
      const ratio = availableWidth / imgWidth;
      
      const imgScaledWidth = imgWidth * ratio;
      
      // Calculate centered position
      const xPosition = (pdfWidth - imgScaledWidth) / 2;
      const yStart = pageMargin;
      
      // Calculate how many pixels fit on one page
      const pageHeightInPixels = availableHeight / ratio;
      
      // Always split across multiple pages if content is longer than one page
      let heightLeft = imgHeight;
      let position = 0;
      let isFirstPage = true;

      while (heightLeft > 0) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;
        
        const currentPageHeight = Math.min(pageHeightInPixels, heightLeft);
        
        const pageCanvas = document.createElement('canvas');
        const pageCtx = pageCanvas.getContext('2d');
        pageCanvas.width = imgWidth;
        pageCanvas.height = currentPageHeight;

        if (pageCtx) {
          pageCtx.drawImage(
            canvas,
            0,
            position,
            imgWidth,
            currentPageHeight,
            0,
            0,
            imgWidth,
            currentPageHeight
          );
        }

        const pageImgData = pageCanvas.toDataURL('image/png');
        const pageImgScaledHeight = currentPageHeight * ratio;
        
        // Center each page horizontally, start from top margin
        pdf.addImage(pageImgData, 'PNG', xPosition, yStart, imgScaledWidth, pageImgScaledHeight);

        heightLeft -= currentPageHeight;
        position += currentPageHeight;
      }

      // Save PDF - use ONLY blob download method (most reliable)
      const filename = `${(activeChat.title || "chat").replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
      console.log('PDF: Saving file:', filename);
      
      // Generate PDF blob and create download link
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      console.log('PDF: Download triggered via blob method');
      
      // Cleanup: Remove container and link after download starts
      setTimeout(() => {
        // Remove download link
        if (link.parentElement) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(blobUrl);
        
        // Remove container (now safe to remove)
        if (container && container.parentElement) {
          document.body.removeChild(container);
        }
        console.log('PDF: Cleanup complete');
      }, 2000);
      
      // Update loading message with helpful instructions
      if (loadingMsg && loadingMsg.parentElement) {
        loadingMsg.innerHTML = `
          <div style="text-align: center;">
            <div style="font-size: 18px; margin-bottom: 8px;">✓ PDF Generated!</div>
            <div style="font-size: 12px; margin-bottom: 12px;">File: ${filename}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.8);">
              <div>1. Press <strong>Ctrl+J</strong> to open Downloads</div>
              <div>2. Check: <strong>C:\\Users\\parth\\Downloads</strong></div>
              <div>3. Look for: <strong>${filename}</strong></div>
            </div>
          </div>
        `;
        loadingMsg.style.backgroundColor = 'rgba(76, 175, 80, 0.95)';
        loadingMsg.style.maxWidth = '400px';
        loadingMsg.style.padding = '20px';
        loadingMsg.style.fontSize = '13px';
        setTimeout(() => {
          if (loadingMsg && loadingMsg.parentElement) {
            document.body.removeChild(loadingMsg);
          }
        }, 8000);
      }
      
      console.log('PDF: Download complete!');
      console.log('PDF: File location should be:', `C:\\Users\\parth\\Downloads\\${filename}`);
    } catch (err) {
      console.error('PDF generation error:', err);
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      // Clean up in case of error
      if (loadingMsg && loadingMsg.parentElement) {
        document.body.removeChild(loadingMsg);
      }
      const tempContainer = document.getElementById('pdf-container-temp');
      if (tempContainer && tempContainer.parentElement) {
        document.body.removeChild(tempContainer);
      }
      
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('PDF Error details:', errorMsg);
      alert(`Failed to generate PDF: ${errorMsg}\n\nPlease check the browser console (F12) for more details.`);
    }
  };

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="lc-login">
        <div className="lc-login-card">
          <div className="lc-brand">
            <img src={logoImg} alt="LazyCook" className="lc-logo" />
            <div>
              <div className="lc-title"><LazyCookText /></div>
              <div className="lc-subtitle">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!token || !firebaseUser) {
    return (
      <div className="lc-login">
        <div className="lc-login-card">
          <div className="lc-brand">
            <img src={logoImg} alt="LazyCook" className="lc-logo" />
            <div>
              <div className="lc-title"><LazyCookText /></div>
              <div className="lc-subtitle">Sign in to continue</div>
            </div>
          </div>

          <button 
            className="lc-google-btn" 
            onClick={handleGoogleSignIn}
            disabled={loading}
            type="button"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="lc-divider">
            <span>or</span>
          </div>

          <label className="lc-label">Email</label>
          <input
            className="lc-input"
            placeholder="go@lazycook.ai"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />

          <label className="lc-label">Password</label>
          <input
            className="lc-input"
            placeholder="Enter password (min 6 characters)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />

          <button className="lc-primary" onClick={login} disabled={loading}>
            {loading ? "Signing in..." : "Continue"}
          </button>

          {error && <div className="lc-error">{error}</div>}
          <div className="lc-hint">
            Tip: use <code>go@lazycook.ai</code> / <code>pro@lazycook.ai</code> / <code>ultra@lazycook.ai</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="lc-shell">
      {sidebarOpen && (
        <div 
          className="lc-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}
      <aside className={`lc-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        {/* Logo and Collapse Button */}
        <div className="lc-sidebar-header">
          <div className="lc-sidebar-logo">
            <img src={logoImg} alt="LazyCook" className="lc-logo-icon" />
          </div>
          <button 
            className="lc-sidebar-toggle" 
            onClick={() => setSidebarOpen((v) => !v)} 
            aria-label="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 8H12M8 4V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className="lc-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ←
          </button>
        </div>

        {/* Navigation Buttons */}
        <div className="lc-sidebar-nav">
          <button className="lc-nav-btn" onClick={newChat}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>New chat</span>
          </button>
          <button 
            className="lc-nav-btn" 
            onClick={() => {
              const searchInput = document.querySelector('.lc-search-input') as HTMLInputElement;
              searchInput?.focus();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Search chats</span>
          </button>
          <button className="lc-nav-btn" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M6 8L7 9L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Images</span>
            <span className="lc-badge" style={{ background: 'var(--muted)', color: 'var(--white)' }}>Coming Soon</span>
          </button>
          <button 
            className="lc-nav-btn"
            onClick={() => {
              setShowHelpModal(true);
              if (window.innerWidth <= 900) {
                setSidebarOpen(false);
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2.5" width="10" height="10" rx="0.5" fill="#FFEB3B" stroke="currentColor" strokeWidth="1"/>
              <path d="M11.5 12L12.5 13L11.5 13Z" fill="#FFC107"/>
              <path d="M12 12L13 13L12.5 13Z" fill="#FFC107"/>
              <line x1="4" y1="5.5" x2="10.5" y2="5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="4" y1="7.5" x2="10.5" y2="7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="4" y1="9.5" x2="10.5" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <circle cx="8" cy="4" r="1.2" fill="#FF4081" stroke="currentColor" strokeWidth="0.3"/>
            </svg>
            <span>Highlights & Notes</span>
          </button>
          <button 
            className="lc-nav-btn"
            onClick={() => {
              setShowUserMenu(!showUserMenu);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M3 14C3 11.5 5.2 9.5 8 9.5C10.8 9.5 13 11.5 13 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Profile</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="lc-sidebar-search">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="lc-search-input"
            aria-label="Search conversations"
          />
        </div>

        {/* Your Chats Section */}
        <div className="lc-chatlist">
          <div className="lc-chatlist-header">Your chats</div>
          {filteredChats.length === 0 ? (
            <div className="lc-chatlist-empty">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            filteredChats.map((c) => (
              <button
                key={c.id}
                className={`lc-chatitem ${c.id === activeChatId ? "is-active" : ""}`}
                onClick={() => {
                  setActiveChatId(c.id);
                  if (window.innerWidth <= 900) {
                    setSidebarOpen(false);
                  }
                }}
                title={c.title}
              >
                <div className="lc-chatitem-title">{c.title}</div>
              </button>
            ))
          )}
        </div>

        {/* User Profile */}
        <div className="lc-sidebar-bottom">
          <div className="lc-userline" ref={userMenuRef} onClick={() => setShowUserMenu(!showUserMenu)}>
            <div className="lc-avatar">
              {(firebaseUser?.email || email) ? ((firebaseUser?.email || email).split('@')[0].match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() : 'U'}
            </div>
            <div className="lc-usertext">
              <div className="lc-username">
                {(firebaseUser?.email || email) ? (firebaseUser?.email || email).split('@')[0].split(/[._-]/).map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(' ') : 'User'}
              </div>
              <div className="lc-userplan">{plan || 'GO'}</div>
            </div>
            {showUserMenu && (
              <div className="lc-user-menu">
                <div className="lc-user-menu-header">
                  <div className="lc-avatar-menu">
                    {(firebaseUser?.email || email) ? ((firebaseUser?.email || email).split('@')[0].match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() : 'U'}
                  </div>
                  <div className="lc-user-menu-info">
                    <div className="lc-user-menu-name">
                      {(firebaseUser?.email || email) ? (firebaseUser?.email || email).split('@')[0].split(/[._-]/).map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(' ') : 'User'}
                    </div>
                    <div className="lc-user-menu-username">
                      @{(firebaseUser?.email || email) ? (firebaseUser?.email || email).split('@')[0].toLowerCase() : 'user'}
                    </div>
                  </div>
                </div>
                <div className="lc-user-menu-divider"></div>
                <button 
                  className="lc-user-menu-item"
                  onClick={() => {
                    setShowPlanSelector(true);
                    setShowUserMenu(false);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 2L10 6L14 7L10 8L8 12L6 8L2 7L6 6L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Upgrade plan</span>
                </button>
                <button className="lc-user-menu-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 4V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>Personalization</span>
                </button>
                <button className="lc-user-menu-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 2V4M8 12V14M2 8H4M12 8H14M3.5 3.5L4.9 4.9M11.1 11.1L12.5 12.5M3.5 12.5L4.9 11.1M11.1 4.9L12.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>Settings</span>
                </button>
                <div className="lc-user-menu-divider"></div>
                <button 
                  className="lc-user-menu-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHighlightEnabled(!highlightEnabled);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 4L6 8L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: highlightEnabled ? 1 : 0.3 }}/>
                    <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill={highlightEnabled ? "currentColor" : "none"} style={{ opacity: highlightEnabled ? 0.1 : 0.3 }}/>
                  </svg>
                  <span>Enable Text Highlighting</span>
                  <div className={`lc-toggle-switch ${highlightEnabled ? 'is-active' : ''}`}>
                    <div className="lc-toggle-slider"></div>
                  </div>
                </button>
                <div className="lc-user-menu-divider"></div>
                <button 
                  className="lc-user-menu-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHelpModal(true);
                    setShowUserMenu(false);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 4V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>Help</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="lc-menu-chevron">
                    <path d="M4 3L8 6L4 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="lc-user-menu-item" onClick={(e) => { e.stopPropagation(); logout(); }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 4L2 8L6 12M2 8H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Logout Button - Direct access at bottom */}
          <button 
            className="lc-nav-btn"
            onClick={async () => {
              if (window.confirm('Are you sure you want to log out?')) {
                await logout();
                if (window.innerWidth <= 900) {
                  setSidebarOpen(false);
                }
              }
            }}
            style={{ 
              color: 'var(--red)', 
              width: '100%',
              marginTop: '8px',
              borderTop: '1px solid var(--border-light)',
              paddingTop: '12px',
              borderRadius: '0'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 4L2 8L6 12M2 8H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="lc-main">
        <header className="lc-topbar">
          <button className="lc-iconbtn mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            ☰
          </button>

          <div className="lc-topbar-left">
            <div className="lc-topbar-model" ref={modelDropdownRef} onClick={() => setShowModelDropdown(!showModelDropdown)}>
              <img src={logoTextImg} alt="LazyCook" className="lc-logo-text" />
              <span className="lc-model-version">{model === 'gemini' ? 'Gemini' : model === 'grok' ? 'Grok' : 'Mixed'}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="lc-dropdown-icon">
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {showModelDropdown && (
                <div className="lc-model-dropdown">
                  <button
                    className={`lc-model-option ${model === 'gemini' ? 'is-active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!plan || PLAN_MODELS[plan].includes('gemini')) {
                        setModel('gemini');
                        setShowModelDropdown(false);
                      }
                    }}
                    disabled={!!plan && !PLAN_MODELS[plan].includes('gemini')}
                  >
                    Gemini{plan && !PLAN_MODELS[plan].includes('gemini') ? ' (locked)' : ''}
                  </button>
                  <button
                    className={`lc-model-option ${model === 'grok' ? 'is-active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!plan || PLAN_MODELS[plan].includes('grok')) {
                        setModel('grok');
                        setShowModelDropdown(false);
                      }
                    }}
                    disabled={!!plan && !PLAN_MODELS[plan].includes('grok')}
                  >
                    Grok{plan && !PLAN_MODELS[plan].includes('grok') ? ' (locked)' : ''}
                  </button>
                  <button
                    className={`lc-model-option ${model === 'mixed' ? 'is-active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!plan || PLAN_MODELS[plan].includes('mixed')) {
                        setModel('mixed');
                        setShowModelDropdown(false);
                      }
                    }}
                    disabled={!!plan && !PLAN_MODELS[plan].includes('mixed')}
                  >
                    Mixed{plan && !PLAN_MODELS[plan].includes('mixed') ? ' (locked)' : ''}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lc-topbar-actions">
            {/* Desktop: Direct buttons (≥1024px) */}
            <button className="lc-topbar-action-btn lc-topbar-action-direct" aria-label="Share">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2V10M5 5L8 2L11 5M3 8H13M3 11H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Share</span>
            </button>
            <button className="lc-topbar-action-btn lc-topbar-action-direct" aria-label="Add people">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <span>Add people</span>
            </button>
            
            {/* Three-dot menu button - always visible */}
            <div className="lc-topbar-menu-wrapper" ref={topbarMenuRef}>
              <button 
                className="lc-topbar-menu-btn" 
                aria-label="More options"
                onClick={() => setShowTopbarMenu(!showTopbarMenu)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="4" r="1" fill="currentColor"/>
                  <circle cx="8" cy="8" r="1" fill="currentColor"/>
                  <circle cx="8" cy="12" r="1" fill="currentColor"/>
                </svg>
              </button>
              
              {/* Dropdown menu - visible on mobile, contains Share and Add people */}
              {showTopbarMenu && (
                <div className="lc-topbar-menu-dropdown">
                  <button 
                    className="lc-topbar-menu-item lc-topbar-action-menu" 
                    aria-label="Share"
                    onClick={() => {
                      setShowTopbarMenu(false);
                      // Add Share functionality here if needed
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 2V10M5 5L8 2L11 5M3 8H13M3 11H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Share</span>
                  </button>
                  <button 
                    className="lc-topbar-menu-item lc-topbar-action-menu" 
                    aria-label="Add people"
                    onClick={() => {
                      setShowTopbarMenu(false);
                      // Add Add people functionality here if needed
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span>Add people</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="lc-thread" ref={threadRef}>
          {(activeChat?.messages || []).length === 0 ? (
            <div className="lc-empty">
              <div className="lc-empty-title">Ask anything</div>
              <div className="lc-empty-subtitle">Gemini and Grok are ready. Your plan gates Grok.</div>
            </div>
          ) : (
            <div className="lc-messages">
              {(activeChat?.messages || []).map((m) => (
                <MessageItem 
                  key={m.id} 
                  message={m} 
                  onRegenerate={m.role === 'assistant' ? () => regenerateResponse(m.id) : undefined}
                  onUpdateHighlights={m.role === 'assistant' && activeChat ? (highlights: Highlight[]) => {
                    updateChatMessages(activeChat.id, (messages) => {
                      const next = [...messages];
                      const idx = next.findIndex((msg) => msg.id === m.id);
                      if (idx >= 0) {
                        next[idx] = { ...next[idx], highlights };
                      }
                      return next;
                    });
                  } : undefined}
                  onAskChatGPT={m.role === 'assistant' ? (text: string) => {
                    setPrompt(text);
                    // Auto-focus the textarea
                    setTimeout(() => {
                      textareaRef.current?.focus();
                      // Scroll to input
                      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                  } : undefined}
                />
              ))}
              {activeChat && activeChat.messages.length > 0 && (
                <div className="lc-chat-actions">
                  <button
                    className={`lc-chat-action-btn ${chatCopyStatus === 'copied' ? 'is-copied' : chatCopyStatus === 'error' ? 'is-error' : ''}`}
                    onClick={copyWholeChat}
                    aria-label="Copy whole chat"
                    title={chatCopyStatus === 'copied' ? 'Copied!' : chatCopyStatus === 'error' ? 'Copy failed' : 'Copy chat'}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="lc-chat-action-icon">
                      <path d="M5.5 4.5H3.5C2.67157 4.5 2 5.17157 2 6V12.5C2 13.3284 2.67157 14 3.5 14H10C10.8284 14 11.5 13.3284 11.5 12.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.5 2H12.5C13.3284 2 14 2.67157 14 3.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.5 2C5.5 1.72386 5.72386 1.5 6 1.5H12.5C12.7761 1.5 13 1.72386 13 2V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{chatCopyStatus === 'copied' ? 'Copied' : chatCopyStatus === 'error' ? 'Failed' : 'Copy Chat'}</span>
                  </button>
                  <button
                    className="lc-chat-action-btn"
                    onClick={downloadChatAsPDF}
                    aria-label="Download chat as PDF"
                    title="Download as PDF"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="lc-chat-action-icon">
                      <path d="M5.5 4.5H3.5C2.67157 4.5 2 5.17157 2 6V12.5C2 13.3284 2.67157 14 3.5 14H10C10.8284 14 11.5 13.3284 11.5 12.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.5 2H12.5C13.3284 2 14 2.67157 14 3.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.5 2C5.5 1.72386 5.72386 1.5 6 1.5H12.5C12.7761 1.5 13 1.72386 13 2V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Download PDF</span>
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
          {/* Scroll to bottom arrow - ChatGPT exact behavior */}
          <button
            className={`lc-scroll-to-bottom ${showScrollToBottom ? 'is-visible' : ''}`}
            onClick={scrollToBottom}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                scrollToBottom();
              }
            }}
            aria-label="Scroll to bottom"
            tabIndex={showScrollToBottom ? 0 : -1}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </section>

        <footer className="lc-composer">
          {error && <div className="lc-error lc-error-inline">{error}</div>}
          <div className="lc-composer-row">
            <div className="lc-textarea-wrapper">
              <textarea
                ref={textareaRef}
                className="lc-textarea"
                placeholder={plan ? "Ask anything" : "Select a plan to start using AI"}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (plan) {
                      onComposerKeyDown(e);
                    } else {
                      setShowPlanSelector(true);
                      setError("Please select a plan to use AI features");
                    }
                  } else {
                    onComposerKeyDown(e);
                  }
                }}
                rows={1}
                disabled={!plan}
                spellCheck={true}
              />
              <button 
                className="lc-composer-send" 
                onClick={() => {
                  if (!plan) {
                    setShowPlanSelector(true);
                    setError("Please select a plan to use AI features");
                  } else {
                    runAI();
                  }
                }}
                disabled={loading || !prompt.trim() || !plan}
                aria-label="Send message"
              >
                {loading ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="lc-loading-spinner">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="9.42" strokeDashoffset="9.42">
                      <animate attributeName="stroke-dasharray" values="0 25.13;12.57 12.57;0 25.13" dur="1.5s" repeatCount="indefinite"/>
                      <animate attributeName="stroke-dashoffset" values="0;-12.57;-25.13" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                ) : (
                  <FiArrowRight size={22} />
                )}
              </button>
            </div>
          </div>
          <div className="lc-composer-disclaimer">
            LazyCook can make mistakes. Check important info.
          </div>
        </footer>
      </main>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="lc-help-modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="lc-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lc-help-modal-header">
              <h2>How to Use Highlights & Notes</h2>
              <button 
                className="lc-help-modal-close"
                onClick={() => setShowHelpModal(false)}
                aria-label="Close help"
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="lc-help-modal-content">
              <div className="lc-help-section">
                <h3>📝 Highlighting Text</h3>
                <ol className="lc-help-steps">
                  <li>
                    <strong>Select text</strong> in any assistant message by clicking and dragging
                  </li>
                  <li>
                    A <strong>color toolbar</strong> will appear with 5 color options
                  </li>
                  <li>
                    <strong>Click a color</strong> to highlight the selected text
                  </li>
                  <li>
                    You can <strong>re-highlight</strong> the same text with a different color
                  </li>
                  <li>
                    <strong>Click a highlight</strong> to edit or remove it
                  </li>
                </ol>
              </div>

              <div className="lc-help-section">
                <h3>📌 Adding Notes</h3>
                <ol className="lc-help-steps">
                  <li>
                    <strong>Click on highlighted text</strong> to open the toolbar
                  </li>
                  <li>
                    Click the <strong>📌 note icon</strong> (sticky note with thumbtack)
                  </li>
                  <li>
                    A <strong>note editor</strong> will appear
                  </li>
                  <li>
                    <strong>Type your note</strong> and click "Save"
                  </li>
                  <li>
                    <strong>Hover over highlighted text</strong> with notes to see them in a tooltip
                  </li>
                  <li>
                    Press <strong>Ctrl+Enter</strong> (or Cmd+Enter on Mac) to save quickly
                  </li>
                </ol>
              </div>

              <div className="lc-help-section">
                <h3>🎨 Color Options</h3>
                <div className="lc-help-colors">
                  <div className="lc-help-color-item">
                    <div className="lc-help-color-demo lc-highlight-yellow"></div>
                    <span>Yellow</span>
                  </div>
                  <div className="lc-help-color-item">
                    <div className="lc-help-color-demo lc-highlight-blue"></div>
                    <span>Blue</span>
                  </div>
                  <div className="lc-help-color-item">
                    <div className="lc-help-color-demo lc-highlight-green"></div>
                    <span>Green</span>
                  </div>
                  <div className="lc-help-color-item">
                    <div className="lc-help-color-demo lc-highlight-pink"></div>
                    <span>Pink</span>
                  </div>
                  <div className="lc-help-color-item">
                    <div className="lc-help-color-demo lc-highlight-purple"></div>
                    <span>Purple</span>
                  </div>
                </div>
              </div>

              <div className="lc-help-section">
                <h3>💡 Tips</h3>
                <ul className="lc-help-tips">
                  <li>Highlights are saved per message and persist across sessions</li>
                  <li>You can have multiple highlights with different colors in the same message</li>
                  <li>Notes are optional - you can highlight without adding a note</li>
                  <li>Click the X button in the toolbar to remove a highlight</li>
                  <li>Highlights work only in assistant messages, not in code blocks</li>
                </ul>
              </div>
            </div>
            <div className="lc-help-modal-footer">
              <button 
                className="lc-help-modal-button"
                onClick={() => setShowHelpModal(false)}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      {showPlanSelector && plan && (
        <PlanSelector
          currentPlan={plan}
          onSelectPlan={handlePlanSelect}
          onClose={() => {
            if (!isNewUser) {
              setShowPlanSelector(false);
            }
            // For new users, don't allow closing without selecting a plan
          }}
          isNewUser={isNewUser}
        />
      )}
    </>
  );
}
