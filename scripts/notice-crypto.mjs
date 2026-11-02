import { createCipheriv, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, sign } from 'node:crypto';

const b64 = (value) => Buffer.from(value).toString('base64');

export function createNoticeKeys() {
  const signing = generateKeyPairSync('ed25519');
  const exchange = generateKeyPairSync('x25519');
  return {
    publicKey: {
      ed25519: b64(signing.publicKey.export({ type: 'spki', format: 'der' })),
      x25519: b64(exchange.publicKey.export({ type: 'spki', format: 'der' })),
    },
    signingPrivateKey: signing.privateKey,
  };
}

export function encryptNotice(plaintext, recipientPublicKey) {
  const recipient = JSON.parse(recipientPublicKey);
  const recipientKey = requirePublicKey(recipient.x25519);
  const ephemeral = generateKeyPairSync('x25519');
  const secret = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipientKey });
  const key = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), Buffer.from('pfx-notice-e2ee'), 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  const envelope = {
    alg: 'X25519-AES256GCM',
    ephemPk: b64(ephemeral.publicKey.export({ type: 'spki', format: 'der' })),
    iv: b64(iv),
    data: b64(ciphertext),
  };
  return b64(JSON.stringify(envelope));
}

export function signNotice(keys, message) {
  return sign(null, Buffer.from(message, 'utf8'), keys.signingPrivateKey).toString('base64');
}

function requirePublicKey(encoded) {
  return createPublicKey({ key: Buffer.from(encoded, 'base64'), format: 'der', type: 'spki' });
}
