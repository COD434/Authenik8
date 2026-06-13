"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityHeaders = exports.dynamicWhiteList = exports.verifyJWT = exports.generateJWT = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const ipAddress_1 = require("./ipAddress");
const redis_1 = require("./redis");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
dotenv_1.default.config({ path: ".env" });
const IP_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;
const JWT_SECRET = process.env.JWT_SECRET || "Boo";
const EXPIRY = "1h";
const generateJWT = (payload) => jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: EXPIRY });
exports.generateJWT = generateJWT;
const verifyJWT = (token) => jsonwebtoken_1.default.verify(token, JWT_SECRET);
exports.verifyJWT = verifyJWT;
exports.dynamicWhiteList = {
    isAllowed: async (ip) => {
        try {
            const redisClient = await (0, redis_1.initializeRedisClient)();
            const keys = await redisClient.keys("whitelist:ip:*");
            for (const key of keys) {
                const entry = key.replace("whitelist:ip:", "");
                if (entry === ip || ip === "::1" || ip === "127.0.0.1") {
                    return true;
                }
                if (entry.includes("/")) {
                    if ((0, ipAddress_1.isIpInCidr)(ip, entry))
                        return true;
                }
            }
            return false;
        }
        catch (err) {
            console.error("White check error:", err);
            return false;
        }
    },
    addIP: async (ipOrCIDR, ttl = IP_EXPIRATION_SECONDS) => {
        const redisClient = await (0, redis_1.initializeRedisClient)();
        const key = `whitelist:ip:${ipOrCIDR}`;
        await redisClient.sadd(key, "1");
        await redisClient.expire(key, ttl);
    },
    removeIP: async (ipOrCIDR) => {
        const redisClient = await (0, redis_1.initializeRedisClient)();
        const key = `whitelist:ip:${ipOrCIDR}`;
        await redisClient.srem(key, "1");
        await redisClient.del(key);
        //console.log("removeIP route hit by:",(req as any).user);
    },
    listIP: async () => {
        const redisClient = await (0, redis_1.initializeRedisClient)();
        const keys = await redisClient.keys("whitelist:ip:*");
        return keys.map(key => key.replace("whitelist:ip:", ""));
    },
    middleware: () => {
        return async (req, res, next) => {
            var _a, _b;
            const clientIP = ((_b = (_a = req.headers["x-forwarded-for"]) === null || _a === void 0 ? void 0 : _a.toString().split(",")[0]) === null || _b === void 0 ? void 0 : _b.trim()) || req.ip || req.headers.get;
            if (await exports.dynamicWhiteList.isAllowed(clientIP)) {
                return next();
            }
            console.warn(`Blocked request from IP: ${clientIP}`);
            //res.status(403).json({error:"Access denied"})
        };
    }
};
const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "trusted-cdn.com"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "trusted-cdn.com"],
    fontSrc: ["'self'", "trusted-fonts.com"],
    connectSrc: ["'self'", "api.trusted-domain.com"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
    reportUri: "/csp-violation-report"
};
const securityHeaders = [
    helmet_1.default.hsts({
        maxAge: 315353444,
        includeSubDomains: true,
        preload: true,
    }),
    helmet_1.default.contentSecurityPolicy({
        directives: cspDirectives,
        reportOnly: process.env.NODE_ENV !== "production"
    }),
    helmet_1.default.xssFilter(),
    helmet_1.default.noSniff(),
    helmet_1.default.frameguard({ action: "deny" }),
    helmet_1.default.referrerPolicy({ policy: "same-origin" }),
];
exports.securityHeaders = securityHeaders;
