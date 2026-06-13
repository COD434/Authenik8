import assert from "node:assert/strict";
import request from "supertest";
import app, {appReady} from "../script";

describe("API security and robustness", function () {
  this.timeout(30000);

  before(async () => {
    await appReady;
  });

  it("exposes health and Prometheus telemetry", async () => {
    const health = await request(app).get("/health");
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, {status: "ok"});

    const metrics = await request(app).get("/metrics");
    assert.equal(metrics.status, 200);
    assert.match(metrics.headers["content-type"], /text\/plain/);
    assert.match(metrics.text, /login_requests_total/);
    assert.match(metrics.text, /error_events_total/);
  });

  it("sets defensive HTTP headers and hides framework details", async () => {
    const response = await request(app).get("/health");
    assert.equal(response.headers["x-powered-by"], undefined);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.ok(response.headers["content-security-policy-report-only"]);
  });

  it("rejects malformed and oversized JSON without exposing a stack", async () => {
    const malformed = await request(app)
      .post("/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.stack, undefined);

    const oversized = await request(app)
      .post("/login")
      .send({email: "a".repeat(70 * 1024), password: "x"});

    assert.equal(oversized.status, 413);
    assert.equal(oversized.body.error, "Request body too large");
  });

  it("does not allow JSON prototype-pollution payloads", async () => {
    const response = await request(app)
      .post("/fuzz-target")
      .set("Content-Type", "application/json")
      .send('{"__proto__":{"polluted":true},"email":"invalid","password":"x"}');

    assert.ok(response.status < 500);
    assert.equal(({} as {polluted?: boolean}).polluted, undefined);
  });

  it("survives hostile and randomized request payloads without 5xx responses", async () => {
    const hostileValues: unknown[] = [
      null,
      true,
      0,
      [],
      {},
      "' OR 1=1 --",
      "<script>alert(1)</script>",
      "../../etc/passwd",
      "\u0000\r\nX-Injected: true",
      "A".repeat(4096)
    ];

    let seed = 0x5eed1234;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    for (let index = 0; index < 30; index += 1) {
      const value = hostileValues[Math.floor(random() * hostileValues.length)];
      const payload = {
        email: value,
        password: hostileValues[Math.floor(random() * hostileValues.length)],
        username: hostileValues[Math.floor(random() * hostileValues.length)]
      };
      const response = await request(app).post("/fuzz-target").send(payload);
      assert.ok(response.status < 500, `payload ${index} returned ${response.status}`);
    }
  });

  it("returns a stable JSON 404 for unknown routes", async () => {
    const response = await request(app).get("/does-not-exist%0A");
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {error: "Route not found"});
  });
});
