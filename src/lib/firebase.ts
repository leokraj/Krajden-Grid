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
  projectId: "gen-lang-client-0652230217",
  appId: "1:277883395164:web:1e3ae885c1a7bfda025a99",
  apiKey: "AIzaSyAcFNalZUXT1_MlfkhH34XkmoqWzsqESOg",
  authDomain: "gen-lang-client-0652230217.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-krajdengrid-29722090-d9f6-40a4-9c98-c4e76e51e4ff",
  storageBucket: "gen-lang-client-0652230217.firebasestorage.app",
  messagingSenderId: "277883395164",
  measurementId: "",
  oAuthClientId: "277883395164-u3v9dj7rjg5gbctkq6n124b21usqkse9.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
