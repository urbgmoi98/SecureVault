jest.mock('../config/env', () => ({
  ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
  ENCRYPTION_KEY_VERSION: 'test',
  PREVIOUS_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString('base64'),
  PREVIOUS_ENCRYPTION_KEY_VERSION: 'previous-test'
}));

const { encrypt, decrypt } = require('../crypto/cipher');
const { hashPassword, verifyPassword } = require('../crypto/password');

function encryptWithKey(text, aad, key, version) {
  const iv = Buffer.alloc(12, 9);
  const cipher = require('node:crypto').createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${version}:${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

function alterEncryptedPart(encrypted, partIndex) {
  const [version, payload] = encrypted.split(':');
  const parts = payload.split('.');
  const bytes = Buffer.from(parts[partIndex], 'base64');
  bytes[0] ^= 1;
  parts[partIndex] = bytes.toString('base64');
  return `${version}:${parts.join('.')}`;
}

describe('cryptography', () => {
  test('uses a fresh IV and produces different ciphertext for identical plaintext', () => {
    const first = encrypt('same plaintext', 'same associated data').split(':')[1].split('.');
    const second = encrypt('same plaintext', 'same associated data').split(':')[1].split('.');

    expect(first[0]).not.toBe(second[0]);
    expect(first[2]).not.toBe(second[2]);
  });

  test('rejects a modified authentication tag', () => {
    const encrypted = encrypt('authenticated content', 'note-aad');
    expect(() => decrypt(alterEncryptedPart(encrypted, 1), 'note-aad')).toThrow('CRYPTO_AUTH_FAILED');
  });

  test('rejects modified ciphertext', () => {
    const encrypted = encrypt('authenticated content', 'note-aad');
    expect(() => decrypt(alterEncryptedPart(encrypted, 2), 'note-aad')).toThrow('CRYPTO_AUTH_FAILED');
  });

  test('decrypts with the configured previous key version', () => {
    const previousKey = Buffer.alloc(32, 4);
    const encrypted = encryptWithKey('legacy note', 'note-aad', previousKey, 'previous-test');

    expect(decrypt(encrypted, 'note-aad')).toBe('legacy note');
  });

  test('supports empty plaintext and rejects unknown key versions', () => {
    const encrypted = encrypt('', 'note-aad');

    expect(decrypt(encrypted, 'note-aad')).toBe('');
    expect(() => decrypt(encrypted.replace('test:', 'unknown:'), 'note-aad')).toThrow('CRYPTO_AUTH_FAILED');
  });

  test('hashes passwords with bcrypt cost 12', async () => {
    const password = 'Long-Test-Passphrase-123';
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).toMatch(/^\$2b\$12\$/);
    expect(secondHash).not.toBe(firstHash);
    await expect(verifyPassword(password, firstHash)).resolves.toBe(true);
    await expect(hashPassword('é'.repeat(37))).rejects.toThrow('PASSWORD_TOO_LONG');
  });
});
