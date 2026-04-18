import CryptoJS from 'crypto-js';

// In a real production app, this should be derived securely (e.g. from user passwords via PBKDF2)
// For this 2-user private app, we use a shared client-side hardcoded key to encrypt data BEFORE it hits Supabase.
// Supabase will only ever store the ciphertext.
const SECRET_KEY = 'SHADOWTALK_MASTER_SHARED_KEY_2026';

export const encryptMessage = (text) => {
  if (!text) return '';
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

export const decryptMessage = (ciphertext) => {
  if (!ciphertext) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || ''; // Returns empty string if decryption fails
  } catch (error) {
    console.error('Decryption failed', error);
    return '';
  }
};
