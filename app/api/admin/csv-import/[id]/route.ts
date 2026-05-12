import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/shared/infrastructure/PrismaClient';
import { Role } from '@/modules/auth/domain/Role';
import { requireRole } from '@/lib/session';
import { toResponse } from '@/shared/errors/handle';

const errorDetailSchema = z.object({
  row: z.number(),
  error: z.string(),
  data: z.record(z.string(), z.string()).optional(),
});

const patchSchema = z
  .object({
    archived: z.boolean().optional(),
    errorDetails: z.array(errorDetailSchema).nullable().optional(),
  })
  .refine(
    (d) => d.archived !== undefined || d.errorDetails !== undefined,
    'At least one field is required'
  );

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(Role.ORGANIZER);
    const { id } = await params;

    let body: z.infer<typeof patchSchema>;
    try {
      body = patchSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.archived !== undefined) data.archived = body.archived;
    if (body.errorDetails !== undefined) data.errorDetails = body.errorDetails;

    const log = await db.csvImportLog.update({ where: { id }, data });

    return NextResponse.json({ log });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(Role.ORGANIZER);
    const { id } = await params;

    await db.csvImportLog.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return toResponse(error);
  }
}
