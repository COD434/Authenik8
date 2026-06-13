"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = exports.verifyToken = exports.guestToken = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("./redis");
const monitor_1 = require("./Monitor/monitor");
const crypto_1 = __importDefault(require("crypto"));
dotenv_1.default.config();
const T_EXPIRY = "1d";
const guestToken = () => {
    const Payload = {
        type: "guest",
        id: crypto_1.default.randomUUID(),
        createdAt: Date.now()
    };
    //if(guestToken()){
    monitor_1.guestCounter.inc();
    return jsonwebtoken_1.default.sign(Payload, process.env.JWT_SECRET, { expiresIn: T_EXPIRY });
};
exports.guestToken = guestToken;
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch (_a) {
        return null;
    }
};
exports.verifyToken = verifyToken;
const authenticateJWT = async (req, res, next) => {
    var _a;
    const authHeader = req.headers.authorization;
    const token = ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token) || ((authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith("Bearer ")) ? authHeader.split(" ")[1] : null);
    if (!token) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const redisClient = await (0, redis_1.initializeRedisClient)();
        const storedToken = await redisClient.get(`session:${decoded.userId}`);
        if (storedToken !== token) {
            res.status(403).json({ success: false, message: "Invalid session", errors: [] });
            return;
        }
        req.user = decoded;
        return next();
    }
    catch (err) {
        res.status(403).json({ success: false, message: "Invalid  or expired token" });
        return;
    }
    ;
};
exports.authenticateJWT = authenticateJWT;
