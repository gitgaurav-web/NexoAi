import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../server/middleware/rateLimit.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    }
  };
  return res;
}

describe('createRateLimiter Middleware', () => {
  test('allows requests within the configured limit and sets rate limit headers', () => {
    const limiter = createRateLimiter({ windowMs: 10000, max: 5 });
    const req = { ip: '192.168.1.10', socket: { remoteAddress: '192.168.1.10' } };
    const res = createMockRes();
    let nextCalled = false;

    limiter(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['RateLimit-Limit'], 5);
    assert.equal(res.headers['RateLimit-Remaining'], 4);
    assert.equal(res.headers['X-RateLimit-Limit'], 5);
    assert.equal(res.headers['X-RateLimit-Remaining'], 4);
  });

  test('blocks requests that exceed the limit with 429 Too Many Requests', () => {
    const limiter = createRateLimiter({ windowMs: 10000, max: 2 });
    const req = { ip: '10.0.0.5', socket: { remoteAddress: '10.0.0.5' } };

    // Request 1: allowed
    let res1 = createMockRes();
    let next1 = false;
    limiter(req, res1, () => { next1 = true; });
    assert.equal(next1, true);

    // Request 2: allowed
    let res2 = createMockRes();
    let next2 = false;
    limiter(req, res2, () => { next2 = true; });
    assert.equal(next2, true);

    // Request 3: blocked
    let res3 = createMockRes();
    let next3 = false;
    limiter(req, res3, () => { next3 = true; });

    assert.equal(next3, false);
    assert.equal(res3.statusCode, 429);
    assert.match(res3.body.error, /Too many requests/);
    assert.ok(res3.headers['Retry-After']);
  });

  test('tracks different client IPs independently', () => {
    const limiter = createRateLimiter({ windowMs: 10000, max: 1 });
    const reqA = { ip: '1.1.1.1', socket: { remoteAddress: '1.1.1.1' } };
    const reqB = { ip: '2.2.2.2', socket: { remoteAddress: '2.2.2.2' } };

    // IP A request 1 (allowed)
    let resA1 = createMockRes();
    let nextA1 = false;
    limiter(reqA, resA1, () => { nextA1 = true; });
    assert.equal(nextA1, true);

    // IP A request 2 (blocked)
    let resA2 = createMockRes();
    let nextA2 = false;
    limiter(reqA, resA2, () => { nextA2 = true; });
    assert.equal(nextA2, false);
    assert.equal(resA2.statusCode, 429);

    // IP B request 1 (allowed - independent IP)
    let resB1 = createMockRes();
    let nextB1 = false;
    limiter(reqB, resB1, () => { nextB1 = true; });
    assert.equal(nextB1, true);
    assert.equal(resB1.statusCode, 200);
  });
});
