import {prisma} from "../prisma/config/validate";
import {resetRedisClient} from "../prisma/config/redis";

export const mochaHooks = {
  async afterAll() {
    await resetRedisClient();
    await prisma.$disconnect();
  }
};
