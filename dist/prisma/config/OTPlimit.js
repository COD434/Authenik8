"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginLimiterMiddleware = exports.OTPLimiterMiddleware = exports.initializeRateLimiter = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const redis_1 = require("./redis");
const monitor_1 = require("./Monitor/monitor");
dotenv_1.default.config();
class TokenBucket {
    constructor(redisClient) {
        this.redis = redisClient;
    }
    async consume(key, capacity, refillRate) {
        var _a, _b;
        const now = Date.now();
        const results = await this.redis
            .pipeline()
            .hgetall(`rate_limit:${key}`)
            .exec();
        const data = (_b = (_a = results === null || results === void 0 ? void 0 : results[0]) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : {};
        const bucket = data
            || {};
        const currentToken = parseFloat(bucket.tokens || capacity.toString());
        const lastRefill = parseFloat(bucket.lastRefill || now.toString());
        const timeElapsed = (now - lastRefill) / 1000;
        const newToken = Math.min(capacity, currentToken + (timeElapsed * refillRate));
        if (newToken < 1) {
            return {
                allowed: false,
                remaining: Math.floor(newToken),
                retryAfter: Math.ceil((1 - newToken) / refillRate)
            };
        }
        await this.redis.hset(`rate_limit:${key}`, {
            tokens: (newToken - 1).toString(),
            lastRefill: now.toString()
        });
        return { allowed: true, remaining: Math.floor(newToken - 1) };
    }
}
let tokenBucket;
const initializeRateLimiter = async () => {
    const redisClient = (await (0, redis_1.setupRedis)()).redisClient;
    tokenBucket = new TokenBucket(redisClient);
};
exports.initializeRateLimiter = initializeRateLimiter;
const createRatelimiter = (config) => {
    return async (req, res, next) => {
        const key = config.keyGenerator(req);
        const { allowed, remaining, retryAfter } = await tokenBucket.consume(key, config.capacity, config.refillRate);
        res.set(Object.assign({ "X-RateLimit-Limit": config.capacity.toString(), "X-RateLimit-Remaining": remaining.toString() }, (!allowed && { "Retry-After": (retryAfter === null || retryAfter === void 0 ? void 0 : retryAfter.toString()) || "1" })));
        if (allowed) {
            monitor_1.RatelimitAllowed.inc();
            return next();
        }
        else {
            monitor_1.RatelimitsBlocked.inc();
            res.status(429).json({
                error: `Too many requests`
            });
        }
        monitor_1.RatelimitsBlocked.inc();
    };
};
const RATE_LIMIT_CONFIGS = {
    OTP: {
        keyPrefix: "otp_limiter",
        refillRate: 0.1,
        capacity: 3,
        keyGenerator: (req) => {
            var _a;
            const email = (_a = req.body) === null || _a === void 0 ? void 0 : _a.email;
            if (!email)
                return "";
            return `${req.ip}_${email}`;
        }
    },
    LOGIN: {
        keyPrefix: "login_limiter",
        capacity: 10,
        refillRate: 2,
        keyGenerator: (req) => req.ip || "unknown"
    }
};
const OTPLimiterMiddleware = () => createRatelimiter(RATE_LIMIT_CONFIGS.OTP);
exports.OTPLimiterMiddleware = OTPLimiterMiddleware;
const LoginLimiterMiddleware = () => createRatelimiter(RATE_LIMIT_CONFIGS.LOGIN);
exports.LoginLimiterMiddleware = LoginLimiterMiddleware;
