/**
 * Firestore Cleanup Script
 * 
 * This script helps you delete old data from Firestore.
 * 
 * Usage:
 * 1. Install Firebase Admin SDK: npm install firebase-admin
 * 2. Set up service account key (download from Firebase Console)
 * 3. Run: node scripts/cleanup-firestore.js
 * 
 * Or use the Firebase Console method (see instructions below)
 */

// Option 1: Using Firebase Admin SDK (Node.js script)
// Uncomment and configure this if you want to use the script method

/*
const admin = require('firebase-admin');
const serviceAccount = require('./path-to-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Delete all chats older than X days
async function deleteOldChats(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const usersRef = db.collection('users');
  const usersSnapshot = await usersRef.get();
  
  let totalDeleted = 0;
  
  for (const userDoc of usersSnapshot.docs) {
    const chatsRef = userDoc.ref.collection('chats');
    const chatsSnapshot = await chatsRef.get();
    
    for (const chatDoc of chatsSnapshot.docs) {
      const chatData = chatDoc.data();
      const createdAt = chatData.createdAt?.toDate();
      
      if (createdAt && createdAt < cutoffDate) {
        await chatDoc.ref.delete();
        totalDeleted++;
        console.log(`Deleted chat ${chatDoc.id} from user ${userDoc.id}`);
      }
    }
  }
  
  console.log(`Total chats deleted: ${totalDeleted}`);
}

// Delete all conversations older than X days
async function deleteOldConversations(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const usersRef = db.collection('users');
  const usersSnapshot = await usersRef.get();
  
  let totalDeleted = 0;
  
  for (const userDoc of usersSnapshot.docs) {
    const conversationsRef = userDoc.ref.collection('conversations');
    const conversationsSnapshot = await conversationsRef.get();
    
    for (const convDoc of conversationsSnapshot.docs) {
      const convData = convDoc.data();
      const createdAt = convData.createdAt?.toDate();
      
      if (createdAt && createdAt < cutoffDate) {
        await convDoc.ref.delete();
        totalDeleted++;
        console.log(`Deleted conversation ${convDoc.id} from user ${userDoc.id}`);
      }
    }
  }
  
  console.log(`Total conversations deleted: ${totalDeleted}`);
}

// Delete all documents older than X days
async function deleteOldDocuments(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const usersRef = db.collection('users');
  const usersSnapshot = await usersRef.get();
  
  let totalDeleted = 0;
  
  for (const userDoc of usersSnapshot.docs) {
    const documentsRef = userDoc.ref.collection('documents');
    const documentsSnapshot = await documentsRef.get();
    
    for (const docDoc of documentsSnapshot.docs) {
      const docData = docDoc.data();
      const createdAt = docData.createdAt?.toDate();
      
      if (createdAt && createdAt < cutoffDate) {
        await docDoc.ref.delete();
        totalDeleted++;
        console.log(`Deleted document ${docDoc.id} from user ${userDoc.id}`);
      }
    }
  }
  
  console.log(`Total documents deleted: ${totalDeleted}`);
}

// Run cleanup
async function cleanup() {
  console.log('Starting Firestore cleanup...');
  await deleteOldChats(30); // Delete chats older than 30 days
  await deleteOldConversations(30); // Delete conversations older than 30 days
  await deleteOldDocuments(30); // Delete documents older than 30 days
  console.log('Cleanup complete!');
  process.exit(0);
}

cleanup().catch(console.error);
*/

console.log(`
Firestore Cleanup Instructions
==============================

METHOD 1: Firebase Console (Easiest)
------------------------------------
1. Go to https://console.firebase.google.com/
2. Select your project (lazycookai-bdefa)
3. Navigate to Firestore Database
4. Click on collections to view data
5. Click on individual documents and delete them
6. Or use the "Delete collection" option (if available)

METHOD 2: Firebase CLI
----------------------
1. Install Firebase CLI: npm install -g firebase-tools
2. Login: firebase login
3. Select project: firebase use lazycookai-bdefa
4. Use Firestore delete command (requires Firestore rules update)

METHOD 3: Programmatic Script (Above)
-------------------------------------
1. Download service account key from Firebase Console
2. Place it in the scripts folder
3. Uncomment and configure the script above
4. Run: node scripts/cleanup-firestore.js

METHOD 4: Delete Entire Collection (Dangerous!)
-------------------------------------------------
⚠️ WARNING: This deletes ALL data in a collection!

Using Firebase Console:
- Go to Firestore Database
- Click on a collection
- Use "Delete collection" if available

Using Script:
- Modify the script above to delete entire collections
- Be very careful with this!

QUICK FIX: Delete Old Chats Only
---------------------------------
If you just want to free up quota, delete old chat messages:
1. Go to Firebase Console > Firestore
2. Navigate to: users > [userId] > chats
3. Delete old chat documents manually
4. Or use the script above to automate it

To reduce quota usage going forward:
- Reduce the number of Firestore writes
- Implement data retention policies
- Batch operations when possible
`);

