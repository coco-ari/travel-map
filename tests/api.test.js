const assert = require('assert');
const http = require('http');
const { describe, it } = require('node:test');

const BASE = 'http://localhost:3000';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('GET /api/shops', () => {
  it('returns empty array when no shops', async () => {
    const res = await request('GET', '/api/shops');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, []);
  });

  it('returns shops after POST', async () => {
    const postRes = await request('POST', '/api/shops', {
      name: '测试店铺',
      lat: 39.9,
      lng: 116.4,
    });
    assert.strictEqual(postRes.status, 201);

    const getRes = await request('GET', '/api/shops');
    assert.strictEqual(getRes.status, 200);
    assert.ok(getRes.body.length > 0);
    assert.strictEqual(getRes.body[0].name, '测试店铺');
  });
});

describe('DELETE /api/shops/:id', () => {
  it('deletes a shop', async () => {
    const postRes = await request('POST', '/api/shops', {
      name: '待删除店铺',
      lat: 39.9,
      lng: 116.4,
    });
    const id = postRes.body.id;

    const delRes = await request('DELETE', `/api/shops/${id}`);
    assert.strictEqual(delRes.status, 200);

    const getRes = await request('GET', '/api/shops');
    const exists = getRes.body.some((s) => s.id === id);
    assert.strictEqual(exists, false);
  });
});

describe('PATCH /api/shops/:id/status', () => {
  it('updates shop status to visited', async () => {
    const postRes = await request('POST', '/api/shops', {
      name: '状态测试',
      lat: 39.9,
      lng: 116.4,
    });
    const id = postRes.body.id;

    const patchRes = await request('PATCH', `/api/shops/${id}/status`, {
      status: 'visited',
    });
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.body.status, 'visited');
  });
});
