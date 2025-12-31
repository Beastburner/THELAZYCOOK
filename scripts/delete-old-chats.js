/**
 * Simple script to delete old Firestore chats
 * 
 * Setup:
 * 1. npm install firebase-admin
 * 2. Download service account key from Firebase Console
 * 3. Update SERVICE_ACCOUNT_PATH below
 * 4. Run: node scripts/delete-old-chats.js
 */

const admin = require('firebase-admin');

// UPDATE THIS PATH to your service account key
const SERVICE_ACCOUNT_PATH = './service-account-key.json';

// Days to keep (chats older than this will be deleted)
const DAYS_TO_KEEP = 30;

// Initialize Firebase Admin
try {
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error('❌ Error loading service account key:', error.message);
  console.error('\n📝 To get your service account key:');
  console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save it as service-account-key.json in project root');
  process.exit(1);
}

const db = admin.firestore();

async function deleteOldChats() {
  console.log(`🗑️  Starting cleanup: Deleting chats older than ${DAYS_TO_KEEP} days...\n`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
  console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}\n`);
  
  try {
    const usersSnapshot = await db.collection('users').get();
    console.log(`👥 Found ${usersSnapshot.size} users\n`);
    
    let totalDeleted = 0;
    let totalChecked = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const chatsRef = userDoc.ref.collection('chats');
      const chatsSnapshot = await chatsRef.get();
      
      totalChecked += chatsSnapshot.size;
      
      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data();
        const createdAt = chatData.createdAt?.toDate?.() || 
                         (chatData.createdAt?.seconds ? new Date(chatData.createdAt.seconds * 1000) : null);
        
        if (createdAt && createdAt < cutoffDate) {
          await chatDoc.ref.delete();
          totalDeleted++;
          console.log(`  ✅ Deleted chat ${chatDoc.id} (created: ${createdAt.toISOString()})`);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Total chats checked: ${totalChecked}`);
    console.log(`   - Chats deleted: ${totalDeleted}`);
    console.log(`   - Chats kept: ${totalChecked - totalDeleted}`);
    console.log(`\n✅ Cleanup complete!`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup
deleteOldChats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

