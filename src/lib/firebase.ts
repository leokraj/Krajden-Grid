import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';

export const firebaseConfig = {
  projectId: "krajdengrid",
  appId: "1:425478702027:web:a33ee843e5edce72806c4e",
  apiKey: "AIzaSyCMOh5tFvH-8dTgZFb6HquhiHEcfc6w6HA",
  authDomain: "krajdengrid.firebaseapp.com",
  firestoreDatabaseId: "(default)",
  storageBucket: "krajdengrid.firebasestorage.app",
  messagingSenderId: "425478702027",
  measurementId: "G-MSH2VWRS6P",
  oAuthClientId: "",
  recaptchaSiteKey: ""
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
