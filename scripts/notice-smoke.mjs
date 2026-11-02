import { createNoticeKeys, encryptNotice, signNotice } from './notice-crypto.mjs';

const base = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const senderToken = process.env.CPO_TOKEN;
const recipientToken = process.env.NOTICE_RECIPIENT_TOKEN;
const recipientId = process.env.NOTICE_RECIPIENT_ID;
if (!senderToken || !recipientToken || !recipientId) {
  throw new Error('CPO_TOKEN, NOTICE_RECIPIENT_TOKEN, and NOTICE_RECIPIENT_ID are required');
}

async function api(token, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${payload?.error?.message || 'request failed'}`);
  return payload.data;
}

const senderKeys = createNoticeKeys();
const recipientKeys = createNoticeKeys();
await api(senderToken, 'POST', '/notices/keys/register', { publicKey: JSON.stringify(senderKeys.publicKey) });
await api(recipientToken, 'POST', '/notices/keys/register', { publicKey: JSON.stringify(recipientKeys.publicKey) });

const title = 'Disciplinary citation';
const category = 'DISCIPLINARY';
const encryptedContent = encryptNotice('Encrypted payload smoke test', JSON.stringify(recipientKeys.publicKey));
const signature = signNotice(senderKeys, JSON.stringify([recipientId, title, category, encryptedContent]));
const notice = await api(senderToken, 'POST', '/notices', { recipientId, title, category, encryptedContent, signature });
const acknowledgmentSignature = signNotice(recipientKeys, `ack:${notice.noticeId}`);
const acknowledgment = await api(recipientToken, 'POST', `/notices/${notice.noticeId}/acknowledge`, { acknowledgmentSignature });
console.log(`== notice dispatched and acknowledged: ${notice.noticeId} (${acknowledgment.status})`);
