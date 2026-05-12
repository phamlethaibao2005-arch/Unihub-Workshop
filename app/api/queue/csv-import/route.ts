import { NextRequest, NextResponse } from 'next/server';
import { renameSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { StudentCSVImportJob } from '@/modules/csv-import/application/StudentCSVImportJob';
import { redis } from '@/shared/infrastructure/RedisClient';
import { verifyQStashSignature } from '@/shared/infrastructure/QStashClient';

const CSV_DIR = resolve(process.cwd(), 'data/csv-import');
const PROCESSING_DIR = resolve(CSV_DIR, 'processing');
const PROCESSED_DIR = resolve(CSV_DIR, 'processed');

const payloadSchema = z.object({
  filename: z.string().min(1),
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

    const { filename, triggeredBy } = payload;

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

      // Ensure processed directory exists
      if (!existsSync(PROCESSED_DIR)) {
        mkdirSync(PROCESSED_DIR, { recursive: true });
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
