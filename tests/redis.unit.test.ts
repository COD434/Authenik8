import assert from "node:assert/strict";
import {initializeRedisClient, resetRedisClient} from "../prisma/config/redis";

describe("test Redis adapter", () => {
  after(async () => {
    await resetRedisClient();
  });

  it("provides Redis behavior without a network service", async () => {
    const redis = await initializeRedisClient();

    await redis.set("session:user-1", "token", "EX", 60);
    await redis.hset("rate_limit:user-1", {
      tokens: "2",
      lastRefill: Date.now().toString()
    });

    assert.equal(await redis.get("session:user-1"), "token");
    assert.equal((await redis.keys("session:*")).length, 1);
    assert.equal((await redis.hgetall("rate_limit:user-1")).tokens, "2");
    assert.ok((await redis.ttl("session:user-1")) > 0);
  });
});
