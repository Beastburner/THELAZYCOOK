"""
firebase_config.py

Firebase Admin SDK configuration for backend.
Initializes Firebase Admin and provides Firestore client.
"""

import os
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Firebase Admin SDK (only once)
if not firebase_admin._apps:
    try:
        # Option 1: Use service account JSON file (for local development)
        cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logger.info(f"Firebase Admin initialized with service account: {cred_path}")
        else:
            # Option 2: Use default credentials (for cloud deployment like GCP, Firebase Cloud Functions)
            # This will use Application Default Credentials (ADC)
            try:
                firebase_admin.initialize_app()
                logger.info("Firebase Admin initialized with default credentials")
            except Exception as adc_error:
                # If ADC fails, log warning but don't crash - credentials can be set later
                logger.warning(f"Firebase Admin default credentials not found: {adc_error}")
                logger.warning("Firebase features will be disabled until credentials are configured.")
                logger.warning("To fix: Set FIREBASE_SERVICE_ACCOUNT_PATH in .env or configure Application Default Credentials")
    except Exception as e:
        logger.warning(f"Firebase Admin initialization skipped: {e}")
        logger.warning("Firebase features will be disabled. Configure credentials to enable.")

# Get Firestore client (lazy initialization)
_db = None

def get_db():
    """Get Firestore client with lazy initialization."""
    global _db
    if _db is None:
        try:
            _db = firestore.client()
        except Exception as e:
            logger.warning(f"Firestore client initialization failed: {e}")
            logger.warning("Firestore operations will fail until credentials are configured.")
            # Return None to allow graceful degradation
            return None
    return _db

# For backward compatibility, try to initialize but don't fail if credentials aren't set
try:
    db = get_db()
except Exception as e:
    logger.warning(f"Could not initialize Firestore client at import time: {e}")
    db = None

# Export Firebase Auth for token verification
def verify_firebase_token(token: str) -> dict:
    """
    Verify a Firebase ID token and return the decoded token.
    
    Args:
        token: Firebase ID token string
        
    Returns:
        Decoded token dictionary with user info (uid, email, etc.)
        
    Raises:
        ValueError: If token is invalid or expired
    """
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise ValueError(f"Invalid or expired token: {str(e)}")

def get_user_from_firestore(user_id: str) -> dict:
    """
    Get user document from Firestore.
    
    Args:
        user_id: Firebase user UID
        
    Returns:
        User document data or None if not found
    """
    try:
        db_client = get_db()
        if db_client is None:
            logger.warning("Firestore client not available")
            return None
        user_ref = db_client.collection('users').document(user_id)
        user_doc = user_ref.get()
        if user_doc.exists:
            return user_doc.to_dict()
        return None
    except Exception as e:
        logger.error(f"Error fetching user from Firestore: {e}")
        return None

def get_user_plan(user_id: str) -> str:
    """
    Get user's plan from Firestore.
    
    Args:
        user_id: Firebase user UID
        
    Returns:
        User's plan (GO, PRO, or ULTRA) or "GO" as default
    """
    user_data = get_user_from_firestore(user_id)
    if user_data and 'plan' in user_data:
        return user_data['plan'].upper().strip()
    return "GO"  # Default plan

