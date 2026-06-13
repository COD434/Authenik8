"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const supertest_1 = __importDefault(require("supertest"));
const script_1 = __importStar(require("../script"));
describe("API security and robustness", function () {
    this.timeout(30000);
    before(async () => {
        await script_1.appReady;
    });
    it("exposes health and Prometheus telemetry", async () => {
        const health = await (0, supertest_1.default)(script_1.default).get("/health");
        strict_1.default.equal(health.status, 200);
        strict_1.default.deepEqual(health.body, { status: "ok" });
        const metrics = await (0, supertest_1.default)(script_1.default).get("/metrics");
        strict_1.default.equal(metrics.status, 200);
        strict_1.default.match(metrics.headers["content-type"], /text\/plain/);
        strict_1.default.match(metrics.text, /login_requests_total/);
        strict_1.default.match(metrics.text, /error_events_total/);
    });
    it("sets defensive HTTP headers and hides framework details", async () => {
        const response = await (0, supertest_1.default)(script_1.default).get("/health");
        strict_1.default.equal(response.headers["x-powered-by"], undefined);
        strict_1.default.equal(response.headers["x-content-type-options"], "nosniff");
        strict_1.default.equal(response.headers["x-frame-options"], "DENY");
        strict_1.default.ok(response.headers["content-security-policy-report-only"]);
    });
    it("rejects malformed and oversized JSON without exposing a stack", async () => {
        const malformed = await (0, supertest_1.default)(script_1.default)
            .post("/login")
            .set("Content-Type", "application/json")
            .send('{"email":');
        strict_1.default.equal(malformed.status, 400);
        strict_1.default.equal(malformed.body.stack, undefined);
        const oversized = await (0, supertest_1.default)(script_1.default)
            .post("/login")
            .send({ email: "a".repeat(70 * 1024), password: "x" });
        strict_1.default.equal(oversized.status, 413);
        strict_1.default.equal(oversized.body.error, "Request body too large");
    });
    it("does not allow JSON prototype-pollution payloads", async () => {
        const response = await (0, supertest_1.default)(script_1.default)
            .post("/fuzz-target")
            .set("Content-Type", "application/json")
            .send('{"__proto__":{"polluted":true},"email":"invalid","password":"x"}');
        strict_1.default.ok(response.status < 500);
        strict_1.default.equal({}.polluted, undefined);
    });
    it("survives hostile and randomized request payloads without 5xx responses", async () => {
        const hostileValues = [
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
            const response = await (0, supertest_1.default)(script_1.default).post("/fuzz-target").send(payload);
            strict_1.default.ok(response.status < 500, `payload ${index} returned ${response.status}`);
        }
    });
    it("returns a stable JSON 404 for unknown routes", async () => {
        const response = await (0, supertest_1.default)(script_1.default).get("/does-not-exist%0A");
        strict_1.default.equal(response.status, 404);
        strict_1.default.deepEqual(response.body, { error: "Route not found" });
    });
});
