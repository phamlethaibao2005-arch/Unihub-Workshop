import { Redis } from "@upstash/redis";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

const hasRedisConfig = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const memoryStore = new Map<string, unknown>();

const localRedis = {
  async get<T>(key: string): Promise<T | null> {
    return (memoryStore.get(key) as T | undefined) ?? null;
  },
  async set(key: string, value: unknown): Promise<"OK"> {
    memoryStore.set(key, value);
    return "OK";
  },
  async del(...keys: string[]): Promise<number> {
    let count = 0;
    keys.forEach((key) => {
      if (memoryStore.delete(key)) count += 1;
    });
    return count;
  },
} as Redis;

export const redis: Redis =
  globalThis.__redis ??
  (hasRedisConfig
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : localRedis);

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}
