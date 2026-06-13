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
const bcrypt_1 = __importDefault(require("bcrypt"));
const sinon_1 = __importDefault(require("sinon"));
const supertest_1 = __importDefault(require("supertest"));
const script_1 = __importStar(require("../script"));
const validate_1 = require("../prisma/config/validate");
const rabbitmq = __importStar(require("../prisma/config/Rabbitmq"));
describe("authentication API end-to-end", function () {
    this.timeout(30000);
    const email = "e2e-user@example.com";
    const username = "e2e_user";
    const password = "StrongPassword1!";
    const newPassword = "NewStrongPassword2!";
    before(async () => {
        sinon_1.default.stub(rabbitmq, "publishToQueue").resolves();
        await script_1.appReady;
        await validate_1.prisma.user.deleteMany();
    });
    after(() => {
        sinon_1.default.restore();
    });
    it("registers, logs in, resets the password, and logs in again", async () => {
        const registration = await (0, supertest_1.default)(script_1.default)
            .post("/register")
            .send({ email, username, password });
        strict_1.default.equal(registration.status, 200);
        strict_1.default.equal(registration.body.success, true);
        const storedUser = await validate_1.prisma.user.findUnique({ where: { email } });
        strict_1.default.ok(storedUser);
        strict_1.default.notEqual(storedUser.password, password);
        strict_1.default.equal(await bcrypt_1.default.compare(password, storedUser.password), true);
        const login = await (0, supertest_1.default)(script_1.default)
            .post("/login")
            .send({ email, password });
        strict_1.default.equal(login.status, 200);
        strict_1.default.equal(login.body.success, true);
        strict_1.default.ok(login.body.user.accessToken);
        strict_1.default.ok(login.body.user.refreshToken);
        strict_1.default.match(login.headers["set-cookie"][0], /HttpOnly/);
        const logout = await (0, supertest_1.default)(script_1.default)
            .post("/api/auth/logout")
            .set("Cookie", login.headers["set-cookie"]);
        strict_1.default.equal(logout.status, 200);
        strict_1.default.equal(logout.body.success, true);
        const resetRequest = await (0, supertest_1.default)(script_1.default)
            .post("/request-password-reset")
            .send({ email });
        strict_1.default.equal(resetRequest.status, 200);
        const resetUser = await validate_1.prisma.user.findUnique({ where: { email } });
        strict_1.default.ok(resetUser === null || resetUser === void 0 ? void 0 : resetUser.resetToken);
        const verification = await (0, supertest_1.default)(script_1.default)
            .post("/verify-reset-otp")
            .send({ email, otp: resetUser.resetToken });
        strict_1.default.equal(verification.status, 200);
        const update = await (0, supertest_1.default)(script_1.default)
            .post("/update-password")
            .send({ email, password: newPassword });
        strict_1.default.equal(update.status, 200);
        const secondLogin = await (0, supertest_1.default)(script_1.default)
            .post("/login")
            .send({ email, password: newPassword });
        strict_1.default.equal(secondLogin.status, 200);
        strict_1.default.equal(secondLogin.body.user.email, email);
    });
    it("issues guest credentials and enforces the login rate limit", async () => {
        const guest = await (0, supertest_1.default)(script_1.default).get("/api/auth/guest-mode");
        strict_1.default.equal(guest.status, 200);
        strict_1.default.ok(guest.headers["x-guest-token"]);
        let blocked = false;
        for (let attempt = 0; attempt < 15; attempt += 1) {
            const response = await (0, supertest_1.default)(script_1.default)
                .post("/login")
                .send({ email, password: "WrongPassword1!" });
            if (response.status === 429) {
                blocked = true;
                break;
            }
        }
        strict_1.default.equal(blocked, true);
        const metrics = await (0, supertest_1.default)(script_1.default).get("/metrics");
        strict_1.default.match(metrics.text, /Login_Attempts_Blocked\s+[1-9]/);
        strict_1.default.match(metrics.text, /Guest_visited\{endpoint="\/api\/auth\/guest-mode"\}\s+[1-9]/);
    });
});
