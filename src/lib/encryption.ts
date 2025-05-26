import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-fallback-encryption-key-min-32-chars!!';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getKey(salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

export function decrypt(encryptedData: string): string {
  try {
    const buffer = Buffer.from(encryptedData, 'base64');

    // Ensure the buffer is large enough to contain all required components
    if (buffer.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1) {
      throw new Error('Invalid encrypted data format');
    }

    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = getKey(salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final('utf8');
  } catch (error) {
    // Only log detailed errors in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('Decryption failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    throw new Error('Failed to decrypt data. The encryption key may have changed.');
  }
}

// Safely attempt to decrypt, returning a default value if decryption fails
export function safeDecrypt(encryptedData: string, defaultValue: string = '[Decryption Failed]'): string {
  try {
    return decrypt(encryptedData);
  } catch (error) {
    // Don't log detailed errors for expected decryption failures
    // This keeps the console cleaner while still handling errors gracefully
    if (process.env.NODE_ENV === 'development') {
      console.log('Safe decryption handled a failure - possibly due to key change');
    }
    return defaultValue;
  }
}

/**
 * Attempt to re-encrypt data with the current key.
 * Useful for migrating data from an old encryption key to the new one.
 * 
 * @param encryptedData The data encrypted with the old key
 * @param oldKey The old encryption key
 * @returns The data re-encrypted with the current key, or null if decryption failed
 */
export function reencryptWithOldKey(encryptedData: string, oldKey: string): string | null {
  try {
    // Save the current encryption key
    const currentKey = ENCRYPTION_KEY;
    
    // Temporarily override the encryption key with the old one
    (global as any).TEMP_OLD_KEY = oldKey;
    Object.defineProperty(process.env, 'ENCRYPTION_KEY', {
      value: oldKey,
      configurable: true
    });
    
    // Try to decrypt with the old key
    let decrypted;
    try {
      decrypted = decrypt(encryptedData);
    } finally {
      // Restore the current key
      Object.defineProperty(process.env, 'ENCRYPTION_KEY', {
        value: currentKey,
        configurable: true
      });
      delete (global as any).TEMP_OLD_KEY;
    }
    
    // Re-encrypt with the current key
    return encrypt(decrypted);
  } catch (error) {
    // Failed to decrypt with the old key
    if (process.env.NODE_ENV === 'development') {
      console.debug('Re-encryption failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    return null;
  }
} 