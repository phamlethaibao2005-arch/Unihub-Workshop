import { Client, Receiver } from "@upstash/qstash";
import type { NextRequest } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var __qstash: Client | undefined;
}

export const qstash: Client =
  globalThis.__qstash ??
  new Client({
    token: process.env.QSTASH_TOKEN!,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__qstash = qstash;
}

export interface EnqueueOptions {
  retries?: number;
  /** Seconds as a number, or a string like "30s", "5m", "2h" */
  delay?: number | `${bigint}s` | `${bigint}m` | `${bigint}h` | `${bigint}d`;
  deduplicationId?: string;
}

export async function enqueue(
  destinationUrl: string,
  payload: unknown,
  opts: EnqueueOptions = {}
): Promise<void> {
  await qstash.publishJSON({
    url: destinationUrl,
    body: payload,
    retries: opts.retries ?? 3,
    ...(opts.delay !== undefined && { delay: opts.delay }),
    ...(opts.deduplicationId !== undefined && {
      deduplicationId: opts.deduplicationId,
    }),
  });
}

export async function verifyQStashSignature(req: NextRequest): Promise<void> {
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });

  const signature = req.headers.get("upstash-signature");
  if (!signature) {
    throw new Error("Missing upstash-signature header");
  }

  const body = await req.text();
  const isValid = await receiver.verify({
    signature,
    body,
  });

  if (!isValid) {
    throw new Error("Invalid QStash signature");
  }
}
