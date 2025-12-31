# How to Delete Old Data from Firestore

## Quick Methods

### Method 1: Firebase Console (Recommended for Small Datasets)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project: `lazycookai-bdefa`

2. **Navigate to Firestore Database**
   - Click on "Firestore Database" in the left sidebar
   - You'll see your collections: `users`, etc.

3. **Delete Individual Documents**
   - Click on a collection (e.g., `users`)
   - Click on a user document
   - Click on subcollections (e.g., `chats`)
   - Select documents and click "Delete"

4. **Delete Entire Collections** (if needed)
   - Some collections can be deleted via the console
   - Be careful - this is permanent!

### Method 2: Using Firebase CLI

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Select your project
firebase use lazycookai-bdefa

# Delete a specific document
firebase firestore:delete users/USER_ID/chats/CHAT_ID

# Note: CLI doesn't have a direct "delete collection" command
# You'll need to use a script for bulk deletion
```

### Method 3: Programmatic Deletion Script

Create a Node.js script to delete old data:

```javascript
// delete-old-data.js
const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteOldChats(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const usersSnapshot = await db.collection('users').get();
  let deleted = 0;
  
  for (const userDoc of usersSnapshot.docs) {
    const chatsSnapshot = await userDoc.ref.collection('chats').get();
    
    for (const chatDoc of chatsSnapshot.docs) {
      const data = chatDoc.data();
      const createdAt = data.createdAt?.toDate();
      
      if (createdAt && createdAt < cutoffDate) {
        await chatDoc.ref.delete();
        deleted++;
        console.log(`Deleted: ${chatDoc.id}`);
      }
    }
  }
  
  console.log(`Deleted ${deleted} old chats`);
}

deleteOldChats(30).then(() => process.exit(0));
```

**To use this script:**
1. Download service account key from Firebase Console → Project Settings → Service Accounts
2. Save it as `service-account-key.json` in your project root
3. Install: `npm install firebase-admin`
4. Run: `node delete-old-data.js`

### Method 4: Delete Everything (Nuclear Option)

⚠️ **WARNING: This deletes ALL data!**

```javascript
// delete-all-data.js
const admin = require('firebase-admin');
// ... initialize admin ...

async function deleteCollection(collectionPath) {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.get();
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  console.log(`Deleted collection: ${collectionPath}`);
}

// Delete all users (and their subcollections)
async function deleteAllUsers() {
  const usersSnapshot = await db.collection('users').get();
  
  for (const userDoc of usersSnapshot.docs) {
    // Delete subcollections first
    const chatsSnapshot = await userDoc.ref.collection('chats').get();
    const batch = db.batch();
    chatsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    // Delete user document
    await userDoc.ref.delete();
  }
}

deleteAllUsers().then(() => process.exit(0));
```

## Recommended Approach

For your quota issue, I recommend:

1. **Delete old chat messages** (keep last 30 days)
2. **Delete old conversations** (if you have a separate collection)
3. **Keep user documents** (important data)

This will free up quota while preserving recent data.

## Getting Service Account Key

1. Go to Firebase Console
2. Project Settings (gear icon)
3. Service Accounts tab
4. Click "Generate new private key"
5. Save the JSON file securely

## Safety Tips

- ✅ Always backup important data first
- ✅ Test on a small subset before bulk deletion
- ✅ Use date filters to keep recent data
- ✅ Consider archiving instead of deleting
- ❌ Never delete without checking what you're deleting

