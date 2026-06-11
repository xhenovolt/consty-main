/**
 * Encryption Utility for External Connection Credentials
 * 
 * Encrypts/decrypts API keys and secrets using AES-256-GCM
 * 
 * SECURITY NOTES:
 * - Uses Node.js crypto module (AES-256-GCM)
 * - Master key from ENCRYPTION_KEY environment variable (32 bytes)
 * - Each encryption uses a unique IV (initialization vector)
 * - IV is prepended to ciphertext and extracted during decryption
 * - Never logs sensitive data
 */

import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment
 * Must be 32 bytes (256 bits)
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable not set');
  }
  
  // If key is hex string, convert it. Otherwise use as-is (base64)
  let keyBuffer;
  
  try {
    if (key.match(/^[0-9a-f]{64}$/i)) {
      // Hex string
      keyBuffer = Buffer.from(key, 'hex');
    } else {
      // Assume base64
      keyBuffer = Buffer.from(key, 'base64');
    }
  } catch (err) {
    throw new Error('Invalid ENCRYPTION_KEY format (must be hex or base64)');
  }
  
  if (keyBuffer.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be 32 bytes (256 bits), got ${keyBuffer.length} bytes`);
  }
  
  return keyBuffer;
}

/**
 * Encrypt a secret value
 * Returns encrypted format: iv + authTag + ciphertext (all hex encoded)
 */
export function encryptSecret(plaintext) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv + authTag + ciphertext (all hex, concatenated)
    const combined = iv.toString('hex') + authTag.toString('hex') + encrypted;
    
    return combined;
  } catch (error) {
    console.error('[Encryption] Encrypt error:', error.message);
    throw new Error('Failed to encrypt credential');
  }
}

/**
 * Decrypt a secret value
 * Expects format: iv + authTag + ciphertext (all hex encoded)
 */
export function decryptSecret(encrypted) {
  try {
    const key = getEncryptionKey();
    
    // Parse the combined format
    const ivHex = encrypted.substring(0, IV_LENGTH * 2);           // 32 chars (16 bytes in hex)
    const authTagHex = encrypted.substring(IV_LENGTH * 2, IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2);  // 32 chars
    const ciphertextHex = encrypted.substring(IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2); // Rest
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[Encryption] Decrypt error:', error.message);
    throw new Error('Failed to decrypt credential');
  }
}

/**
 * Mask a credential for display
 * Shows first 4 and last 4 characters, masks the rest
 */
export function maskCredential(value, showChars = 4) {
  if (!value || value.length <= showChars * 2) {
    return '****';
  }
  
  const start = value.substring(0, showChars);
  const end = value.substring(value.length - showChars);
  const masked = '*'.repeat(Math.max(4, value.length - showChars * 2));
  
  return `${start}${masked}${end}`;
}

/**
 * Generate a secure encryption key (32 bytes for AES-256)
 * Use this to create initial ENCRYPTION_KEY for environment
 */
export function generateEncryptionKey() {
  const key = crypto.randomBytes(32);
  return key.toString('hex');
}

/**
 * Verify encryption key validity
 */
export function isEncryptionKeyValid() {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

export default {
  encryptSecret,
  decryptSecret,
  maskCredential,
  generateEncryptionKey,
  isEncryptionKeyValid,
};
