# Database Migration Plan: JSON Files → Firestore

## Current State

### ✅ Already Done:
- Firebase Authentication (frontend)
- Plan selection and storage in Firestore (frontend)
- Firestore security rules configured
- Frontend sends Firebase tokens to backend

### ❌ Still Using JSON Files:
- **Conversations**: `multi_agent_data/conversations.json` and `new_convo.json`
- **Documents**: `multi_agent_data/documents.json`
- **Tasks**: `multi_agent_data/tasks.json`
- **User Plans**: In-memory `USERS` dict in `backend/auth.py`

### Current Architecture:
```
TextFileManager (in lazycook6.py, lazycook7_grok.py, lazycook_grok_gemini_2.py)
  ↓
JSON Files (conversations.json, documents.json, tasks.json)
  ↓
All users' data mixed together in single files
```

## Target Architecture

```
FirestoreManager (new class)
  ↓
Firestore Collections:
  - users/{userId}/conversations/{conversationId}
  - users/{userId}/documents/{documentId}
  - users/{userId}/tasks/{taskId}
  ↓
Isolated per-user data
```

## Migration Steps

### Phase 1: Backend Firebase Setup ✅ (Priority: HIGH)

**1.1 Install Firebase Admin SDK**
- Already in `requirements.txt`: `firebase-admin==6.5.0`
- Need to create `backend/firebase_config.py`

**1.2 Create Firebase Admin Configuration**
```python
# backend/firebase_config.py
import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        # Use default credentials (for cloud deployment)
        firebase_admin.initialize_app()

db = firestore.client()
```

**1.3 Update Backend Auth to Verify Firebase Tokens**
- Update `backend/auth.py` to verify Firebase ID tokens
- Fetch user plan from Firestore instead of in-memory dict
- Remove `USERS` in-memory dictionary

### Phase 2: Create FirestoreManager Class ✅ (Priority: HIGH)

**2.1 Create `backend/firestore_manager.py`**
- Replace `TextFileManager` functionality
- Methods needed:
  - `get_conversation_context(user_id, limit)` → Read from Firestore
  - `save_conversation(conversation)` → Write to Firestore
  - `get_user_documents(user_id, limit)` → Read from Firestore
  - `save_document(document)` → Write to Firestore
  - `get_pending_tasks(user_id)` → Read from Firestore
  - `save_task(task)` → Write to Firestore

**2.2 Firestore Collection Structure:**
```
users/
  {userId}/
    conversations/
      {conversationId}/
        - id
        - user_id
        - prompt
        - ai_response
        - timestamp
        - model
        - plan
        - metadata
    documents/
      {documentId}/
        - id
        - user_id
        - filename
        - content
        - upload_time
        - metadata
    tasks/
      {taskId}/
        - id
        - user_id
        - title
        - description
        - status
        - priority
        - scheduled_for
```

### Phase 3: Update AI Modules ✅ (Priority: HIGH)

**3.1 Update `lazycook6.py`**
- Replace `TextFileManager` with `FirestoreManager`
- Update all conversation/document/task operations

**3.2 Update `lazycook7_grok.py`**
- Same as above

**3.3 Update `lazycook_grok_gemini_2.py`**
- Same as above

**3.4 Update `baby_final.py`**
- Pass `FirestoreManager` instance to AI modules
- Ensure user_id is Firebase UID (not email)

### Phase 4: Data Migration (Optional) ✅ (Priority: MEDIUM)

**4.1 Migration Script**
- Create `backend/migrate_to_firestore.py`
- Read existing JSON files
- Upload to Firestore with proper user_id mapping
- Handle duplicate detection

**4.2 User ID Mapping**
- Map old email-based user_ids to Firebase UIDs
- May need user input or email matching

### Phase 5: Testing & Cleanup ✅ (Priority: MEDIUM)

**5.1 Testing**
- Test conversation saving/loading
- Test document upload/retrieval
- Test task management
- Test multi-user isolation

**5.2 Cleanup**
- Remove `TextFileManager` class
- Remove JSON file dependencies
- Update documentation

## Implementation Order

### Step 1: Backend Firebase Setup (Do First!)
1. Create `backend/firebase_config.py`
2. Update `backend/auth.py` to verify Firebase tokens
3. Fetch user plan from Firestore

### Step 2: Create FirestoreManager
1. Create `backend/firestore_manager.py`
2. Implement all TextFileManager methods using Firestore
3. Test with simple read/write operations

### Step 3: Update AI Modules
1. Update `lazycook6.py` to use FirestoreManager
2. Update `lazycook7_grok.py` to use FirestoreManager
3. Update `lazycook_grok_gemini_2.py` to use FirestoreManager
4. Update `baby_final.py` to pass FirestoreManager

### Step 4: Testing
1. Test end-to-end flow
2. Verify data isolation between users
3. Check performance

### Step 5: Migration (Optional)
1. Create migration script
2. Run migration for existing data
3. Verify migrated data

## Files to Create/Modify

### New Files:
- `backend/firebase_config.py` - Firebase Admin SDK setup
- `backend/firestore_manager.py` - Firestore operations
- `backend/migrate_to_firestore.py` - Data migration script (optional)

### Files to Modify:
- `backend/auth.py` - Verify Firebase tokens, fetch from Firestore
- `backend/lazycook6.py` - Replace TextFileManager
- `backend/lazycook7_grok.py` - Replace TextFileManager
- `backend/lazycook_grok_gemini_2.py` - Replace TextFileManager
- `backend/baby_final.py` - Pass FirestoreManager to modules

## Benefits After Migration

1. **Scalability**: No file system limits
2. **Multi-user Support**: Proper data isolation
3. **Real-time Updates**: Firestore real-time listeners
4. **Backup & Recovery**: Automatic backups
5. **Security**: Firestore security rules
6. **Cloud Ready**: Works on any server
7. **Consistency**: Single source of truth

## Next Steps

**Start with Step 1: Backend Firebase Setup**
- This is the foundation for everything else
- Once backend can verify Firebase tokens and fetch user data, we can proceed with FirestoreManager

