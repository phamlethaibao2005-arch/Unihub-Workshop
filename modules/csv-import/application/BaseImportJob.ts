import { Prisma } from '@prisma/client';
import { db } from '@/shared/infrastructure/PrismaClient';

export interface ImportRowData {
  [key: string]: string;
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  errorDetails: Array<{
    row: number;
    error: string;
    data?: ImportRowData;
  }>;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

/**
 * Abstract Template Method pattern for CSV import jobs.
 * Subclasses override readRows(), validateRow(), and processRow() methods.
 */
export abstract class BaseImportJob {
  protected totalRows = 0;
  protected successCount = 0;
  protected errorCount = 0;
  protected duplicateCount = 0;
  protected errorDetails: Array<{
    row: number;
    error: string;
    data?: ImportRowData;
  }> = [];

  /**
   * Main template method that orchestrates the import process.
   */
  async run(filename: string): Promise<ImportResult> {
    try {
      let rowIndex = 0;
      const rows = await this.readRows(filename);

      for (const row of rows) {
        rowIndex++;
        this.totalRows++;

        try {
          const validatedRow = await this.validateRow(row, rowIndex);
          if (validatedRow) {
            await this.processRow(validatedRow, rowIndex);
          }
        } catch (error) {
          if (this.isDuplicateError(error)) {
            this.duplicateCount++;
          } else {
            this.errorCount++;
            this.errorDetails.push({
              row: rowIndex,
              error: error instanceof Error ? error.message : String(error),
              data: row,
            });
          }
        }
      }

      if (this.totalRows === 0) {
        if (this.errorDetails.length === 0) {
          this.errorDetails.push({
            row: 0,
            error: 'Empty file, nothing imported',
          });
        }
        this.errorCount = Math.max(this.errorCount, 1);
      }

      await this.finalize();

      // Emit log after processing
      const result = await this.emitLog(filename);
      return result;
    } catch (error) {
      // Header validation or file read errors
      const result: ImportResult = {
        totalRows: this.totalRows,
        successCount: this.successCount,
        errorCount: this.errorCount || 1,
        duplicateCount: this.duplicateCount,
        errorDetails: [
          ...this.errorDetails,
          {
            row: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
        status: 'FAILED',
      };

      await db.csvImportLog.create({
        data: {
          filename,
          totalRows: result.totalRows,
          successCount: result.successCount,
          errorCount: result.errorCount,
          duplicateCount: result.duplicateCount,
        errorDetails: this.buildErrorDetails(result.errorDetails)!,
          status: result.status,
        },
      });

      return result;
    }
  }

  /**
   * Abstract method: read rows from the file.
   * Subclasses must implement streaming logic with header validation.
   */
  protected abstract readRows(filename: string): Promise<ImportRowData[]>;

  /**
   * Abstract method: validate a single row.
   * Return validated row if valid, throw ValidationError if invalid.
   */
  protected abstract validateRow(
    row: ImportRowData,
    rowIndex: number
  ): Promise<ImportRowData | null>;

  /**
   * Abstract method: process a validated row.
   * Throw DuplicateError for duplicate entries, other errors for failures.
   */
  protected abstract processRow(
    row: ImportRowData,
    rowIndex: number
  ): Promise<void>;

  protected async finalize(): Promise<void> {
    return;
  }

  /**
   * Check if error is a duplicate (increment duplicateCount instead of errorCount).
   */
  protected isDuplicateError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes('duplicate') || error.message.includes('already exists');
    }
    return false;
  }

  /**
   * Emit log to database.
   */
  private async emitLog(filename: string): Promise<ImportResult> {
    const status =
      this.errorCount === 0
        ? 'SUCCESS'
        : this.successCount > 0
          ? 'PARTIAL'
          : 'FAILED';

    const result: ImportResult = {
      totalRows: this.totalRows,
      successCount: this.successCount,
      errorCount: this.errorCount,
      duplicateCount: this.duplicateCount,
      errorDetails: this.errorDetails,
      status,
    };

      await db.csvImportLog.create({
      data: {
        filename,
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
        duplicateCount: result.duplicateCount,
        errorDetails: this.buildErrorDetails(result.errorDetails)!,
        status: result.status,
      },
    });

    return result;
  }

  private buildErrorDetails(
    details: ImportResult['errorDetails']
  ): Prisma.JsonArray | null {
    if (details.length === 0) return null;
    return details.map((detail) => ({
      row: detail.row,
      error: detail.error,
      data: detail.data ?? null,
    }));
  }
}
