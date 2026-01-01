import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import type { DocumentData, QuerySnapshot } from 'firebase/firestore';
import { db } from './config';

/**
 * Get a user's document from Firestore
 */
export const getUserDoc = async (userId: string): Promise<DocumentData | null> => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? userSnap.data() : null;
};

/**
 * Create or update a user document
 */
export const setUserDoc = async (userId: string, data: any): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error: any) {
    // Handle Firestore quota exceeded and other errors gracefully
    if (error?.code === 'resource-exhausted') {
      console.warn('⚠️ [FIRESTORE] Quota exceeded. User data will be stored locally only.');
      throw new Error('Firestore quota exceeded. Your data is saved locally, but cannot be synced to the cloud.');
    } else if (error?.code === 'permission-denied') {
      console.warn('⚠️ [FIRESTORE] Permission denied.');
      throw new Error('Permission denied. Please check your authentication.');
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * Get all chats for a user
 */
export const getUserChats = async (userId: string): Promise<DocumentData[]> => {
  const chatsRef = collection(db, 'users', userId, 'chats');
  const q = query(chatsRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Subscribe to real-time updates of user chats
 */
export const subscribeToUserChats = (
  userId: string,
  callback: (chats: DocumentData[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const chatsRef = collection(db, 'users', userId, 'chats');
  const q = query(chatsRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(
    q, 
    (snapshot: QuerySnapshot) => {
      const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(chats);
    },
    (error: any) => {
      console.error('⚠️ [FIRESTORE] Subscription error:', error);
      
      // Handle quota exceeded errors
      if (error?.code === 'resource-exhausted' || error?.message?.includes('quota exceeded')) {
        console.warn('⚠️ [FIRESTORE] Quota exceeded. Subscription disabled. Using local storage fallback.');
        if (onError) {
          onError(new Error('Firestore quota exceeded. Subscription disabled.'));
        }
        // Try to load from localStorage as fallback
        try {
          const backup = localStorage.getItem(`lazycook_chats_backup_${userId}`);
          if (backup) {
            const parsed = JSON.parse(backup);
            if (parsed.chats && Array.isArray(parsed.chats)) {
              console.log('📦 [FRONTEND] Loading chats from localStorage backup');
              callback(parsed.chats.map((chat: any) => ({
                id: chat.id,
                ...chat
              })));
            }
          }
        } catch (e) {
          console.error('⚠️ [FRONTEND] Failed to load from localStorage:', e);
        }
      } else if (onError) {
        onError(error);
      }
    }
  );
};

/**
 * Create or update a chat document
 */
export const setChatDoc = async (
  userId: string,
  chatId: string,
  data: any
): Promise<void> => {
  try {
    const chatRef = doc(db, 'users', userId, 'chats', chatId);
    
    // Remove undefined values (Firestore doesn't accept undefined)
    const cleanData: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    }
    
    // Convert createdAt to Firestore Timestamp if it's a number
    const chatData: any = {
      ...cleanData,
      updatedAt: serverTimestamp()
    };
    
    // If createdAt is a number (milliseconds), convert to Firestore Timestamp
    if (cleanData.createdAt && typeof cleanData.createdAt === 'number') {
      chatData.createdAt = Timestamp.fromMillis(cleanData.createdAt);
    } else if (!cleanData.createdAt) {
      // If no createdAt, set it to now
      chatData.createdAt = serverTimestamp();
    }
    
    // Ensure messages is an array (not undefined)
    if (!chatData.messages) {
      chatData.messages = [];
    }
    
    await setDoc(chatRef, chatData, { merge: true });
  } catch (error: any) {
    // Handle Firestore quota exceeded and other errors gracefully
    if (error?.code === 'resource-exhausted') {
      console.warn('⚠️ [FIRESTORE] Quota exceeded. Data will be stored locally only.');
      throw new Error('Firestore quota exceeded. Your data is saved locally, but cannot be synced to the cloud. Please upgrade your Firebase plan or wait for quota reset.');
    } else if (error?.code === 'permission-denied') {
      console.warn('⚠️ [FIRESTORE] Permission denied.');
      throw new Error('Permission denied. Please check your authentication.');
    } else if (error?.message?.includes('ERR_BLOCKED_BY_CLIENT') || error?.message?.includes('blocked')) {
      console.warn('⚠️ [FIRESTORE] Request blocked by browser extension.');
      throw new Error('Firestore request blocked by browser extension. Please disable ad blockers for this site.');
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * Delete a chat document
 */
export const deleteChatDoc = async (userId: string, chatId: string): Promise<void> => {
  const chatRef = doc(db, 'users', userId, 'chats', chatId);
  await deleteDoc(chatRef);
};

/**
 * Get conversations for a user (for AI context)
 */
export const getUserConversations = async (
  userId: string,
  limitCount: number = 70
): Promise<DocumentData[]> => {
  const conversationsRef = collection(db, 'users', userId, 'conversations');
  const q = query(
    conversationsRef,
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Save a conversation for AI context
 */
export const saveConversation = async (
  userId: string,
  conversationData: {
    prompt: string;
    response: string;
    model?: string;
    metadata?: any;
  }
): Promise<void> => {
  const conversationsRef = collection(db, 'users', userId, 'conversations');
  await setDoc(doc(conversationsRef), {
    ...conversationData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

/**
 * Get documents for a user
 */
export const getUserDocuments = async (userId: string): Promise<DocumentData[]> => {
  const documentsRef = collection(db, 'users', userId, 'documents');
  const q = query(documentsRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Save a document for a user
 */
export const saveDocument = async (
  userId: string,
  documentData: {
    filename: string;
    content: string;
    metadata?: any;
  }
): Promise<string> => {
  const documentsRef = collection(db, 'users', userId, 'documents');
  const docRef = doc(documentsRef);
  await setDoc(docRef, {
    ...documentData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

/**
 * Delete a document
 */
export const deleteDocument = async (userId: string, documentId: string): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'documents', documentId);
  await deleteDoc(docRef);
};

/**
 * Get user's plan information
 */
export const getUserPlan = async (userId: string): Promise<string> => {
  const userData = await getUserDoc(userId);
  return userData?.plan || 'GO';
};

/**
 * Update user's plan
 */
export const updateUserPlan = async (userId: string, plan: string): Promise<void> => {
  await setUserDoc(userId, { 
    plan,
    planUpdatedAt: serverTimestamp()
  });
};

/**
 * Get user's subscription information
 */
export const getUserSubscription = async (userId: string): Promise<any> => {
  const userData = await getUserDoc(userId);
  return userData?.subscription || null;
};

/**
 * Update user's subscription (mock subscription system)
 */
export const updateUserSubscription = async (
  userId: string, 
  subscriptionData: {
    plan: string;
    status: 'active' | 'cancelled' | 'expired';
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
  }
): Promise<void> => {
  await setUserDoc(userId, {
    subscription: {
      ...subscriptionData,
      updatedAt: new Date().toISOString()
    },
    plan: subscriptionData.plan,
    planUpdatedAt: serverTimestamp()
  });
};

/**
 * Get a shared chat by ID from the public shared chats collection
 */
export const getSharedChat = async (chatId: string): Promise<DocumentData | null> => {
  try {
    const sharedChatRef = doc(db, 'sharedChats', chatId);
    const sharedChatSnap = await getDoc(sharedChatRef);
    return sharedChatSnap.exists() ? { id: sharedChatSnap.id, ...sharedChatSnap.data() } : null;
  } catch (error: any) {
    console.error('Error fetching shared chat:', error);
    return null;
  }
};

/**
 * Save a chat to the public shared chats collection
 */
export const shareChat = async (chatId: string, chatData: any): Promise<void> => {
  try {
    const sharedChatRef = doc(db, 'sharedChats', chatId);
    await setDoc(sharedChatRef, {
      ...chatData,
      sharedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error: any) {
    console.error('Error sharing chat:', error);
    throw error;
  }
};

