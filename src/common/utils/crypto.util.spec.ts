import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import { encryptToken, decryptToken } from './crypto.util';

describe('crypto.util', () => {
  const secretKey = '12345678901234567890123456789012';
  const plainToken = 'ghp_samplegithubtoken1234567890abcdef';

  it('should encrypt and decrypt using AES-256-GCM', () => {
    const encrypted = encryptToken(plainToken, secretKey);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:encrypted

    const decrypted = decryptToken(encrypted, secretKey);
    expect(decrypted).toBe(plainToken);
  });

  it('should decrypt legacy AES-256-CBC format for backward compatibility', () => {
    // Generate legacy 2-part format (iv:encrypted)
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(secretKey, 'utf8').subarray(0, 32),
      iv,
    );
    let legacyEncrypted = cipher.update(plainToken);
    legacyEncrypted = Buffer.concat([legacyEncrypted, cipher.final()]);
    const legacyPayload = `${iv.toString('hex')}:${legacyEncrypted.toString('hex')}`;

    expect(legacyPayload.split(':').length).toBe(2);

    const decrypted = decryptToken(legacyPayload, secretKey);
    expect(decrypted).toBe(plainToken);
  });

  it('should throw error on invalid token format', () => {
    expect(() => decryptToken('invalid-token-string', secretKey)).toThrow(
      'Formato de token cifrado inválido',
    );
  });

  it('debe fallar al intentar descifrar si el authTag fue manipulado (autenticación AES-256-GCM)', () => {
    const encrypted = encryptToken(plainToken, secretKey);
    const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');

    // Manipular el authTag alterando un carácter hex
    const tamperedTag = authTagHex.startsWith('a') ? 'b' + authTagHex.slice(1) : 'a' + authTagHex.slice(1);
    const tamperedPayload = `${ivHex}:${tamperedTag}:${encryptedHex}`;

    expect(() => decryptToken(tamperedPayload, secretKey)).toThrow();
  });
});
