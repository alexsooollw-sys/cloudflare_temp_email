import { test, expect } from '@playwright/test';
import { createHmac, randomBytes } from 'crypto';
import { WORKER_URL, hashPassword } from '../../fixtures/test-helpers';

// Reproducing the worker's RFC 6238 helper so tests can compute the same
// 6-digit code from the same secret. Verified locally against RFC 6238
// Appendix B vectors before commit (alongside worker/src/auth/totp.ts).
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Decode = (input: string): Buffer => {
  const cleaned = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`bad base32: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const totpCode = (secretBase32: string, period = 30, t: number = Math.floor(Date.now() / 1000)): string => {
  const counter = Math.floor(t / period);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const trunc =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (trunc % 10 ** 6).toString().padStart(6, '0');
};

test.describe('Admin login + 2FA + audit log', () => {
  test('admin_login (env-var fallback) succeeds, then 2FA setup/confirm/disable', async ({ request }) => {
    // Stage 3 ensureBootstrapAdmin() runs on admin_login. After this call
    // an `admin_accounts` row should exist for username=admin.
    const adminPassword = 'e2e-admin-pass';
    const loginRes = await request.post(`${WORKER_URL}/open_api/admin_login`, {
      data: { username: 'admin', password: hashPassword(adminPassword) },
    });
    expect(loginRes.ok()).toBe(true);

    // /admin/2fa/status reports disabled by default. The worker permits
    // env-var-authed admins via x-admin-auth header (DISABLE_ADMIN_PASSWORD_CHECK
    // also active in e2e config); use the env-var path to drive the rest.
    const adminHeaders = { 'x-admin-auth': adminPassword };
    const statusRes = await request.get(`${WORKER_URL}/admin/2fa/status`, { headers: adminHeaders });
    expect(statusRes.ok()).toBe(true);
    const status = await statusRes.json();
    expect(status.username).toBe('admin');
    expect(status.enabled).toBe(false);

    // Setup returns a fresh secret + otpauth url
    const setupRes = await request.post(`${WORKER_URL}/admin/2fa/setup`, { headers: adminHeaders });
    expect(setupRes.ok()).toBe(true);
    const setup = await setupRes.json();
    expect(typeof setup.secret).toBe('string');
    expect(setup.secret.length).toBeGreaterThan(15);
    expect(setup.otpauth).toMatch(/^otpauth:\/\/totp\//);

    // Confirm with a wrong code → 401
    const badConfirm = await request.post(`${WORKER_URL}/admin/2fa/confirm`, {
      headers: adminHeaders,
      data: { secret: setup.secret, code: '000000' },
    });
    expect(badConfirm.status()).toBe(401);

    // Confirm with the correct code → enabled
    const code = totpCode(setup.secret);
    const okConfirm = await request.post(`${WORKER_URL}/admin/2fa/confirm`, {
      headers: adminHeaders,
      data: { secret: setup.secret, code },
    });
    expect(okConfirm.ok()).toBe(true);

    const status2 = await (await request.get(`${WORKER_URL}/admin/2fa/status`, { headers: adminHeaders })).json();
    expect(status2.enabled).toBe(true);

    // /open_api/admin_login now returns require_totp + challenge
    const challengeRes = await request.post(`${WORKER_URL}/open_api/admin_login`, {
      data: { username: 'admin', password: hashPassword(adminPassword) },
    });
    expect(challengeRes.ok()).toBe(true);
    const challenge = await challengeRes.json();
    expect(challenge.require_totp).toBe(true);
    expect(challenge.challenge).toBeTruthy();

    // /open_api/admin_login_totp completes login
    const totpLogin = await request.post(`${WORKER_URL}/open_api/admin_login_totp`, {
      data: { challenge: challenge.challenge, code: totpCode(setup.secret) },
    });
    expect(totpLogin.ok()).toBe(true);
    const totpBody = await totpLogin.json();
    expect(totpBody.session).toBeTruthy();

    // The session JWT is admittable via x-admin-session header
    const adminViaSession = await request.get(`${WORKER_URL}/admin/2fa/status`, {
      headers: { 'x-admin-session': totpBody.session },
    });
    expect(adminViaSession.ok()).toBe(true);

    // Disable 2FA — wrong code is rejected
    const badDisable = await request.post(`${WORKER_URL}/admin/2fa/disable`, {
      headers: adminHeaders,
      data: { code: '000000' },
    });
    expect(badDisable.status()).toBe(401);

    const okDisable = await request.post(`${WORKER_URL}/admin/2fa/disable`, {
      headers: adminHeaders,
      data: { code: totpCode(setup.secret) },
    });
    expect(okDisable.ok()).toBe(true);

    const status3 = await (await request.get(`${WORKER_URL}/admin/2fa/status`, { headers: adminHeaders })).json();
    expect(status3.enabled).toBe(false);
  });

  test('audit log surfaces admin login attempts', async ({ request }) => {
    const adminHeaders = { 'x-admin-auth': 'e2e-admin-pass' };
    // Trigger one bad login to ensure we have at least one failure row
    await request.post(`${WORKER_URL}/open_api/admin_login`, {
      data: { username: `intruder-${randomBytes(4).toString('hex')}`, password: hashPassword('wrong') },
    });

    const res = await request.get(`${WORKER_URL}/admin/audit_log?limit=20`, { headers: adminHeaders });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
    // every row must have the required core columns
    for (const row of body.results) {
      expect(typeof row.id).toBe('number');
      expect(typeof row.action).toBe('string');
      expect(typeof row.created_at).toBe('string');
    }
  });
});
