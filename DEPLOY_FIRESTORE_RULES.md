# Deploy Firestore Security Rules

Your Firestore rules need to be deployed to the new Firebase project (`lazytest-1f8ae`).

## Method 1: Firebase Console (Easiest)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select project: `lazytest-1f8ae`

2. **Navigate to Firestore**
   - Click on "Firestore Database" in the left sidebar
   - Click on the "Rules" tab

3. **Copy and Paste Rules**
   - Copy the contents of `firestore.rules` file
   - Paste into the rules editor
   - Click "Publish"

## Method 2: Firebase CLI

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not already done)
cd lazycook-ui  # or wherever your firestore.rules file is
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

## Method 3: Quick Rules (Copy-Paste)

Copy this into Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read and write their own chats
    match /users/{userId}/chats/{chatId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read and write their own conversations
    match /users/{userId}/conversations/{conversationId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read and write their own session conversations
    match /users/{userId}/new_convo/{conversationId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read and write their own documents
    match /users/{userId}/documents/{documentId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read and write their own tasks
    match /users/{userId}/tasks/{taskId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Verify Rules Are Active

After deploying:
1. Refresh your app
2. Try to create a chat
3. The permission errors should be gone

## Troubleshooting

If you still get permission errors:
- Make sure you're authenticated (signed in)
- Check that the Firebase project ID matches in your `.env` file
- Verify rules were published successfully in Firebase Console
- Check browser console for specific error messages

