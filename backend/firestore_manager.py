"""
firestore_manager.py

Firestore-based data manager to replace TextFileManager.
Stores conversations, documents, and tasks in Firestore with per-user isolation.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from functools import wraps
import traceback
from google.cloud.firestore import SERVER_TIMESTAMP

from firebase_config import get_db

logger = logging.getLogger(__name__)


# Decorator for error logging (must be defined before use)
def log_errors(func):
    """Decorator to log errors in FirestoreManager methods."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {e}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            raise
    
    return wrapper


# Shared cache across all FirestoreManager instances (so all models share context)
_shared_context_cache = {}
_shared_context_cache_time = {}

class FirestoreManager:
    """
    Firestore-based data manager that replaces TextFileManager.
    Provides the same interface but uses Firestore instead of JSON files.
    """
    
    def __init__(self, conversation_limit: int = 70, document_limit: int = 2):
        self.conversation_limit = conversation_limit
        self.document_limit = document_limit
        # Use shared cache so all models/plans share context
        self._cached_context = _shared_context_cache
        self._context_cache_time = _shared_context_cache_time
        self._cache_ttl = timedelta(minutes=5)  # Cache expires after 5 min
        self.max_documents_per_user = 100
        self.max_storage_per_user = 100 * 1024 * 1024  # 100MB
    
    @property
    def db(self):
        """Get Firestore client with lazy initialization."""
        db = get_db()
        if db is None:
            raise RuntimeError(
                "Firestore client not initialized. Please configure Firebase credentials. "
                "Set FIREBASE_SERVICE_ACCOUNT_PATH in .env or use Application Default Credentials."
            )
        return db

    def _get_effective_limit(self, provided_limit: Optional[int]) -> int:
        """
        Resolve the effective limit to use.
        Priority: provided_limit > instance limit > default (70)
        """
        if provided_limit is not None and provided_limit >= 0:
            return provided_limit
        return getattr(self, 'conversation_limit', 70)

    def _datetime_to_firestore(self, dt):
        """Convert datetime to Firestore-compatible format.
        Firestore Admin SDK automatically converts Python datetime to Firestore Timestamp.
        """
        if dt is None:
            return SERVER_TIMESTAMP
        if isinstance(dt, datetime):
            # Firestore Admin SDK accepts Python datetime directly
            return dt
        if isinstance(dt, str):
            return datetime.fromisoformat(dt)
        # If it's already a Firestore Timestamp, return as is
        if hasattr(dt, 'seconds') and hasattr(dt, 'nanos'):
            return dt
        return SERVER_TIMESTAMP

    def _firestore_to_datetime(self, value):
        """Convert Firestore timestamp to datetime.
        
        Handles multiple Firestore timestamp formats:
        - DatetimeWithNanoseconds (Firestore Admin SDK - datetime-compatible)
        - Timestamp objects (with to_datetime method)
        - Python datetime objects
        - ISO format strings
        """
        if value is None:
            return None
        
        # Check if it's datetime-compatible by checking for datetime attributes
        # This catches both datetime and DatetimeWithNanoseconds
        if hasattr(value, 'year') and hasattr(value, 'month') and hasattr(value, 'day'):
            # It's datetime-like (including DatetimeWithNanoseconds), return as is
            return value
        
        # If it's already a datetime (isinstance check)
        if isinstance(value, datetime):
            return value
        
        # Handle Firestore Timestamp objects (with to_datetime method)
        if hasattr(value, 'to_datetime') and callable(value.to_datetime):
            try:
                return value.to_datetime()
            except Exception as e:
                logger.debug(f"to_datetime() failed: {e}")
        
        # Handle Timestamp-like objects with seconds and nanos (protobuf Timestamp)
        if hasattr(value, 'seconds') and hasattr(value, 'nanos'):
            try:
                return datetime.fromtimestamp(value.seconds + value.nanos / 1e9)
            except Exception as e:
                logger.debug(f"Timestamp conversion failed: {e}")
        
        # If it's a string, parse it
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value)
            except Exception:
                pass
        
        # Last resort: try to convert using timestamp() method if available
        if hasattr(value, 'timestamp') and callable(value.timestamp):
            try:
                ts = value.timestamp()
                if isinstance(ts, (int, float)):
                    return datetime.fromtimestamp(ts)
            except Exception:
                pass
        
        # If nothing works, log and return as is (might be a datetime-compatible object)
        logger.warning(f"Could not convert timestamp value: {type(value)} - {value}. Returning as is.")
        return value

    def _to_dict(self, obj):
        """Convert object to dictionary, handling dataclasses and datetime."""
        if hasattr(obj, 'to_dict'):
            return obj.to_dict()
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {k: self._to_dict(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._to_dict(item) for item in obj]
        return obj

    # ========== Conversation Methods ==========

    @log_errors
    def save_conversation(self, conversation, chat_id: Optional[str] = None):
        """Save a conversation to Firestore.
        
        Args:
            conversation: Conversation object to save
            chat_id: The chat ID to associate with this conversation
                    If None, assume newChat session
        """
        user_id = conversation.user_id
        
        # Invalidate cache for this user and chat
        self.clear_cached_context(user_id, chat_id)
        
        # Convert conversation to dict
        conv_data = self._to_dict(conversation)
        
        # Convert timestamp to Firestore Timestamp (required for queries)
        if 'timestamp' in conv_data:
            conv_data['timestamp'] = self._datetime_to_firestore(conv_data['timestamp'])
        else:
            conv_data['timestamp'] = SERVER_TIMESTAMP
        
        # Handle multi_agent_session timestamp
        if 'multi_agent_session' in conv_data and conv_data['multi_agent_session']:
            if isinstance(conv_data['multi_agent_session'], dict) and 'timestamp' in conv_data['multi_agent_session']:
                conv_data['multi_agent_session']['timestamp'] = self._datetime_to_firestore(
                    conv_data['multi_agent_session']['timestamp']
                )
        
        # Store in per-chat chatHistory (organized by chat_id)
        if chat_id:
            # Existing chat - store in chat-specific history
            chat_history_ref = self.db.collection('users').document(user_id)\
                .collection('chatHistory').document(chat_id)\
                .collection('conversations').document(conversation.id)
        else:
            # New chat - store in newChat history
            chat_history_ref = self.db.collection('users').document(user_id)\
                .collection('chatHistory').document('newChat')\
                .collection('conversations').document(conversation.id)
        
        chat_history_ref.set(conv_data)
        
        # Add chat_id to context for filtering
        if chat_id:
            logger.info(f"Conversation saved to chatHistory/chat_id={chat_id}: {conversation.id}")
        else:
            logger.info(f"Conversation saved to newChat history: {conversation.id}")

    @log_errors
    def get_session_conversations(self, user_id: str, limit: int = None, chat_id: Optional[str] = None) -> List:
        """Get conversations from current newConversation (unsaved chat).
        
        Args:
            user_id: User identifier
            limit: Maximum number of conversations to return
            chat_id: Ignored - newConversation is always the current session
        """
        limit = self._get_effective_limit(limit)
        
        # Import Conversation class dynamically (to avoid circular imports)
        from lazycook6 import Conversation
        
        try:
            # Use newChat collection (users/{user_id}/chatHistory/newChat/conversations)
            session_ref = self.db.collection('users').document(user_id)\
                .collection('chatHistory').document('newChat')\
                .collection('conversations')
            
            # Try ordered query first, fallback to unordered if index missing
            try:
                query = session_ref.order_by('timestamp', direction='DESCENDING').limit(limit)
                docs = query.stream()
            except Exception as index_error:
                logger.warning(f"Ordered query failed (may need index): {index_error}. Trying unordered query...")
                # Fallback: get all and sort in memory
                docs = session_ref.limit(limit * 2).stream()  # Get more to account for no ordering
            
            conversations = []
            for doc in docs:
                data = doc.to_dict()
                if data:
                    # Convert all timestamps to ISO strings (Conversation.from_dict expects strings)
                    if 'timestamp' in data:
                        dt = self._firestore_to_datetime(data['timestamp'])
                        data['timestamp'] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                    
                    # Convert multi_agent_session timestamps (including nested iterations)
                    if data.get('multi_agent_session') and isinstance(data['multi_agent_session'], dict):
                        mas = data['multi_agent_session']
                        if 'timestamp' in mas:
                            dt = self._firestore_to_datetime(mas['timestamp'])
                            mas['timestamp'] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                        # Also convert timestamps in iterations
                        if 'iterations' in mas and isinstance(mas['iterations'], list):
                            for iteration in mas['iterations']:
                                if isinstance(iteration, dict) and 'timestamp' in iteration:
                                    dt = self._firestore_to_datetime(iteration['timestamp'])
                                    iteration['timestamp'] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                    
                    conversations.append(Conversation.from_dict(data))
            
            # If we used unordered query, sort manually
            if conversations and not all(hasattr(c, 'timestamp') and c.timestamp for c in conversations):
                conversations.sort(key=lambda x: x.timestamp if hasattr(x, 'timestamp') and x.timestamp else datetime.min, reverse=True)
                conversations = conversations[:limit]
            
            # Changed log level to debug or clarifying text
            logger.info(f"Fetched {len(conversations)} UNSAVED session conversations from newConversation for user {user_id}")
            return conversations
        except Exception as e:
            logger.error(f"Error fetching session conversations from newConversation for user {user_id}: {e}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return []

    @log_errors
    def get_recent_conversations(self, user_id: str, limit: int = None, chat_id: Optional[str] = None) -> List:
        """Get recent conversations from chatHistory (AI context storage).
        
        Args:
            user_id: User identifier
            limit: Maximum number of conversations to return
            chat_id: Optional - if None, get conversations from all chats (for cross-plan context sharing)
        """
        limit = self._get_effective_limit(limit)
        
        # Import Conversation class dynamically
        from lazycook6 import Conversation
        
        try:
            all_conversations = []
            
            # 1. Get from newChat
            new_chat_convs = self.get_session_conversations(user_id, limit)
            all_conversations.extend(new_chat_convs)
            
            # 2. Get from saved chats
            # We need to find all chats first. 
            chats_ref = self.db.collection('users').document(user_id).collection('chats')
            chat_docs = chats_ref.stream()
            chat_ids = [doc.id for doc in chat_docs]
            
            # Limit fetch per chat to avoid fetching too much
            per_chat_limit = 5 
            
            for cid in chat_ids:
                try:
                    conv_ref = self.db.collection('users').document(user_id)\
                        .collection('chatHistory').document(cid)\
                        .collection('conversations')
                    
                    # Fetch recent from this chat
                    docs = conv_ref.order_by('timestamp', direction='DESCENDING').limit(per_chat_limit).stream()
                    
                    for doc in docs:
                        data = doc.to_dict()
                        if data:
                            if 'timestamp' in data:
                                dt = self._firestore_to_datetime(data['timestamp'])
                                data['timestamp'] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                            
                            if data.get('multi_agent_session') and isinstance(data['multi_agent_session'], dict):
                                mas = data['multi_agent_session']
                                if 'timestamp' in mas:
                                    dt = self._firestore_to_datetime(mas['timestamp'])
                                    mas['timestamp'] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                                if 'iterations' in mas and isinstance(mas['iterations'], list):
                                    for iteration in mas['iterations']:
                                        if isinstance(iteration, dict) and 'timestamp' in iteration:
                                            dt = self._firestore_to_datetime(iteration['timestamp'])
                                            iteration['timestamp'] = dt.isoformat() if isinstance(dt, datetime) else str(dt)

                            all_conversations.append(Conversation.from_dict(data))
                except Exception as e:
                    logger.warning(f"Error fetching from chat {cid}: {e}")
                    continue
            
            # Sort all by timestamp descending
            all_conversations.sort(key=lambda x: x.timestamp if hasattr(x, 'timestamp') and x.timestamp else datetime.min, reverse=True)
            
            # Take top N
            conversations = all_conversations[:limit]
            
            logger.info(f"Fetched {len(conversations)} recent conversations from chatHistory (aggregated) for user {user_id}")
            return conversations
        except Exception as e:
            logger.error(f"Error fetching recent conversations from chatHistory for user {user_id}: {e}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return []

    def get_conversation_context(self, user_id: str, limit: int = None, chat_id: Optional[str] = None, current_query: str = None, current_chat_messages: List = None) -> str:
        """Get formatted conversation context for AI with smart 30% context logic.
        
        Context Logic:
            - NEW CHAT: Empty context (Start fresh)
            - EXISTING CHAT: 100% current chat history only (Strict Isolation)
            - NO cross-chat context sharing
        """
        limit = self._get_effective_limit(limit)
        
        if limit == 0:
            return "No previous conversation history available."

        # Determine if this is a new chat or existing chat
        conversations = []
        real_is_new_chat = False
        
        # If chat_id is provided, check if it has history in Firestore (regardless of current_chat_messages arg)
        if chat_id:
             # EXISTING CHAT STRATEGY: Fetch from specific chat ID
             # This doubles as a check for existence. If it returns empty, it's a new chat.
             conversations = self._get_chat_specific_conversations(user_id, chat_id, limit)
             
             if not conversations:
                  real_is_new_chat = True
                  logger.info(f"📊 NEW CHAT (ID: {chat_id}) - Starting fresh (Strict Isolation)")
             else:
                  real_is_new_chat = False
                  logger.info(f"📊 EXISTING CHAT (ID: {chat_id}) - Fetched {len(conversations)} msgs (Strict Isolation)")
                  
        else:
             # NO CHAT ID -> Unsaved/Session chat
             # Check provided messages OR fetch from session file
             if current_chat_messages and len(current_chat_messages) > 0:
                  conversations = current_chat_messages
                  real_is_new_chat = False
                  logger.info(f"📊 EXISTING SESSION (Mem) - using {len(conversations)} provided msgs")
             else:
                  conversations = self.get_session_conversations(user_id, limit)
                  if conversations:
                       real_is_new_chat = False
                       logger.info(f"📊 EXISTING SESSION (DB) - Fetched {len(conversations)} msgs")
                  else:
                       real_is_new_chat = True
                       logger.info(f"📊 NEW SESSION - Starting fresh")

        # Update logs with REAL status
        logger.info(f"🔄 Context resolved: user={user_id}, chat={chat_id}, real_is_new={real_is_new_chat}, msgs={len(conversations)}")

        # Cache key logic uses real status
        cache_key = f"{user_id}_{chat_id}_{limit}_{real_is_new_chat}"
        now = datetime.now()

        if cache_key in self._cached_context:
            cache_time = self._context_cache_time.get(cache_key)
            if cache_time and (now - cache_time) < self._cache_ttl:
                logger.info(f"✅ Using cached context")
                return self._cached_context[cache_key]

        # Use the conversations we just fetched/determined
        # FILTERING LOGIC
        # 1. Extract keywords from current_query (if available)
        query_keywords = set()
        if current_query:
            # Simple keyword extraction (lowercase, split)
            stops = {'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'of', 'for', 'it', 'this', 'that', 'i', 'my', 'me'} 
            query_keywords = {w.lower() for w in current_query.split() if w.lower() not in stops and len(w) > 3}

        if real_is_new_chat:
            if query_keywords:
                # Only check global history if we have keywords to match (Relevance rule)
                global_conversations = self.get_recent_conversations(user_id, limit)
                relevant_convs = []
                for conv in global_conversations:
                    conv_text = (conv.user_message + " " + conv.ai_response + " " + " ".join(conv.topics)).lower()
                    conv_words = set(conv_text.split())
                    if len(query_keywords & conv_words) > 0:
                        relevant_convs.append(conv)
                conversations = relevant_convs[:limit]
                if conversations:
                    logger.info(f"📊 NEW CHAT - Found {len(conversations)} RELEVANT global items (Context Injected)")
                else:
                    conversation = [] # Fallback to empty -> Triggers Greeting
                    logger.info(f"📊 NEW CHAT - No relevant global items found -> Empty Context (Trigger Greeting)")
            else:
                conversations = []
                logger.info(f"📊 NEW CHAT - No query/keywords -> Empty Context (Trigger Greeting)")
        else:
            # EXISTING CHAT: Mix of current chat (PRIORITY) + Relevant Global history
            conversations.sort(key=lambda x: x.timestamp, reverse=True)
            
            if query_keywords:
                current_ids = {c.id for c in conversations}
                global_conversations = self.get_recent_conversations(user_id, limit)
                global_history = [c for c in global_conversations if c.id not in current_ids]
                
                relevant_history = []
                for conv in global_history:
                    conv_text = (conv.user_message + " " + conv.ai_response + " " + " ".join(conv.topics)).lower()
                    conv_words = set(conv_text.split())
                    if len(query_keywords & conv_words) > 0:
                        relevant_history.append(conv)
                        
                conversations.extend(relevant_history)
                logger.info(f"📊 EXISTING CHAT - Added {len(relevant_history)} RELEVANT background items")
            
            conversations = conversations[:limit]

        if not conversations:
            logger.info(f"⚠️ No conversations found")
            return "No previous conversation history available."

        # Build context string
        context_parts = [f"=== CONTEXT (NEW: {real_is_new_chat}) ==="]
        MAX_CONTEXT_CHARS = 8000
        current_length = len("\n".join(context_parts))
        
        for i, conv in enumerate(conversations):
            user_msg = conv.user_message[:500] + "..." if len(conv.user_message) > 500 else conv.user_message
            ai_msg = conv.ai_response[:1000] + "..." if len(conv.ai_response) > 1000 else conv.ai_response
            chat_info = f" [Chat: {conv.chat_id}]" if hasattr(conv, 'chat_id') and conv.chat_id else ""
            
            conv_text = (
                f"\n--- Conv {i + 1}{chat_info} ---\n"
                f"USER: {user_msg}\n"
                f"AI: {ai_msg}"
            )
            
            if current_length + len(conv_text) > MAX_CONTEXT_CHARS:
                logger.info(f"Context limit reached")
                break
            
            context_parts.append(conv_text)
            current_length += len(conv_text)

        context_parts.append("\n=== END CONTEXT ===")
        context = "\n".join(context_parts)

        # Cache and return
        self._cached_context[cache_key] = context
        self._context_cache_time[cache_key] = now

        logger.info(f"✅ Context: {len(conversations)} convs, {len(context)} chars")
        return context

    def _get_chat_specific_conversations(self, user_id: str, chat_id: str, limit: int) -> List:
        """Get conversations from specific chat only (no cross-chat)."""
        from lazycook6 import Conversation
        
        try:
            # Access per-chat conversation history
            conv_ref = self.db.collection('users').document(user_id)\
                .collection('chatHistory').document(chat_id)\
                .collection('conversations')
            
            query = conv_ref.order_by('timestamp', direction='DESCENDING').limit(limit)
            docs = query.stream()
            
            conversations = []
            for doc in docs:
                data = doc.to_dict()
                if data:
                    if 'timestamp' in data:
                        dt = self._firestore_to_datetime(data['timestamp'])
                        data['timestamp'] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                    if data.get('multi_agent_session') and isinstance(data['multi_agent_session'], dict):
                        if 'timestamp' in data['multi_agent_session']:
                            dt = self._firestore_to_datetime(data['multi_agent_session']['timestamp'])
                            data['multi_agent_session']['timestamp'] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                    conversations.append(Conversation.from_dict(data))
            
            logger.info(f"Fetched {len(conversations)} conversations from chat {chat_id}")
            return conversations
        except Exception as e:
            logger.warning(f"Error fetching chat-specific conversations: {e}")
            return []

    def _get_related_conversations(self, user_id: str, limit: int, current_prompt: Optional[List] = None) -> List:
        """Get relevant conversations from other chats based on topic similarity.
        
        Filters to show only RELATED chats, skipping completely unrelated ones.
        """
        from lazycook6 import Conversation
        
        try:
            # Get all chat IDs for this user
            chats_ref = self.db.collection('users').document(user_id).collection('chats')
            chat_docs = chats_ref.stream()
            chat_ids = [doc.id for doc in chat_docs]
            
            if not chat_ids:
                logger.info("No previous chats found")
                return []
            
            all_conversations = []
            
            # Fetch from each chat's history
            for chat_id in chat_ids:
                try:
                    conv_ref = self.db.collection('users').document(user_id)\
                        .collection('chatHistory').document(chat_id)\
                        .collection('conversations')
                    
                    docs = conv_ref.order_by('timestamp', direction='DESCENDING').limit(5).stream()
                    
                    for doc in docs:
                        data = doc.to_dict()
                        if data:
                            if 'timestamp' in data:
                                dt = self._firestore_to_datetime(data['timestamp'])
                                data['timestamp'] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                            if data.get('multi_agent_session') and isinstance(data['multi_agent_session'], dict):
                                if 'timestamp' in data['multi_agent_session']:
                                    dt = self._firestore_to_datetime(data['multi_agent_session']['timestamp'])
                                    data['multi_agent_session']['timestamp'] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                            all_conversations.append(Conversation.from_dict(data))
                except Exception as e:
                    logger.warning(f"Error fetching from chat {chat_id}: {e}")
                    continue
            
            # Filter for relevance (if current prompt provided)
            if current_prompt and len(current_prompt) > 0:
                current_text = current_prompt[0].get('content', '') if isinstance(current_prompt[0], dict) else str(current_prompt[0])
                filtered = self._filter_relevant_conversations(all_conversations, current_text, limit)
                logger.info(f"Filtered to {len(filtered)} relevant conversations from {len(all_conversations)} total")
                return filtered
            
            # Return top conversations by timestamp
            all_conversations.sort(key=lambda x: x.timestamp, reverse=True)
            return all_conversations[:limit]
            
        except Exception as e:
            logger.error(f"Error getting related conversations: {e}")
            return []

    def _filter_relevant_conversations(self, conversations: List, current_text: str, limit: int) -> List:
        """Filter conversations by relevance to current prompt using simple keyword matching.
        
        Extracts key topics and returns conversations with matching topics.
        """
        if not current_text or not conversations:
            return conversations[:limit]
        
        # Extract topics from current text
        current_topics = set()
        words = current_text.lower().split()
        # Get unique meaningful words (>4 chars, not stopwords)
        stopwords = {'the', 'and', 'or', 'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'a', 'an', 'to', 'of', 'in', 'for', 'with', 'from', 'as', 'at', 'by', 'on', 'how', 'what', 'when', 'where', 'why', 'which', 'who'}
        current_topics = {w for w in words if len(w) > 3 and w not in stopwords}
        
        if not current_topics:
            # If no meaningful keywords, return EMPTY to avoid polluting context with unrelated chats
            # This fixes the issue where "elaborate this" pulls in random recent chats
            logger.info("No meaningful topics in prompt - skipping related content fetch")
            return []
        
        logger.info(f"Current topics: {current_topics}")
        
        # Score conversations by topic overlap
        scored_convs = []
        for conv in conversations:
            # Extract topics from previous response
            prev_text = (conv.user_message + " " + conv.ai_response).lower()
            prev_words = prev_text.split()
            prev_topics = {w for w in prev_words if len(w) > 3 and w not in stopwords}
            
            # Calculate overlap score
            overlap = len(current_topics & prev_topics)
            if overlap > 0:  # Only include if there's some relevance
                scored_convs.append((conv, overlap))
        
        if not scored_convs:
            # No relevant conversations found - return empty (don't pollute context)
            logger.info("No related conversations found - returning empty")
            return []
        
        # Sort by relevance score (descending) then by timestamp
        scored_convs.sort(key=lambda x: (-x[1], x[0].timestamp), reverse=True)
        return [conv for conv, _ in scored_convs[:limit]]
        
        # Debug: Log chat_ids to verify we're getting conversations from all chats
        if session_conversations:
            chat_ids_found = set(conv.chat_id for conv in session_conversations if hasattr(conv, 'chat_id') and conv.chat_id)
            logger.info(f"📋 Session conversations from chats: {list(chat_ids_found)[:5]}... (showing first 5)")
        if historical_conversations:
            chat_ids_found = set(conv.chat_id for conv in historical_conversations if hasattr(conv, 'chat_id') and conv.chat_id)
            logger.info(f"📋 Historical conversations from chats: {list(chat_ids_found)[:5]}... (showing first 5)")

        # Remove duplicates
        historical_ids = {conv.id for conv in historical_conversations}
        unique_session_convs = [conv for conv in session_conversations
                                if conv.id not in historical_ids]

        # Combine and sort
        all_conversations = unique_session_convs + historical_conversations
        all_conversations.sort(key=lambda x: x.timestamp, reverse=True)
        conversations = all_conversations[:limit]  # Apply final limit
        
        logger.info(f"✅ Final context will include {len(conversations)} conversations from ALL models/plans")

        if not conversations:
            logger.warning(f"No conversations found for user {user_id}. Returning empty context message.")
            return "No previous conversation history available."

        logger.info(f"🔨 Building context from {len(conversations)} conversations for user {user_id}")
        logger.info(f"   ✅ These conversations are from ALL models/plans (GO, PRO, ULTRA) - context is SHARED")
        context_parts = ["=== CONVERSATION CONTEXT (All Plans/Models - Shared) ==="]
        
        # Limit context size to avoid token limits (max ~8000 characters to stay under 12000 tokens)
        MAX_CONTEXT_CHARS = 8000
        current_length = len("\n".join(context_parts))
        
        for i, conv in enumerate(conversations):
            source = "Current Session" if conv in unique_session_convs else "Previous Session"
            
            # Show which chat this conversation belongs to (if available) - helps identify context source
            chat_info = f" [Chat: {conv.chat_id[:20]}...]" if hasattr(conv, 'chat_id') and conv.chat_id else ""
            
            # Truncate long messages to keep context manageable
            user_msg = conv.user_message[:500] + "..." if len(conv.user_message) > 500 else conv.user_message
            ai_msg = conv.ai_response[:1000] + "..." if len(conv.ai_response) > 1000 else conv.ai_response
            
            conv_text = (
                f"\n--- Conversation {i + 1} ({conv.timestamp.strftime('%Y-%m-%d %H:%M')}) [{source}]{chat_info} ---\n"
                f"USER: {user_msg}\n"
                f"ASSISTANT: {ai_msg}"
            )
            
            # Check if adding this conversation would exceed the limit
            if current_length + len(conv_text) > MAX_CONTEXT_CHARS:
                logger.warning(f"Context size limit reached at conversation {i+1}/{len(conversations)}. Truncating.")
                context_parts.append(f"\n... ({len(conversations) - i} more conversations truncated to stay within token limits)")
                break
            
            context_parts.append(conv_text)
            current_length += len(conv_text)
            
            # Add metadata (but keep it short)
            if conv.multi_agent_session:
                session = conv.multi_agent_session
                metadata = f"[Q:{session.quality_score:.1f} | I:{session.total_iterations}]"
                if current_length + len(metadata) < MAX_CONTEXT_CHARS:
                    context_parts.append(metadata)
                    current_length += len(metadata)

            if conv.topics and len(conv.topics) > 0:
                topics_str = f"[Topics: {', '.join(conv.topics[:3])}]"  # Limit to 3 topics
                if current_length + len(topics_str) < MAX_CONTEXT_CHARS:
                    context_parts.append(topics_str)
                    current_length += len(topics_str)

        # Add document context
        current_doc_id = getattr(self, '_current_document_id', None)
        current_doc_ids = getattr(self, '_current_document_ids', None)
        logger.info(f"📄 [FIRESTORE] get_conversation_context: _current_document_id = {current_doc_id}, _current_document_ids = {current_doc_ids}")
        docs_context = self.get_documents_context(user_id, self.document_limit, full_content=True, document_id=current_doc_id, document_ids=current_doc_ids)  # Use full content and prioritize specific documents
        if docs_context:
            context_parts.append(f"\n--- 📄 RELEVANT DOCUMENTS ---")
            context_parts.append(docs_context)
            logger.info(f"📄 [FIRESTORE] Added document context to conversation context ({len(docs_context)} chars)")
        else:
            logger.info(f"📄 [FIRESTORE] No document context to add")

        context_parts.append("\n=== END OF CONTEXT ===")
        context = "\n".join(context_parts)

        # Log context summary
        context_length = len(context)
        context_words = len(context.split())
        logger.info(f"Built context for user {user_id}: {context_words} words, {context_length} chars, {len(conversations)} conversations")

        # Cache the result (using user_id only, so context is shared across all chats/plans)
        self._cached_context[cache_key] = context
        self._context_cache_time[cache_key] = now

        logger.info(f"✅ Context built for user {user_id}: {len(context.split())} words, {len(context)} chars, {len(conversations)} conversations (shared across all plans/models)")
        return context

    @log_errors
    def save_conversations_batch(self, conversations: List):
        """Save multiple conversations in batch."""
        for conversation in conversations:
            self.save_conversation(conversation)

    @log_errors
    def clear_cached_context(self, user_id: str, chat_id: Optional[str] = None):
        """Clear cached context for a user or specific chat.
        
        Args:
            user_id: User to clear cache for
            chat_id: Optional - if provided, only clear cache for this chat
        """
        if chat_id:
            # Clear cache only for specific chat
            prefix = f"{user_id}_{chat_id}_"
        else:
            # Clear all caches for user
            prefix = f"{user_id}_"
        
        keys_to_remove = [k for k in self._cached_context.keys() if k.startswith(prefix)]
        for key in keys_to_remove:
            self._cached_context.pop(key, None)
            self._context_cache_time.pop(key, None)
        
        if chat_id:
            logger.info(f"Cleared {len(keys_to_remove)} cached contexts for {user_id}/{chat_id}")
        else:
            logger.info(f"Cleared {len(keys_to_remove)} cached contexts for {user_id}")

    @log_errors
    def get_new_conversation_data(self, user_id: str) -> Dict[str, Any]:
        """Get all data from newConversation for a user."""
        try:
            # Path: users/{id}/chatHistory/newChat/conversations
            new_convo_ref = self.db.collection('users').document(user_id)\
                .collection('chatHistory').document('newChat')\
                .collection('conversations')
            docs = new_convo_ref.stream()
            
            new_convo_data = {}
            for doc in docs:
                data = doc.to_dict()
                if data:
                    new_convo_data[doc.id] = data
            
            logger.info(f"Fetched newConversation data for user {user_id}: {len(new_convo_data)} items")
            return new_convo_data
        except Exception as e:
            logger.error(f"Error fetching newConversation data for user {user_id}: {e}")
            return {}

    @log_errors
    def clear_new_conversation(self, user_id: str):
        """Clear all conversations from newConversation collection for a user."""
        try:
            # Path: users/{id}/chatHistory/newChat/conversations
            new_convo_ref = self.db.collection('users').document(user_id)\
                .collection('chatHistory').document('newChat')\
                .collection('conversations')
            docs = new_convo_ref.stream()
            
            for doc in docs:
                doc.reference.delete()
            
            logger.info(f"Cleared newConversation for user {user_id}")
        except Exception as e:
            logger.error(f"Error clearing newConversation for user {user_id}: {e}")

    @log_errors
    def promote_new_conversation(self, user_id: str, new_chat_id: str) -> bool:
        """Promote newConversation to a numbered chat.
        
        Args:
            user_id: User identifier
            new_chat_id: The new chat ID (e.g., 'chat_11')
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get all data from newChat (chatHistory/newChat/conversations)
            new_convo_data = self.get_new_conversation_data(user_id)
            
            if not new_convo_data:
                logger.warning(f"No data in newChat to promote for user {user_id}")
                return False
            
            # Create/update the new chat document with messages from newConversation
            messages = []
            
            for conv_id, conv_data in new_convo_data.items():
                # Extract message data if it's a message
                if 'role' in conv_data and 'content' in conv_data:
                    # This is a message doc
                    messages.append({
                        'id': conv_id,
                        'role': conv_data.get('role'),
                        'content': conv_data.get('content'),
                        'timestamp': conv_data.get('timestamp')
                    })
                # Handle Conversation object format as well
                elif 'user_message' in conv_data and 'ai_response' in conv_data:
                    messages.append({
                        'id': f"{conv_id}_user",
                        'role': 'user',
                        'content': conv_data.get('user_message'),
                        'timestamp': conv_data.get('timestamp')
                    })
                    messages.append({
                        'id': f"{conv_id}_ai",
                        'role': 'assistant',
                        'content': conv_data.get('ai_response'),
                        'timestamp': conv_data.get('timestamp')
                    })
            
            # Create the new chat document
            chat_doc = {
                'id': new_chat_id,
                'title': 'New Chat',  # Can be updated by frontend
                'createdAt': SERVER_TIMESTAMP,
                'updatedAt': SERVER_TIMESTAMP,
                'messages': messages
            }
            
            # Save to chats collection (Metadata)
            chat_ref = self.db.collection('users').document(user_id).collection('chats').document(new_chat_id)
            chat_ref.set(chat_doc)
            
            # Move conversations to chatHistory/{new_chat_id}/conversations
            for conv_id, conv_data in new_convo_data.items():
                # Update chat_id field
                conv_data['chat_id'] = new_chat_id
                
                # Save to: chatHistory/{new_chat_id}/conversations/{conv_id}
                target_ref = self.db.collection('users').document(user_id)\
                    .collection('chatHistory').document(new_chat_id)\
                    .collection('conversations').document(conv_id)
                target_ref.set(conv_data)
            
            # Clear newChat (chatHistory/newChat)
            self.clear_new_conversation(user_id)
            
            logger.info(f"✅ Promoted newChat to chat {new_chat_id} for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error promoting newConversation for user {user_id}: {e}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return False

    def cleanup_session_file(self):
        """Clean up session conversations (matching old structure: new_convo.json cleanup)."""
        # In Firestore, new_convo collection can be cleared if needed
        # For now, we'll keep them but can add cleanup logic later
        logger.info("Session cleanup called (Firestore new_convo - no action needed)")

    # ========== Document Methods ==========

    @log_errors
    def save_document(self, document):
        """Save a document to Firestore."""
        doc_data = self._to_dict(document)
        
        # Ensure upload_time is datetime
        if 'upload_time' in doc_data:
            if isinstance(doc_data['upload_time'], str):
                doc_data['upload_time'] = datetime.fromisoformat(doc_data['upload_time'])
        
        # Save to Firestore
        doc_ref = self.db.collection('users').document(document.user_id).collection('documents').document(document.id)
        doc_ref.set(doc_data)
        
        logger.info(f"Document saved: {document.filename} for user {document.user_id}")

    @log_errors
    def get_user_documents(self, user_id: str, limit: int = 20) -> List:
        """Get user's documents from Firestore."""
        # Import Document class dynamically
        from lazycook6 import Document
        
        try:
            logger.info(f"📄 [FIRESTORE] Fetching documents for user {user_id} (limit: {limit})")
            docs_ref = self.db.collection('users').document(user_id).collection('documents')
            query = docs_ref.order_by('upload_time', direction='DESCENDING').limit(limit)
            docs = query.stream()
            
            documents = []
            for doc in docs:
                data = doc.to_dict()
                if data:
                    # Convert timestamp - Document.from_dict expects ISO string format
                    if 'upload_time' in data:
                        upload_time = data['upload_time']
                        # If it's already a datetime, convert to ISO string
                        if isinstance(upload_time, datetime):
                            data['upload_time'] = upload_time.isoformat()
                        # If it's a string, keep it (should be ISO format)
                        elif isinstance(upload_time, str):
                            # Validate it's a valid ISO string
                            try:
                                datetime.fromisoformat(upload_time)
                                # Keep as is
                            except (ValueError, AttributeError):
                                # Try to convert and then to ISO
                                dt = self._firestore_to_datetime(upload_time)
                                if isinstance(dt, datetime):
                                    data['upload_time'] = dt.isoformat()
                                else:
                                    data['upload_time'] = datetime.now().isoformat()
                        else:
                            # Convert Firestore timestamp to datetime, then to ISO string
                            dt = self._firestore_to_datetime(upload_time)
                            if isinstance(dt, datetime):
                                data['upload_time'] = dt.isoformat()
                            else:
                                # Fallback to current time
                                data['upload_time'] = datetime.now().isoformat()
                    # Ensure all required fields exist
                    if 'hash_value' not in data:
                        data['hash_value'] = ''
                    if 'metadata' not in data:
                        data['metadata'] = {}
                    document = Document.from_dict(data)
                    documents.append(document)
                    logger.debug(f"📄 [FIRESTORE] Loaded document: {document.filename} (id: {document.id}, size: {len(document.content)} chars)")
            
            logger.info(f"📄 [FIRESTORE] Successfully loaded {len(documents)} documents from Firestore")
            return documents
        except Exception as e:
            logger.error(f"Error fetching documents: {e}", exc_info=True)
            return []

    @log_errors
    def delete_document(self, document_id: str, user_id: str) -> bool:
        """Delete a document from Firestore."""
        try:
            doc_ref = self.db.collection('users').document(user_id).collection('documents').document(document_id)
            doc_ref.delete()
            logger.info(f"Document deleted: {document_id} for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete document: {e}")
            return False

    def get_documents_context(self, user_id: str, limit: int = 50, full_content: bool = True, document_id: Optional[str] = None, document_ids: Optional[List[str]] = None) -> str:
        """Get formatted document context for AI."""
        # Support both document_id (single, backward compatibility) and document_ids (multiple)
        # Prioritize document_ids if provided (even if empty), otherwise fall back to document_id
        if document_ids is None:
            if document_id:
                document_ids = [document_id]
            else:
                document_ids = None
        # If document_ids is provided (even if empty list), use it as-is
        
        logger.info(f"📄 [FIRESTORE] get_documents_context called: user_id={user_id}, document_id={document_id}, document_ids={document_ids}, limit={limit}, full_content={full_content}")
        documents = self.get_user_documents(user_id, limit * 2)  # Get more to ensure we find the specific ones
        logger.info(f"📄 [FIRESTORE] Retrieved {len(documents)} documents from Firestore")
        
        # Log document IDs for debugging
        if documents:
            doc_ids = [doc.id for doc in documents]
            logger.info(f"📄 [FIRESTORE] Document IDs found: {doc_ids[:5]}... (showing first 5)")
        
        # If document_ids is provided, ONLY use those documents (like ChatGPT with multiple files)
        if document_ids:
            logger.info(f"📄 [FIRESTORE] Looking for specific document_ids: {document_ids}")
            # Find the specific documents
            specific_docs = []
            for doc_id in document_ids:
                for doc in documents:
                    if doc.id == doc_id:
                        specific_docs.append(doc)
                        logger.info(f"📄 [FIRESTORE] ✅ Found attached document: {doc.filename} (id: {doc.id})")
                        break
            
            # ONLY use the attached documents, no other documents
            if specific_docs:
                documents = specific_docs  # ChatGPT behavior: only the attached files
                logger.info(f"📄 [FIRESTORE] Using ONLY attached documents: {len(specific_docs)} files, total content length: {sum(len(doc.content) for doc in specific_docs)} chars")
            else:
                # If not found, return empty (documents might not be in Firestore yet)
                logger.warning(f"📄 [FIRESTORE] ⚠️ Attached document_ids '{document_ids}' not found in Firestore! Available IDs: {[doc.id for doc in documents[:5]]}")
                documents = []
        else:
            documents = documents[:limit]
        
        if not documents:
            logger.info(f"📄 [FIRESTORE] No documents found for user {user_id}")
            return ""

        context_parts = []
        for i, doc in enumerate(documents):
            priority_marker = " (ATTACHED)" if document_ids and doc.id in document_ids else ""
            context_parts.append(f"\n--- Document {i + 1}: {doc.filename}{priority_marker} ---")

            if full_content:
                # Pass COMPLETE content - NO TRUNCATION
                context_parts.append(doc.content)
                logger.info(f"📄 [FIRESTORE] Added full content for {doc.filename}: {len(doc.content)} chars")
            else:
                # Preview only for display (when full_content=False)
                content_preview = doc.content[:500] + "..." if len(doc.content) > 500 else doc.content
                context_parts.append(content_preview)

        result = "\n".join(context_parts)
        logger.info(f"📄 [FIRESTORE] Document context built: {len(result)} chars total, {len(documents)} documents")
        return result

    @log_errors
    def process_uploaded_file(self, file_path: str, user_id: str, original_filename: Optional[str] = None):
        """Process uploaded file and create Document (same as TextFileManager)."""
        # Import Document class and related functions
        from lazycook6 import Document
        import os
        import mimetypes
        from pathlib import Path
        
        try:
            path = Path(file_path)
            if not path.exists():
                logger.error(f"File not found: {file_path}")
                return None

            # Use original filename if provided, otherwise use temp file name
            filename = original_filename if original_filename else path.name
            logger.info(f"📄 [FIRESTORE] Processing file: {filename} (original: {original_filename})")

            file_type = mimetypes.guess_type(filename)[0] or 'text/plain'  # Use original filename for MIME type detection
            content = ""

            # Handle different file types (same as TextFileManager)
            if file_type.startswith('text/'):
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
            elif file_type == 'application/json':
                # JSON files are application/json, not text/*
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
            elif file_type == 'application/pdf':
                try:
                    from PyPDF2 import PdfReader
                    reader = PdfReader(path)
                    number_of_pages = len(reader.pages)
                    content_parts = []
                    for i in range(number_of_pages):
                        page = reader.pages[i]
                        text = page.extract_text()
                        if text.strip():
                            content_parts.append(text)
                    content = "\n\n".join(content_parts) if content_parts else "[PDF - No text content extracted]"
                    logger.info(f"PDF extracted: {number_of_pages} pages, {len(content)} characters")
                except Exception as e:
                    logger.error(f"Error extracting PDF content: {e}")
                    content = f"[PDF - Error extracting content: {str(e)}]"
            elif file_type == 'text/markdown':
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
            elif file_type == 'text/csv':
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
            else:
                # Try to read as text anyway
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                except:
                    content = f"[Binary file: {filename} - content not extractable]"

            # Calculate file hash
            import hashlib
            import time
            with open(path, 'rb') as f:
                file_hash = hashlib.md5(f.read()).hexdigest()

            file_size = path.stat().st_size
            
            # Create document with same ID format as TextFileManager
            doc_id = f"{user_id}_{int(time.time())}_{file_hash[:8]}"
            document = Document(
                id=doc_id,
                filename=filename,  # Use original filename instead of temp file name
                content=content,
                file_type=file_type,
                file_size=file_size,
                upload_time=datetime.now(),
                user_id=user_id,
                hash_value=file_hash,
                metadata={
                    'original_path': str(path),
                    'original_filename': original_filename,  # Store original filename in metadata too
                    'processed_at': datetime.now().isoformat()
                }
            )
            
            self.save_document(document)
            return document
        except Exception as e:
            logger.error(f"Error processing uploaded file: {e}")
            return None

    # ========== Task Methods ==========

    @log_errors
    def save_task(self, task):
        """Save a task to Firestore."""
        task_data = self._to_dict(task)
        
        # Ensure timestamps are datetime
        for time_field in ['created_at', 'scheduled_for']:
            if time_field in task_data:
                if isinstance(task_data[time_field], str):
                    task_data[time_field] = datetime.fromisoformat(task_data[time_field])
        
        # Get user_id from task (may need to get from conversation_id if not directly available)
        # Check if task has user_id attribute, otherwise try to get from conversation
        user_id = getattr(task, 'user_id', None)
        if not user_id:
            # Try to get user_id from conversation
            # For now, we'll need to fetch it from the conversation
            # This is a limitation - tasks should have user_id
            logger.warning(f"Task {task.id} missing user_id, trying to infer from conversation")
            # For backward compatibility, we'll store in a global tasks collection
            task_ref = self.db.collection('tasks').document(task.id)
        else:
            # Save to Firestore under user's collection
            task_ref = self.db.collection('users').document(user_id).collection('tasks').document(task.id)
        
        task_ref.set(task_data)
        logger.info(f"Task saved: {task.id}")

    @log_errors
    def get_all_tasks_as_dicts(self, user_id: str = None) -> List[Dict]:
        """Get all tasks as dictionaries (for compatibility with TextFileManager._read_json_file)."""
        try:
            all_tasks_data = []
            
            if user_id:
                # Get tasks for specific user
                tasks_ref = self.db.collection('users').document(user_id).collection('tasks')
                docs = tasks_ref.stream()
                
                for doc in docs:
                    data = doc.to_dict()
                    if data:
                        # Convert timestamps to ISO strings for compatibility
                        for time_field in ['created_at', 'scheduled_for']:
                            if time_field in data:
                                dt = self._firestore_to_datetime(data[time_field])
                                data[time_field] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                        all_tasks_data.append(data)
            else:
                # Get tasks for all users (for backward compatibility)
                users_ref = self.db.collection('users')
                users = users_ref.stream()
                
                for user_doc in users:
                    tasks_ref = user_doc.reference.collection('tasks')
                    docs = tasks_ref.stream()
                    
                    for doc in docs:
                        data = doc.to_dict()
                        if data:
                            # Convert timestamps to ISO strings
                            for time_field in ['created_at', 'scheduled_for']:
                                if time_field in data:
                                    dt = self._firestore_to_datetime(data[time_field])
                                    data[time_field] = dt.isoformat() if isinstance(dt, datetime) else str(dt)
                            all_tasks_data.append(data)
            
            return all_tasks_data
        except Exception as e:
            logger.error(f"Error fetching all tasks: {e}")
            return []

    @log_errors
    def get_pending_tasks(self, user_id: str = None) -> List:
        """Get pending tasks from Firestore."""
        # Import Task class dynamically
        from lazycook6 import Task
        
        try:
            now = datetime.now()
            pending_tasks = []
            
            if user_id:
                # Get tasks for specific user
                tasks_ref = self.db.collection('users').document(user_id).collection('tasks')
                # Get all tasks and filter in Python (Firestore where() can be complex)
                all_tasks = tasks_ref.stream()
                
                for doc in all_tasks:
                    data = doc.to_dict()
                    if data and data.get('status') == 'pending':
                        # Check if scheduled_for is in the past
                        scheduled_for = self._firestore_to_datetime(data.get('scheduled_for', now))
                        if scheduled_for <= now:
                            # Convert timestamps
                            for time_field in ['created_at', 'scheduled_for']:
                                if time_field in data:
                                    data[time_field] = self._firestore_to_datetime(data[time_field])
                            pending_tasks.append(Task.from_dict(data))
            else:
                # Get tasks for all users (for backward compatibility)
                users_ref = self.db.collection('users')
                users = users_ref.stream()
                
                for user_doc in users:
                    tasks_ref = user_doc.reference.collection('tasks')
                    all_tasks = tasks_ref.stream()
                    
                    for doc in all_tasks:
                        data = doc.to_dict()
                        if data and data.get('status') == 'pending':
                            scheduled_for = self._firestore_to_datetime(data.get('scheduled_for', now))
                            if scheduled_for <= now:
                                for time_field in ['created_at', 'scheduled_for']:
                                    if time_field in data:
                                        data[time_field] = self._firestore_to_datetime(data[time_field])
                                pending_tasks.append(Task.from_dict(data))
            
            # Sort by priority and scheduled_for
            pending_tasks.sort(key=lambda x: (-x.priority, x.scheduled_for))
            return pending_tasks
        except Exception as e:
            logger.error(f"Error fetching pending tasks: {e}")
            return []

    # ========== Utility Methods ==========

    @log_errors
    def get_storage_stats(self, user_id: str = None) -> Dict[str, Any]:
        """Get storage statistics from Firestore."""
        try:
            if user_id:
                # Get stats for specific user
                conv_ref = self.db.collection('users').document(user_id).collection('conversations')
                docs_ref = self.db.collection('users').document(user_id).collection('documents')
                tasks_ref = self.db.collection('users').document(user_id).collection('tasks')
                
                conversations = list(conv_ref.stream())
                documents = list(docs_ref.stream())
                tasks = list(tasks_ref.stream())
                
                return {
                    'total_conversations': len(conversations),
                    'total_tasks': len(tasks),
                    'total_documents': len(documents),
                    'users': {user_id: len(conversations)},
                    'oldest_conversation': min([c.to_dict().get('timestamp', '') for c in conversations], default='none'),
                    'newest_conversation': max([c.to_dict().get('timestamp', '') for c in conversations], default='none'),
                    'files_exist': {
                        'conversations': len(conversations) > 0,
                        'tasks': len(tasks) > 0,
                        'documents': len(documents) > 0,
                        'new_convo': len(list(
                            self.db.collection('users')
                            .document(user_id)
                            .collection('new_convo')
                            .stream()
                        )),
                        'session_file_exists': True  # Always true in Firestore (matching new_convo.json)
                    }
                }
            else:
                # Get stats for all users
                users_ref = self.db.collection('users')
                users = users_ref.stream()
                
                total_conversations = 0
                total_tasks = 0
                total_documents = 0
                user_stats = {}
                all_timestamps = []
                
                for user_doc in users:
                    user_id = user_doc.id
                    conv_ref = user_doc.reference.collection('conversations')
                    docs_ref = user_doc.reference.collection('documents')
                    tasks_ref = user_doc.reference.collection('tasks')
                    
                    conversations = list(conv_ref.stream())
                    documents = list(docs_ref.stream())
                    tasks = list(tasks_ref.stream())
                    
                    conv_count = len(conversations)
                    total_conversations += conv_count
                    total_tasks += len(tasks)
                    total_documents += len(documents)
                    user_stats[user_id] = conv_count
                    
                    # Collect timestamps
                    for conv in conversations:
                        data = conv.to_dict()
                        if 'timestamp' in data:
                            all_timestamps.append(data['timestamp'])
                
                return {
                    'total_conversations': total_conversations,
                    'total_tasks': total_tasks,
                    'total_documents': total_documents,
                    'users': user_stats,
                    'oldest_conversation': min(all_timestamps, default='none'),
                    'newest_conversation': max(all_timestamps, default='none'),
                    'files_exist': {
                        'conversations': total_conversations > 0,
                        'tasks': total_tasks > 0,
                        'documents': total_documents > 0,
                        'new_convo': 0,  # Would need to count separately (matching new_convo.json)
                        'session_file_exists': True
                    }
                }
        except Exception as e:
            logger.error(f"Error getting storage stats: {e}")
            return {
                'total_conversations': 0,
                'total_tasks': 0,
                'total_documents': 0,
                'users': {},
                'oldest_conversation': 'none',
                'newest_conversation': 'none',
                'files_exist': {
                    'conversations': False,
                    'tasks': False,
                    'documents': False,
                    'new_convo': 0,
                    'session_file_exists': False
                }
            }

    def debug_context_flow(self, user_id: str):
        """Debug method to check context flow."""
        session_convs = self.get_session_conversations(user_id, 5)
        all_convs = self.get_recent_conversations(user_id, 5)

        logger.info(f"Session conversations: {len(session_convs)}")
        logger.info(f"All conversations: {len(all_convs)}")

        context = self.get_conversation_context(user_id)
        logger.info(f"Context length: {len(context)} chars")
        logger.info(f"Context preview: {context[:200]}...")



