import { Redis } from "@upstash/redis";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

export const redis: Redis =
  globalThis.__redis ??
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}
