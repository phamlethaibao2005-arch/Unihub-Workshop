import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, renameSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { enqueue } from '@/shared/infrastructure/QStashClient';

const BASE_URL = process.env.BETTER_AUTH_URL!;
const DESTINATION = `${BASE_URL}/api/queue/csv-import`;

const CSV_DIR = resolve(process.cwd(), 'data/csv-import');
const INCOMING_DIR = resolve(CSV_DIR, 'incoming');
const PROCESSING_DIR = resolve(CSV_DIR, 'processing');

/**
 * Vercel cron handler that scans for new CSV files and enqueues import jobs.
 * Runs at 2:00 AM daily.
 */
export async function GET(request: NextRequest) {
  // Verify Vercel cron secret header (Vercel sets x-vercel-cron-secret)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ensure directories exist
    if (!existsSync(INCOMING_DIR)) mkdirSync(INCOMING_DIR, { recursive: true });
    if (!existsSync(PROCESSING_DIR)) mkdirSync(PROCESSING_DIR, { recursive: true });

    // Scan for CSV files in incoming/ directory
    const files = readdirSync(INCOMING_DIR).filter((f) => f.endsWith('.csv'));

    if (files.length === 0) {
      console.log('[CSV Import Cron] No new CSV files found in incoming/');
      return NextResponse.json({ message: 'No new files to import', filesProcessed: 0 });
    }

    console.log(`[CSV Import Cron] Found ${files.length} file(s) to process`);

    // Move files to processing/ and enqueue jobs
    const enqueuedJobs = [];

    for (const filename of files) {
      try {
        const incomingPath = resolve(INCOMING_DIR, filename);
        const processingPath = resolve(PROCESSING_DIR, filename);

        // Move file from incoming/ to processing/
        renameSync(incomingPath, processingPath);
        console.log(`[CSV Import Cron] Moved ${filename} to processing/`);

        // Enqueue QStash job
        await enqueue(
          DESTINATION,
          {
            filename,
            triggeredBy: 'cron',
          },
          { retries: 3 }
        );

        enqueuedJobs.push({ filename });
        console.log(`[CSV Import Cron] Enqueued job for ${filename}`);
      } catch (error) {
        console.error(`[CSV Import Cron] Error processing ${filename}:`, error);
      }
    }

    return NextResponse.json({
      message: 'CSV import jobs enqueued',
      filesProcessed: enqueuedJobs.length,
      jobs: enqueuedJobs,
    });
  } catch (error) {
    console.error('[CSV Import Cron] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
