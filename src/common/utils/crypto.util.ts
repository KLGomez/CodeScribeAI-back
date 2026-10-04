import * as crypto from 'crypto';

const GCM_ALGORITHM = 'aes-256-gcm';
const CBC_ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts sensitive tokens using authenticated AES-256-GCM.
 * Output format: `${ivHex}:${authTagHex}:${encryptedHex}`
 */
export function encryptToken(text: string, key: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV recomendado para GCM
  const keyBuffer = Buffer.from(key, 'utf8').subarray(0, 32);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts tokens. Supports both modern AES-256-GCM (3 parts)
 * and legacy AES-256-CBC (2 parts) for backward compatibility.
 */
export function decryptToken(payload: string, key: string): string {
  const parts = payload.split(':');
  const keyBuffer = Buffer.from(key, 'utf8').subarray(0, 32);

  // Modern AES-256-GCM: iv:authTag:encrypted
  if (parts.length === 3) {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(GCM_ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  // Legacy AES-256-CBC: iv:encrypted
  if (parts.length === 2) {
    const [ivHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(CBC_ALGORITHM, keyBuffer, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  throw new Error('Formato de token cifrado inválido');
}
