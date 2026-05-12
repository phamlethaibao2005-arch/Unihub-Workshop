import { createReadStream } from 'fs';
import { resolve, join } from 'path';
import csv from 'csv-parser';
import { z } from 'zod';
import { db } from '@/shared/infrastructure/PrismaClient';
import { BaseImportJob, ImportRowData } from './BaseImportJob';

// Validation schema
const studentRowSchema = z.object({
  student_id: z.string().regex(/^\d{8}$/, 'Student ID must be 8 digits'),
  name: z.string().min(1, 'Name cannot be empty'),
  email: z.string().email('Invalid email format'),
});

type StudentRow = z.infer<typeof studentRowSchema>;

/**
 * Concrete CSV import job for student data.
 * Reads CSV with columns: student_id, name, email
 * Validates and upserts students into the database.
 */
export class StudentCSVImportJob extends BaseImportJob {
  private processQueue: Array<{ row: StudentRow; rowIndex: number }> = [];
  private readonly BATCH_SIZE = 100;
  private readonly CSV_DIR = resolve(process.cwd(), 'data/csv-import');

  /**
   * Read rows from CSV file with streaming and BOM handling.
   * Validates header row before processing data rows.
   */
  protected async readRows(filename: string): Promise<ImportRowData[]> {
    return new Promise((resolve, reject) => {
      const filepath = join(this.CSV_DIR, 'processing', filename);
      const rows: ImportRowData[] = [];
      let headerValidated = false;

      createReadStream(filepath, { encoding: 'utf-8' })
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('headers', (headers: string[]) => {
          const requiredHeaders = ['student_id', 'name', 'email'];
          const hasAllHeaders = requiredHeaders.every((h) => headers.includes(h));

          if (!hasAllHeaders) {
            const missing = requiredHeaders.filter((h) => !headers.includes(h));
            reject(
              new Error(`Missing required columns: ${missing.join(', ')}. Expected: ${requiredHeaders.join(', ')}`)
            );
          }
          headerValidated = true;
        })
        .on('data', (row: ImportRowData) => {
          if (headerValidated) {
            rows.push(row);
          }
        })
        .on('end', () => {
          resolve(rows);
        })
        .on('error', (err: Error) => {
          reject(new Error(`Failed to read CSV file: ${err.message}`));
        });
    });
  }

  /**
   * Validate a single row using Zod schema.
   * Returns the validated row or null if invalid (skipped).
   */
  protected async validateRow(row: ImportRowData, rowIndex: number): Promise<StudentRow | null> {
    try {
      const validated = studentRowSchema.parse({
        student_id: row.student_id?.toString().trim(),
        name: row.name?.toString().trim(),
        email: row.email?.toString().trim().toLowerCase(),
      });
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const prefix = `Row ${rowIndex}: `;
        const messages = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        throw new Error(`${prefix}${messages}`);
      }
      throw error;
    }
  }

  /**
   * Process a validated row: upsert into database (batched).
   */
  protected async processRow(row: StudentRow, rowIndex: number): Promise<void> {
    this.processQueue.push({ row, rowIndex });

    if (this.processQueue.length >= this.BATCH_SIZE) {
      await this.flushBatch();
    }
  }

  /**
   * Flush the batch queue to database.
   */
  private async flushBatch(): Promise<void> {
    if (this.processQueue.length === 0) return;

    const batch = this.processQueue.splice(0, this.BATCH_SIZE);
    const ids = batch.map((item) => item.row.student_id);

    const existing = await db.user.findMany({
      where: { studentId: { in: ids } },
      select: { studentId: true },
    });

    const existingIds = new Set(existing.map((item) => item.studentId));

    for (const item of batch) {
      try {
        await db.user.upsert({
          where: { studentId: item.row.student_id },
          update: {
            name: item.row.name,
            email: item.row.email,
            updatedAt: new Date(),
          },
          create: {
            studentId: item.row.student_id,
            name: item.row.name,
            email: item.row.email,
            role: 'STUDENT',
          },
        });

        if (existingIds.has(item.row.student_id)) {
          this.duplicateCount++;
        } else {
          this.successCount++;
        }

        existingIds.add(item.row.student_id);
      } catch (error) {
        this.errorCount++;
        this.errorDetails.push({
          row: item.rowIndex,
          error: error instanceof Error ? error.message : String(error),
          data: item.row,
        });
      }
    }
  }

  /**
   * Flush any remaining rows at the end.
   */
  protected async finalize(): Promise<void> {
    await this.flushBatch();
  }
}
