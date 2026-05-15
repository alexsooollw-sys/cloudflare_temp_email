import { test, expect } from '@playwright/test';
import { WORKER_URL, TEST_DOMAIN, hashPassword, seedTestMail } from '../../fixtures/test-helpers';

const setTempmailAllowedDomains = async (request: any, domains: string[]) => {
  const res = await request.post(`${WORKER_URL}/admin/system/settings`, {
    data: {
      key: 'tempmail.allowed_domains',
      value: domains,
      category: 'tempmail',
      encrypted: false,
    },
  });
  if (!res.ok()) throw new Error(`set allowed_domains failed: ${res.status()} ${await res.text()}`);
};

const clearTempmailSetting = async (request: any) => {
  await request.delete(`${WORKER_URL}/admin/system/settings/tempmail.allowed_domains`);
};

test.describe('Tempmail (public_api/v1) lifecycle', () => {
  test.beforeAll(async ({ request }) => {
    await setTempmailAllowedDomains(request, [TEST_DOMAIN]);
  });

  test.afterAll(async ({ request }) => {
    await clearTempmailSetting(request);
  });

  test('domains endpoint exposes the configured allowlist', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/public_api/v1/domains`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.domains)).toBe(true);
    const names = body.domains.map((d: { domain: string }) => d.domain);
    expect(names).toContain(TEST_DOMAIN);
  });

  test('domain not in allowlist is rejected on /accounts', async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/public_api/v1/accounts`, {
      data: {
        address: `denied${Date.now()}@not-allowed.example`,
        password: hashPassword('hunter2'),
      },
    });
    expect(res.status()).toBe(400);
  });

  test('full create → login → receive → read → delete-account flow', async ({ request }) => {
    const username = `tm-flow-${Date.now()}`;
    const address = `${username}@${TEST_DOMAIN}`;
    const password = 'hunter2-tempmail';
    const passwordHash = hashPassword(password);

    // 1) create
    const createRes = await request.post(`${WORKER_URL}/public_api/v1/accounts`, {
      data: { address, password: passwordHash },
    });
    expect(createRes.ok()).toBe(true);
    const created = await createRes.json();
    expect(created.address).toBe(address);
    expect(created.token).toBeTruthy();
    expect(created.expires_at).toBeTruthy();
    const token1 = created.token as string;

    // 2) /me works on freshly issued token
    const meRes = await request.get(`${WORKER_URL}/public_api/v1/me`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    expect(meRes.ok()).toBe(true);
    const me = await meRes.json();
    expect(me.address).toBe(address);
    expect(me.id).toBe(created.id);

    // 3) login on the same address yields a fresh token
    const loginRes = await request.post(`${WORKER_URL}/public_api/v1/token`, {
      data: { address, password: passwordHash },
    });
    expect(loginRes.ok()).toBe(true);
    const login = await loginRes.json();
    expect(login.address).toBe(address);
    const token2 = login.token as string;

    // 4) wrong password is rejected
    const badLogin = await request.post(`${WORKER_URL}/public_api/v1/token`, {
      data: { address, password: hashPassword('wrong') },
    });
    expect(badLogin.status()).toBe(401);

    // 5) seed an email through the worker email() handler
    await seedTestMail(request, address, {
      subject: 'Tempmail E2E hello',
      text: 'hello tempmail',
      from: 'sender@example.com',
    });

    // 6) inbox lists the message, parsed
    const listRes = await request.get(`${WORKER_URL}/public_api/v1/me/messages?limit=10&page=1`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(listRes.ok()).toBe(true);
    const list = await listRes.json();
    expect(list.total).toBeGreaterThanOrEqual(1);
    expect(list.messages.length).toBeGreaterThanOrEqual(1);
    const messageId = list.messages[0].id;
    expect(list.messages[0].subject).toBe('Tempmail E2E hello');
    expect(list.messages[0].sender).toContain('sender@example.com');

    // 7) get parsed single message
    const oneRes = await request.get(`${WORKER_URL}/public_api/v1/me/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(oneRes.ok()).toBe(true);
    const one = await oneRes.json();
    expect(one.text).toContain('hello tempmail');

    // 8) raw RFC822 source
    const sourceRes = await request.get(`${WORKER_URL}/public_api/v1/me/messages/${messageId}/source`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(sourceRes.ok()).toBe(true);
    expect((sourceRes.headers()['content-type'] || '').toLowerCase()).toContain('message/rfc822');
    expect(await sourceRes.text()).toContain('Subject: Tempmail E2E hello');

    // 9) delete message
    const delMsg = await request.delete(`${WORKER_URL}/public_api/v1/me/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(delMsg.ok()).toBe(true);

    // 10) delete account → /me now 401/404
    const delMe = await request.delete(`${WORKER_URL}/public_api/v1/me`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(delMe.ok()).toBe(true);

    const meAfter = await request.get(`${WORKER_URL}/public_api/v1/me`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(meAfter.ok()).toBe(false);
  });

  test('tempmail bearer token cannot read non-tempmail address mail', async ({ request }) => {
    // 1) create tempmail account
    const tempAddress = `tm-cross-${Date.now()}@${TEST_DOMAIN}`;
    const createRes = await request.post(`${WORKER_URL}/public_api/v1/accounts`, {
      data: { address: tempAddress, password: hashPassword('cross-test') },
    });
    expect(createRes.ok()).toBe(true);
    const { token } = await createRes.json();

    // 2) /me/messages must only return rows belonging to the tempmail account.
    //    Seed a message to a *different* tempmail account and ensure ours
    //    does not see it.
    const otherAddress = `tm-cross-other-${Date.now()}@${TEST_DOMAIN}`;
    await request.post(`${WORKER_URL}/public_api/v1/accounts`, {
      data: { address: otherAddress, password: hashPassword('cross-test-2') },
    });
    await seedTestMail(request, otherAddress, { subject: 'leak?', text: 'should not be visible' });

    const listRes = await request.get(`${WORKER_URL}/public_api/v1/me/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBe(true);
    const list = await listRes.json();
    for (const m of list.messages) {
      expect(m.subject).not.toBe('leak?');
    }
  });
});
