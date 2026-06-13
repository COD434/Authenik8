"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mochaHooks = void 0;
const validate_1 = require("../prisma/config/validate");
const redis_1 = require("../prisma/config/redis");
exports.mochaHooks = {
    async afterAll() {
        await (0, redis_1.resetRedisClient)();
        await validate_1.prisma.$disconnect();
    }
};
