"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const redis_1 = require("../prisma/config/redis");
describe("test Redis adapter", () => {
    after(async () => {
        await (0, redis_1.resetRedisClient)();
    });
    it("provides Redis behavior without a network service", async () => {
        const redis = await (0, redis_1.initializeRedisClient)();
        await redis.set("session:user-1", "token", "EX", 60);
        await redis.hset("rate_limit:user-1", {
            tokens: "2",
            lastRefill: Date.now().toString()
        });
        strict_1.default.equal(await redis.get("session:user-1"), "token");
        strict_1.default.equal((await redis.keys("session:*")).length, 1);
        strict_1.default.equal((await redis.hgetall("rate_limit:user-1")).tokens, "2");
        strict_1.default.ok((await redis.ttl("session:user-1")) > 0);
    });
});
