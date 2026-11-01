import * as crypto from 'crypto';

export interface UserKeyPairBundle {
  signing: { publicKey: string; privateKey: string };
  exchange: { publicKey: string; privateKey: string };
}

export class E2EEUtil {
  /** Generates a complete Ed25519 (signing) + X25519 (encryption) key pair bundle (base64 DER). */
  static generateUserKeys(): UserKeyPairBundle {
    const ed = crypto.generateKeyPairSync('ed25519');
    const x = crypto.generateKeyPairSync('x25519');
    return {
      signing: {
        publicKey: ed.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
        privateKey: ed.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
      },
      exchange: {
        publicKey: x.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
        privateKey: x.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
      },
    };
  }

  /**
   * Encrypts plaintext using X25519 ECDH + AES-256-GCM (chro.md §2.3, security.md §6).
   * Sender generates ephemeral X25519 keypair, derives shared secret with recipient's X25519 key,
   * derives AES-256 key via HKDF, and encrypts with AES-256-GCM.
   */
  static encrypt(plaintext: string, recipientX25519PublicKeyBase64: string): string {
    const ephemeral = crypto.generateKeyPairSync('x25519');
    const recipientKey = crypto.createPublicKey({
      key: Buffer.from(recipientX25519PublicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const sharedSecret = crypto.diffieHellman({
      privateKey: ephemeral.privateKey,
      publicKey: recipientKey,
    });
    const aesKey = crypto.hkdfSync('sha256', sharedSecret, Buffer.alloc(0), Buffer.from('pfx-notice-e2ee'), 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(aesKey), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const envelope = {
      alg: 'X25519-AES256GCM',
      ephemPk: ephemeral.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
    };
    return Buffer.from(JSON.stringify(envelope)).toString('base64');
  }

  /** Decrypts AES-256-GCM envelope using recipient's X25519 private key. */
  static decrypt(envelopeBase64: string, recipientX25519PrivateKeyBase64: string): string {
    let envelope: { alg?: string; ephemPk: string; iv: string; tag: string; data: string };
    try {
      const decoded = Buffer.from(envelopeBase64, 'base64').toString('utf8');
      envelope = JSON.parse(decoded);
    } catch {
      // Fallback if not an envelope: return as raw decoded string
      return Buffer.from(envelopeBase64, 'base64').toString('utf8');
    }

    if (!envelope.ephemPk || !envelope.iv || !envelope.tag || !envelope.data) {
      return Buffer.from(envelopeBase64, 'base64').toString('utf8');
    }

    const ephemKey = crypto.createPublicKey({
      key: Buffer.from(envelope.ephemPk, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const recipientKey = crypto.createPrivateKey({
      key: Buffer.from(recipientX25519PrivateKeyBase64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    const sharedSecret = crypto.diffieHellman({
      privateKey: recipientKey,
      publicKey: ephemKey,
    });
    const aesKey = crypto.hkdfSync('sha256', sharedSecret, Buffer.alloc(0), Buffer.from('pfx-notice-e2ee'), 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(aesKey), Buffer.from(envelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /** Signs a message string using Ed25519 private key (returns base64 signature). */
  static sign(message: string, ed25519PrivateKeyBase64: string): string {
    const privKey = crypto.createPrivateKey({
      key: Buffer.from(ed25519PrivateKeyBase64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    return crypto.sign(null, Buffer.from(message, 'utf8'), privKey).toString('base64');
  }

  /** Verifies an Ed25519 signature against message string and public key. */
  static verifySignature(message: string, signatureBase64: string, ed25519PublicKeyBase64: string): boolean {
    try {
      const pubKey = crypto.createPublicKey({
        key: Buffer.from(ed25519PublicKeyBase64, 'base64'),
        format: 'der',
        type: 'spki',
      });
      return crypto.verify(null, Buffer.from(message, 'utf8'), pubKey, Buffer.from(signatureBase64, 'base64'));
    } catch {
      return false;
    }
  }
}

