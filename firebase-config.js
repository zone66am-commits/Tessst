// ضع بيانات مشروع Firebase هنا مرة واحدة فقط.
// Firebase Web config ليست كلمة سر، لكن صلاحيات Firestore يجب حمايتها من خلال Rules.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// هذا البريد يجب أن يكون نفس البريد الذي أنشأت له حساب Admin في Firebase Authentication.
export const ADMIN_EMAIL = "YOUR_ADMIN_EMAIL@example.com";
