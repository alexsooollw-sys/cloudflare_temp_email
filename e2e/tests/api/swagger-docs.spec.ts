import { test, expect } from '@playwright/test';
import { WORKER_URL } from '../../fixtures/test-helpers';

test.describe('Public API documentation', () => {
  test('/public_api/openapi.json returns a valid OpenAPI 3.1 document', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/public_api/openapi.json`);
    expect(res.ok()).toBe(true);
    const spec = await res.json();
    expect(spec.openapi).toMatch(/^3\.1/);
    expect(spec.info?.title).toContain('Public API');
    expect(typeof spec.paths).toBe('object');

    // sample a few of the documented routes
    expect(spec.paths['/public_api/v1/domains']?.get).toBeTruthy();
    expect(spec.paths['/public_api/v1/accounts']?.post).toBeTruthy();
    expect(spec.paths['/public_api/v1/token']?.post).toBeTruthy();
    expect(spec.paths['/public_api/v1/me']?.get).toBeTruthy();
    expect(spec.paths['/public_api/v1/me']?.delete).toBeTruthy();
    expect(spec.paths['/public_api/v1/me/messages']?.get).toBeTruthy();
    expect(spec.paths['/public_api/v1/me/messages/{id}']?.get).toBeTruthy();
    expect(spec.paths['/public_api/v1/me/messages/{id}/source']?.get).toBeTruthy();
    expect(spec.paths['/public_api/v1/public/recent_messages']?.get).toBeTruthy();

    // bearer scheme registered
    expect(spec.components?.securitySchemes?.bearerAuth?.scheme).toBe('bearer');
  });

  test('/public_api/docs serves a Swagger UI HTML page', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/public_api/docs`);
    expect(res.ok()).toBe(true);
    expect((res.headers()['content-type'] || '').toLowerCase()).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('SwaggerUIBundle');
    expect(html).toContain('/public_api/openapi.json');
  });
});
