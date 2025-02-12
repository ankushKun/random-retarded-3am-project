import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require("../service-account.json")),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
}

export const db = admin.firestore();
export const auth = admin.auth(); 