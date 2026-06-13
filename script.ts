import express, {NextFunction, Request, Response} from "express";
import asyncHandler from "express-async-handler";
import cookieParser from "cookie-parser";
import {
  authSuccessCounter,
  businessKPI,
  errorCounter,
  loginCount,
  redisOps,
  Metrics
} from "./prisma/config/Monitor/monitor";
import {initRabbitMq} from "./prisma/config/Rabbitmq";
import {initializeRedisClient} from "./prisma/config/redis";
import {seedAdmin} from "./prisma/config/admin";
import {connectDB} from "./prisma/config/validate";
import {securityHeaders} from "./prisma/config/security";
import {swaggerSpec, swaggerUihandler} from "./prisma/config/swagger";
import {
  register,
  login,
  verifyResetOTP,
  UpdatePassword,
  userValidations,
  Lvalidations,
  requestPassword
} from "./Controllers/authController";
import router from "./routes/userrouter";
import {
  initializeRateLimiter,
  OTPLimiterMiddleware,
  LoginLimiterMiddleware
} from "./prisma/config/OTPlimit";

interface ErrorWithStatus extends Error {
  status?: number;
  type?: string;
}

const app = express();

app.disable("x-powered-by");
app.use(express.json({limit: "64kb"}));
app.use(cookieParser());
app.use(express.urlencoded({extended: true, limit: "64kb"}));
app.use(securityHeaders);
app.use("/api-docs", swaggerUihandler.serve, swaggerUihandler.setup(swaggerSpec));

app.use((req: Request, res: Response, next: NextFunction) => {
  req.setTimeout(5000, () => {
    if (!res.headersSent) {
      res.status(503).json({error: "Request timeout"});
    }
  });
  next();
});

app.use((req, _res, next) => {
  req.url = req.url.replace(/(?:\r|\n|%0a|%0d)+$/gi, "");
  next();
});

const registerRoutes = () => {
  app.use("/api/auth", router);
  app.post("/request-password-reset", OTPLimiterMiddleware(), requestPassword as express.RequestHandler);
  app.post("/verify-reset-otp", verifyResetOTP as express.RequestHandler);
  app.post("/update-password", UpdatePassword as express.RequestHandler);
  app.post("/register", ...userValidations, asyncHandler(register));
  app.post("/login", LoginLimiterMiddleware(), Lvalidations, login as express.RequestHandler);
  app.get("/metrics", Metrics);
  app.get("/health", (_req, res) => {
    res.status(200).json({status: "ok"});
  });
};

const registerErrorHandlers = () => {
  app.use((err: ErrorWithStatus, req: Request, res: Response, _next: NextFunction) => {
    errorCounter.inc();
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

    res.status(status).json({
      error: message,
      ...(process.env.NODE_ENV === "development" && {stack: err.stack})
    });
  });

  app.use((_req, res) => {
    res.status(404).json({error: "Route not found"});
  });
};

let kpiTimer: NodeJS.Timeout | undefined;

const startExternalServices = async () => {
  await seedAdmin();
  await initRabbitMq();

  const updateKpi = async () => {
    const redisClient = await initializeRedisClient();
    const keys = await redisClient.keys("session:*");
    businessKPI.set(keys.length);
  };

  kpiTimer = setInterval(() => {
    updateKpi().catch((error) => console.error("KPI update failed:", error));
  }, 30000);
  kpiTimer.unref();

  loginCount.inc();
  redisOps.inc();
  authSuccessCounter.inc();
};

export const initializeApplication = async () => {
  if (process.env.TEST_SKIP_DATABASE !== "true") {
    await connectDB();
  }
  await initializeRateLimiter();
  registerRoutes();
  registerErrorHandlers();

  if (process.env.NODE_ENV !== "test") {
    await startExternalServices();
  }
};

export const appReady = initializeApplication();

export default app;
