import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/shared/infrastructure/PrismaClient';
import { Role } from '@/modules/auth/domain/Role';
import { requireRole } from '@/lib/session';
import { toResponse } from '@/shared/errors/handle';

const patchSchema = z.object({
  archived: z.boolean(),
});

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

    const log = await db.csvImportLog.update({
      where: { id },
      data: { archived: body.archived },
    });

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
