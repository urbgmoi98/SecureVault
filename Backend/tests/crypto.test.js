jest.mock('../config/env', () => ({
  ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
  ENCRYPTION_KEY_VERSION: 'test'
}));

const { encrypt, decrypt } = require('../crypto/cipher');
const { hashPassword } = require('../crypto/password');

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

  test('hashes passwords with bcrypt cost 12', async () => {
    const passwordHash = await hashPassword('Long-Test-Passphrase-123');
    expect(passwordHash).toMatch(/^\$2b\$12\$/);
  });
});
