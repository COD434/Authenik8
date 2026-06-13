"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appReady = exports.initializeApplication = void 0;
const express_1 = __importDefault(require("express"));
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const monitor_1 = require("./prisma/config/Monitor/monitor");
const Rabbitmq_1 = require("./prisma/config/Rabbitmq");
const redis_1 = require("./prisma/config/redis");
const admin_1 = require("./prisma/config/admin");
const validate_1 = require("./prisma/config/validate");
const security_1 = require("./prisma/config/security");
const swagger_1 = require("./prisma/config/swagger");
const authController_1 = require("./Controllers/authController");
const userrouter_1 = __importDefault(require("./routes/userrouter"));
const OTPlimit_1 = require("./prisma/config/OTPlimit");
const app = (0, express_1.default)();
app.disable("x-powered-by");
app.use(express_1.default.json({ limit: "64kb" }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.urlencoded({ extended: true, limit: "64kb" }));
app.use(security_1.securityHeaders);
app.use("/api-docs", swagger_1.swaggerUihandler.serve, swagger_1.swaggerUihandler.setup(swagger_1.swaggerSpec));
app.use((req, res, next) => {
    req.setTimeout(5000, () => {
        if (!res.headersSent) {
            res.status(503).json({ error: "Request timeout" });
        }
    });
    next();
});
app.use((req, _res, next) => {
    req.url = req.url.replace(/[\n\r%0A%0D]+$/i, "");
    next();
});
const registerRoutes = () => {
    app.use("/api/auth", userrouter_1.default);
    app.post("/request-password-reset", (0, OTPlimit_1.OTPLimiterMiddleware)(), authController_1.requestPassword);
    app.post("/verify-reset-otp", authController_1.verifyResetOTP);
    app.post("/update-password", authController_1.UpdatePassword);
    app.post("/register", ...authController_1.userValidations, (0, express_async_handler_1.default)(authController_1.register));
    app.post("/login", (0, OTPlimit_1.LoginLimiterMiddleware)(), authController_1.Lvalidations, authController_1.login);
    app.get("/metrics", monitor_1.Metrics);
    app.get("/health", (_req, res) => {
        res.status(200).json({ status: "ok" });
    });
};
const registerErrorHandlers = () => {
    app.use((err, req, res, _next) => {
        monitor_1.errorCounter.inc();
        const status = err.type === "entity.too.large" ? 413 : err.status || 500;
        const message = status === 413
            ? "Request body too large"
            : status === 400
                ? "Invalid request body"
                : err.message || "Something went wrong";
        console.error(`Error: ${err.message}`, {
            path: req.path,
            method: req.method,
            stack: process.env.NODE_ENV === "development" ? err.stack : undefined
        });
        res.status(status).json(Object.assign({ error: message }, (process.env.NODE_ENV === "development" && { stack: err.stack })));
    });
    app.use((_req, res) => {
        res.status(404).json({ error: "Route not found" });
    });
};
let kpiTimer;
const startExternalServices = async () => {
    await (0, admin_1.seedAdmin)();
    await (0, Rabbitmq_1.initRabbitMq)();
    const updateKpi = async () => {
        const redisClient = await (0, redis_1.initializeRedisClient)();
        const keys = await redisClient.keys("session:*");
        monitor_1.businessKPI.set(keys.length);
    };
    kpiTimer = setInterval(() => {
        updateKpi().catch((error) => console.error("KPI update failed:", error));
    }, 30000);
    kpiTimer.unref();
    monitor_1.loginCount.inc();
    monitor_1.redisOps.inc();
    monitor_1.authSuccessCounter.inc();
};
const initializeApplication = async () => {
    if (process.env.TEST_SKIP_DATABASE !== "true") {
        await (0, validate_1.connectDB)();
    }
    await (0, OTPlimit_1.initializeRateLimiter)();
    registerRoutes();
    registerErrorHandlers();
    if (process.env.NODE_ENV !== "test") {
        await startExternalServices();
    }
};
exports.initializeApplication = initializeApplication;
exports.appReady = (0, exports.initializeApplication)();
exports.default = app;
