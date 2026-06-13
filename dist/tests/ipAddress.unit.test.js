"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const ipAddress_1 = require("../prisma/config/ipAddress");
describe("isIpInCidr", () => {
    it("matches IPv4, IPv6, and IPv4-mapped IPv6 addresses", () => {
        strict_1.default.equal((0, ipAddress_1.isIpInCidr)("192.168.1.42", "192.168.1.0/24"), true);
        strict_1.default.equal((0, ipAddress_1.isIpInCidr)("192.168.2.42", "192.168.1.0/24"), false);
        strict_1.default.equal((0, ipAddress_1.isIpInCidr)("::ffff:192.168.1.42", "192.168.1.0/24"), true);
        strict_1.default.equal((0, ipAddress_1.isIpInCidr)("2001:db8::42", "2001:db8::/32"), true);
        strict_1.default.equal((0, ipAddress_1.isIpInCidr)("2001:db9::42", "2001:db8::/32"), false);
    });
    it("rejects malformed addresses and incompatible address families", () => {
        strict_1.default.equal((0, ipAddress_1.isIpInCidr)("not-an-ip", "192.168.1.0/24"), false);
        strict_1.default.equal((0, ipAddress_1.isIpInCidr)("192.168.1.42", "not-a-cidr"), false);
        strict_1.default.equal((0, ipAddress_1.isIpInCidr)("192.168.1.42", "2001:db8::/32"), false);
    });
});
