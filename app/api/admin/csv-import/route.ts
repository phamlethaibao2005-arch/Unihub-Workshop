import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/infrastructure/PrismaClient';
import { Role } from '@/modules/auth/domain/Role';
import { requireRole } from '@/lib/session';
import { toResponse } from '@/shared/errors/handle';
import { enqueue } from '@/shared/infrastructure/QStashClient';

const BASE_URL = process.env.BETTER_AUTH_URL!;
const DESTINATION = `${BASE_URL}/api/queue/csv-import`;

/**
 * Admin CSV Import API
 * GET: List import history
 * POST: Upload CSV file for import
 */
export async function GET() {
  try {
    await requireRole(Role.ORGANIZER);

    const logs = await db.csvImportLog.findMany({
      orderBy: { processedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    return toResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(Role.ORGANIZER);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV file' }, { status: 400 });
    }

    // Encode file content for transport — avoids writing to the read-only /var/task filesystem on Vercel
    const buffer = await file.arrayBuffer();
    const filename = `${Date.now()}_${file.name}`;
    const content = Buffer.from(buffer).toString('base64');
    console.log(`[CSV Import API] Received file: ${filename} (${buffer.byteLength} bytes)`);

    // Enqueue job with file content embedded in payload
    await enqueue(DESTINATION, { filename, content, triggeredBy: 'admin' }, { retries: 3 });

    console.log(`[CSV Import API] Enqueued job for ${filename}`);

    return NextResponse.json({
      message: 'CSV import job enqueued',
      filename,
      status: 'queued',
    });
  } catch (error) {
    return toResponse(error);
  }
}
