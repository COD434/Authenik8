import dotenv from "dotenv";
import {RedisStore}  from "connect-redis";
import Redis ,{ Redis as RedisCon }from "ioredis";
import RedisMock from "ioredis-mock";
dotenv.config();




interface RedisConfig{
url?: string;
host?: string 
port?: number;
password?: string;
maxRetriesPerRequest?:number;
connectTimeout: number;
}

interface RedisStoreOptions{
prefix?: string;
ttl?: number;
}

interface SetupRedisOptions{
redisConfig?: Partial<RedisConfig>;
storeOptions?:Partial<RedisStoreOptions>;
}

type RedisClient = RedisCon;

let redisClientInstance:RedisClient | null = null

const DEFAULT_REDIS_CONFIG: RedisConfig = {
host:process.env.REDIS_HOST ?? "redis",
port: Number(process.env.REDIS_PORT ?? "6379"),
//password:process.env.REDIS_PASSWORD,
maxRetriesPerRequest: 10,
connectTimeout: 5000
}

const DEFAULT_STORE_OPTIONS : RedisStoreOptions = {
prefix: "session",
ttl: 86400
}

const validateRedisConfig = (config:RedisConfig) => {
  if (!config.url && !config.host) {
    throw new Error("Redis configuration requires either URL or host/port");
  }
  
  if (config.url && !config.url.startsWith("redis://")) {
    throw new Error("Redis URL must use 'redis://' protocol");
  }

//  if (config.port && (config.port < 1 || config.port > 65535)) {
  //  throw new Error("Invalid Redis port number");
  //}
};

const getRedisConfig = (options?:Partial<RedisConfig>):  RedisConfig => {
 const port = options?.port ?
	 Number(options.port) :
	 process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 
	 Number(DEFAULT_REDIS_CONFIG.port);

	const config: RedisConfig = {
...DEFAULT_REDIS_CONFIG,	  
    host: options?.host || process.env.REDIS_HOST|| DEFAULT_REDIS_CONFIG.host,
    port: port,
    password: options?.password || process.env.REDIS_PASSWORD|| undefined,
    ...options
  };
  validateRedisConfig(config);
  return config;
};

const setupRedis = async (options?: SetupRedisOptions) => {
  if (redisClientInstance) {
    return {
      redisClient: redisClientInstance,
      redisStore: new RedisStore({
        client: redisClientInstance,
        ...DEFAULT_STORE_OPTIONS,
        ...options?.storeOptions
      })
    };
  }

  try {
    const config = getRedisConfig(options?.redisConfig);
    const storeOptions = {...DEFAULT_STORE_OPTIONS, ...options?.storeOptions}
    const redisClient = process.env.NODE_ENV === "test"
      ? new RedisMock()
      : new Redis({
          host: config.host as string,
          port:Number(config.port),
          password:config.password,
          retryStrategy:(times:number)=> Math.min(times * 50,2000),
          maxRetriesPerRequest:config.maxRetriesPerRequest
        });

    if (process.env.NODE_ENV !== "test") {
      await new Promise<void>((resolve, reject)=>{
      redisClient.once("ready", async () =>{
      try{
      const pong = await redisClient.ping();
      console.log("Redis ping response:",pong);
      resolve();
      }catch(err){
      reject(err);
       }
      })
      redisClient.once("error",(err)=>{
      reject(err);
       })
      });
    }
      
      const redisStore = new RedisStore({
      client: redisClient,
      prefix:storeOptions.prefix,
      ttl:storeOptions.ttl
      });

    
    if (process.env.NODE_ENV !== "test") {
      redisClient.on("error", (err:Error) => {
        console.error("Redis client error:", err);
      });

      redisClient.on("ready", () => {
        console.log("Redis client is ready");
      });

      redisClient.on("reconnecting", () => {
        console.log("Redis client reconnecting...");
      });
    }

    redisClientInstance = redisClient as RedisClient;
    return{ redisClient: redisClientInstance, redisStore };
  } catch (error) {
    console.error("Redis setup failed:", error);
    throw error; 
  }
};
const initializeRedisClient =async () => {
if(!redisClientInstance){
const {redisClient} = await setupRedis();
redisClientInstance= redisClient;
}
return redisClientInstance
};

const resetRedisClient = async () => {
if (redisClientInstance) {
await redisClientInstance.flushall();
await redisClientInstance.quit();
redisClientInstance = null;
}
};

export {setupRedis, initializeRedisClient, resetRedisClient};
export type {RedisConfig, RedisStoreOptions, SetupRedisOptions}
