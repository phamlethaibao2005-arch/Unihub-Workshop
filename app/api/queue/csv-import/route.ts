import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, readFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { StudentCSVImportJob } from '@/modules/csv-import/application/StudentCSVImportJob';
import { redis } from '@/shared/infrastructure/RedisClient';
import { verifyQStashSignature } from '@/shared/infrastructure/QStashClient';

// /tmp is writable on Vercel serverless; data/csv-import is used in local dev
const BASE_DIR = process.env.VERCEL
  ? '/tmp/csv-import'
  : resolve(process.cwd(), 'data/csv-import');
const PROCESSING_DIR = resolve(BASE_DIR, 'processing');
const PROCESSED_DIR = resolve(BASE_DIR, 'processed');

const payloadSchema = z.object({
  filename: z.string().min(1),
  content: z.string().optional(), // base64-encoded file content (admin upload flow)
  triggeredBy: z.string().optional(),
});

/**
 * QStash queue handler for CSV import jobs.
 * Verifies signature, runs the import, and moves the file to processed/.
 */
export async function POST(request: NextRequest) {
  try {
    try {
      await verifyQStashSignature(request.clone() as unknown as NextRequest);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: z.infer<typeof payloadSchema>;
    try {
      payload = payloadSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { filename, content, triggeredBy } = payload;

    // Distributed lock: prevent concurrent imports
    const lockKey = 'csv-import:lock';
    const lockAcquired = await redis.set(lockKey, '1', {
      nx: true,
      ex: 600, // 10 minutes TTL
    });

    if (!lockAcquired) {
      console.log('[CSV Import Queue] Import already running, skipping');
      return NextResponse.json({
        message: 'Import already running',
      });
    }

    try {
      console.log(`[CSV Import Queue] Processing ${filename} (triggered by: ${triggeredBy})`);

      // Ensure directories exist
      mkdirSync(PROCESSING_DIR, { recursive: true });
      mkdirSync(PROCESSED_DIR, { recursive: true });

      if (content) {
        // Admin upload flow: file content was embedded in the QStash payload
        writeFileSync(resolve(PROCESSING_DIR, filename), Buffer.from(content, 'base64'));
        console.log(`[CSV Import Queue] Wrote ${filename} to processing dir from payload`);
      } else {
        // Cron/local flow: file should already be in processing/ (moved by cron handler)
        const cronProcessingPath = resolve(resolve(process.cwd(), 'data/csv-import'), 'processing', filename);
        if (!existsSync(resolve(PROCESSING_DIR, filename)) && existsSync(cronProcessingPath)) {
          mkdirSync(PROCESSING_DIR, { recursive: true });
          writeFileSync(resolve(PROCESSING_DIR, filename), readFileSync(cronProcessingPath));
        }
      }

      // Run import job
      const job = new StudentCSVImportJob();
      const result = await job.run(filename);

      // Move file to processed/
      const processingPath = resolve(PROCESSING_DIR, filename);
      const timestamp = new Date().toISOString().split('T')[0];
      const processedPath = resolve(PROCESSED_DIR, `${timestamp}_${filename}`);

      if (existsSync(processingPath)) {
        renameSync(processingPath, processedPath);
        console.log(`[CSV Import Queue] Moved ${filename} to processed/`);
      }

      console.log(`[CSV Import Queue] Completed ${filename}:`, result);

      return NextResponse.json({
        message: 'CSV import completed',
        result,
      });
    } finally {
      // Release lock
      await redis.del(lockKey);
    }
  } catch (error) {
    console.error('[CSV Import Queue] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
