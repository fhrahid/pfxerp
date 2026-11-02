import { api } from "./api";

type KeyBundle = { ed25519: string; x25519: string };
type LocalKeys = {
  publicKey: KeyBundle;
  signingPrivateKey: string;
  exchangePrivateKey: string;
};

const storageKey = (userId: string) => `pointfex-notice-keys:${userId}`;
const setupByUser = new Map<string, Promise<LocalKeys>>();
export const noticeSignatureMessage = (recipientId: string, title: string, category: string, encryptedContent: string) =>
  JSON.stringify([recipientId, title, category, encryptedContent]);
const toBase64 = (bytes: ArrayBuffer | Uint8Array) => {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < data.length; index++) binary += String.fromCharCode(data[index]);
  return btoa(binary);
};
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function getLocalKeys(userId: string): Promise<LocalKeys> {
  const cached = localStorage.getItem(storageKey(userId));
  if (cached) return JSON.parse(cached) as LocalKeys;

  const signing = await crypto.subtle.generateKey({ name: "Ed25519" } as any, true, ["sign", "verify"]) as CryptoKeyPair;
  const exchange = await crypto.subtle.generateKey({ name: "X25519" } as any, true, ["deriveBits"]) as CryptoKeyPair;
  const keys: LocalKeys = {
    publicKey: {
      ed25519: toBase64(await crypto.subtle.exportKey("spki", signing.publicKey)),
      x25519: toBase64(await crypto.subtle.exportKey("spki", exchange.publicKey)),
    },
    signingPrivateKey: toBase64(await crypto.subtle.exportKey("pkcs8", signing.privateKey)),
    exchangePrivateKey: toBase64(await crypto.subtle.exportKey("pkcs8", exchange.privateKey)),
  };
  localStorage.setItem(storageKey(userId), JSON.stringify(keys));
  return keys;
}

export async function ensureNoticeKeys(userId: string) {
  let setup = setupByUser.get(userId);
  if (!setup) {
    setup = (async () => {
      if (!localStorage.getItem(storageKey(userId))) {
        const current = await api<{ publicKey: string | null }>("GET", `/notices/keys/${userId}`);
        if (current.publicKey) {
          throw new Error("Notice keys already exist for another browser. Use the browser where you first set up secure notices.");
        }
      }
      const keys = await getLocalKeys(userId);
      await api("POST", "/notices/keys/register", { publicKey: JSON.stringify(keys.publicKey) });
      return keys;
    })();
    setupByUser.set(userId, setup);
  }
  try {
    return await setup;
  } finally {
    setupByUser.delete(userId);
  }
}

async function deriveAesKey(sharedSecret: ArrayBuffer) {
  const material = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: new TextEncoder().encode("pfx-notice-e2ee") } as any,
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptNotice(plaintext: string, publicBundle: string) {
  const recipient = JSON.parse(publicBundle) as KeyBundle;
  const recipientKey = await crypto.subtle.importKey("spki", fromBase64(recipient.x25519), { name: "X25519" } as any, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: "X25519" } as any, true, ["deriveBits"]) as CryptoKeyPair;
  const secret = await crypto.subtle.deriveBits({ name: "X25519", public: recipientKey } as any, ephemeral.privateKey, 256);
  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const envelope = {
    alg: "X25519-AES256GCM",
    ephemPk: toBase64(await crypto.subtle.exportKey("spki", ephemeral.publicKey)),
    iv: toBase64(iv),
    data: toBase64(ciphertext),
  };
  return toBase64(new TextEncoder().encode(JSON.stringify(envelope)));
}

export async function decryptNotice(userId: string, envelopeBase64: string) {
  const keys = await ensureNoticeKeys(userId);
  const envelope = JSON.parse(new TextDecoder().decode(fromBase64(envelopeBase64)));
  const privateKey = await crypto.subtle.importKey("pkcs8", fromBase64(keys.exchangePrivateKey), { name: "X25519" } as any, false, ["deriveBits"]);
  const ephemeralKey = await crypto.subtle.importKey("spki", fromBase64(envelope.ephemPk), { name: "X25519" } as any, false, []);
  const secret = await crypto.subtle.deriveBits({ name: "X25519", public: ephemeralKey } as any, privateKey, 256);
  const key = await deriveAesKey(secret);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.data));
  return new TextDecoder().decode(plaintext);
}

export async function signNotice(userId: string, message: string) {
  const keys = await ensureNoticeKeys(userId);
  const privateKey = await crypto.subtle.importKey("pkcs8", fromBase64(keys.signingPrivateKey), { name: "Ed25519" } as any, false, ["sign"]);
  return toBase64(await crypto.subtle.sign("Ed25519" as any, privateKey, new TextEncoder().encode(message)));
}
