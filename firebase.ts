import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc } from 'firebase/firestore';

// Configuration provided in the original request
const firebaseConfig = {
  apiKey: "AIzaSyCvnO73l759vgkiF_JX7Gvd8f91blqKrQE",
  authDomain: "bogyul-5d40e.firebaseapp.com",
  projectId: "bogyul-5d40e",
  storageBucket: "bogyul-5d40e.firebasestorage.app",
  messagingSenderId: "399632210396",
  appId: "1:399632210396:web:6866ad6ecfb6d718d71719",
  measurementId: "G-ZRSBF59Q4W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Collection Reference Helper
// Path: artifacts -> bogyul-web-service -> public -> data -> substitution_records
export const APP_ID = 'bogyul-web-service';
export const APP_COLLECTION_PATH = 'substitution_records';

export const getRecordsCollection = () => {
  return collection(
    db, 
    'artifacts', 
    APP_ID, 
    'public', 
    'data', 
    APP_COLLECTION_PATH
  );
};

// ANSWER TO PROMPT QUESTION:
// Yes, this code is configured to connect to the Firebase project "bogyul-5d40e".
// The configuration includes the necessary API keys and project IDs.
// The code uses Firestore for database operations and Firebase Auth for anonymous login.