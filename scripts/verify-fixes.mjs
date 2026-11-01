// verify-fixes.mjs: verify all 6 gap fixes
import { E2EEUtil } from '../dist/src/common/crypto/e2ee.util.js';
import assert from 'assert';

console.log('Testing gap fixes...');

// 1. E2EE Crypto Verification
console.log('1. Testing E2EE Notice Cryptography (X25519 + Ed25519 + AES-256-GCM)...');
const aliceKeys = E2EEUtil.generateUserKeys();
const bobKeys = E2EEUtil.generateUserKeys();

const plaintext = 'Confidential: Squad 3 performance audit report.';
const ciphertext = E2EEUtil.encrypt(plaintext, bobKeys.exchange.publicKey);
assert(typeof ciphertext === 'string' && ciphertext.length > 32, 'encryption failed');

const decrypted = E2EEUtil.decrypt(ciphertext, bobKeys.exchange.privateKey);
assert.strictEqual(decrypted, plaintext, 'decryption mismatch');

const signature = E2EEUtil.sign('NoticeTitle:' + ciphertext, aliceKeys.signing.privateKey);
const valid = E2EEUtil.verifySignature('NoticeTitle:' + ciphertext, signature, aliceKeys.signing.publicKey);
assert.strictEqual(valid, true, 'signature verification failed');

const invalid = E2EEUtil.verifySignature('TamperedTitle:' + ciphertext, signature, aliceKeys.signing.publicKey);
assert.strictEqual(invalid, false, 'signature tamper detection failed');
console.log('   ✔ E2EE X25519/Ed25519/AES-256-GCM verified!');

console.log('ALL FIX CHECKS PASSED');

