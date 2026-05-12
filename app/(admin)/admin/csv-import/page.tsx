'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Upload, FileText, AlertCircle, Loader,
  ChevronLeft, ChevronRight, Archive, ArchiveRestore, Trash2, X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface ErrorDetail {
  row: number;
  error: string;
  data?: Record<string, string>;
}

interface CsvImportLog {
  id: string;
  filename: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  errorDetails: ErrorDetail[] | null;
  status: string;
  archived: boolean;
  processedAt: string;
}

const PAGE_SIZE = 20;

function buildErrors(logs: CsvImportLog[]) {
  return logs.flatMap((log) =>
    (log.errorDetails ?? []).map((error, idx) => ({
      ...error,
      filename: log.filename,
      logId: log.id,
      localIdx: idx,
    }))
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'SUCCESS': return <Badge className="bg-emerald-600">Success</Badge>;
    case 'PARTIAL':  return <Badge className="bg-amber-600">Partial</Badge>;
    case 'FAILED':   return <Badge className="bg-red-600">Failed</Badge>;
    default:         return <Badge variant="outline">{status}</Badge>;
  }
}

function ErrorDetailsCard({
  logs,
  onDeleteError,
  onClearErrors,
}: {
  logs: CsvImportLog[];
  onDeleteError: (logId: string, localIdx: number) => Promise<void>;
  onClearErrors: (logIds: string[]) => Promise<void>;
}) {
  const [page, setPage] = useState(0);
  const allErrors = useMemo(() => buildErrors(logs), [logs]);
  const totalPages = Math.max(1, Math.ceil(allErrors.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageErrors = allErrors.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE
  );

  if (allErrors.length === 0) return null;

  const logsWithErrors = logs
    .filter((l) => l.errorDetails && l.errorDetails.length > 0)
    .map((l) => l.id);

  const handleClearAll = () => {
    if (!window.confirm(`Xóa tất cả ${allErrors.length} lỗi? Thao tác này không thể hoàn tác.`)) return;
    void onClearErrors(logsWithErrors);
  };

  return (
    <Card className="rounded-none border border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-900">
          <AlertCircle className="h-5 w-5" />
          Chi Tiết Lỗi
          <span className="font-mono text-sm font-normal text-red-700">
            ({allErrors.length})
          </span>
          <button
            onClick={handleClearAll}
            className="ml-auto rounded px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-red-600 hover:bg-red-100"
          >
            Xóa tất cả
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pageErrors.map((error) => (
            <div
              key={`${error.logId}-${error.localIdx}`}
              className="group relative rounded bg-white p-3 font-mono text-xs"
            >
              {/* Delete single error */}
              <button
                onClick={() => void onDeleteError(error.logId, error.localIdx)}
                title="Xóa lỗi này"
                className="absolute right-2 top-2 rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="font-semibold text-red-600 pr-6">
                {error.filename} — Hàng {error.row}
              </div>
              <div className="mt-1 text-gray-700">{error.error}</div>
              {error.data && (
                <div className="mt-1 whitespace-pre-wrap text-gray-500">
                  {JSON.stringify(error.data, null, 2)}
                </div>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-red-200 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(0, Math.min(p, safePage) - 1))}
              disabled={safePage === 0}
              className="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Trước
            </button>
            <span className="font-mono text-xs text-red-700">
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, allErrors.length)} / {allErrors.length}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, Math.max(p, safePage) + 1))}
              disabled={safePage === totalPages - 1}
              className="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sau
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LogsTable({
  logs,
  onArchive,
  onDelete,
  isArchived,
}: {
  logs: CsvImportLog[];
  onArchive: (id: string, archived: boolean) => Promise<void>;
  onDelete: (id: string, filename: string) => Promise<void>;
  isArchived: boolean;
}) {
  if (logs.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">
        {isArchived ? 'Không có bản ghi nào được lưu trữ' : 'Chưa có lịch sử nhập'}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-3 text-left font-semibold">Tệp</th>
            <th className="px-4 py-3 text-center font-semibold">Tổng Hàng</th>
            <th className="px-4 py-3 text-center font-semibold">Thành Công</th>
            <th className="px-4 py-3 text-center font-semibold">Lỗi</th>
            <th className="px-4 py-3 text-center font-semibold">Trùng</th>
            <th className="px-4 py-3 text-center font-semibold">Trạng Thái</th>
            <th className="px-4 py-3 text-left font-semibold">Thời Gian</th>
            <th className="px-4 py-3 text-right font-semibold">Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="max-w-50 truncate">{log.filename}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-mono font-semibold">{log.totalRows}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-mono font-semibold text-emerald-600">{log.successCount}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-mono font-semibold text-red-600">{log.errorCount}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-mono font-semibold text-amber-600">{log.duplicateCount}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <StatusBadge status={log.status} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {new Date(log.processedAt).toLocaleString('vi-VN')}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => void onArchive(log.id, !log.archived)}
                    title={isArchived ? 'Khôi phục' : 'Lưu trữ'}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    {isArchived
                      ? <ArchiveRestore className="h-4 w-4" />
                      : <Archive className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => void onDelete(log.id, log.filename)}
                    title="Xóa vĩnh viễn"
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CSVImportPage() {
  const [logs, setLogs] = useState<CsvImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const activeLogs   = useMemo(() => logs.filter((l) => !l.archived), [logs]);
  const archivedLogs = useMemo(() => logs.filter((l) =>  l.archived), [logs]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/csv-import');
      const data = await res.json() as { logs?: CsvImportLog[] };
      setLogs(data.logs ?? []);
    } catch {
      // keep stale data on network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tick = () => void fetchLogs();
    const initial = setTimeout(tick, 0);
    const id = setInterval(tick, 5_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [fetchLogs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error('Vui lòng chọn tệp CSV');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/csv-import', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload thất bại');
      toast.success('Đã tải lên. Đang xử lý...');
      input.value = '';
      void fetchLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  };

  const patchLog = async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/csv-import/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
  };

  const handleArchive = async (id: string, archived: boolean) => {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, archived } : l)));
    try {
      await patchLog(id, { archived });
      toast.success(archived ? 'Đã lưu trữ' : 'Đã khôi phục');
    } catch {
      toast.error('Có lỗi xảy ra, thử lại');
      void fetchLogs();
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    if (!window.confirm(`Xóa vĩnh viễn bản ghi "${filename}"? Thao tác này không thể hoàn tác.`)) return;
    setLogs((prev) => prev.filter((l) => l.id !== id));
    try {
      const res = await fetch(`/api/admin/csv-import/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Đã xóa');
    } catch {
      toast.error('Có lỗi xảy ra, thử lại');
      void fetchLogs();
    }
  };

  const handleDeleteError = async (logId: string, localIdx: number) => {
    const log = logs.find((l) => l.id === logId);
    if (!log?.errorDetails) return;

    const newDetails = log.errorDetails.filter((_, i) => i !== localIdx);
    const next = newDetails.length > 0 ? newDetails : null;

    setLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, errorDetails: next } : l))
    );
    try {
      await patchLog(logId, { errorDetails: next });
    } catch {
      toast.error('Có lỗi xảy ra, thử lại');
      void fetchLogs();
    }
  };

  const handleClearErrors = async (logIds: string[]) => {
    setLogs((prev) =>
      prev.map((l) => (logIds.includes(l.id) ? { ...l, errorDetails: null } : l))
    );
    try {
      await Promise.all(logIds.map((id) => patchLog(id, { errorDetails: null })));
      toast.success('Đã xóa tất cả lỗi');
    } catch {
      toast.error('Có lỗi xảy ra, thử lại');
      void fetchLogs();
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-5xl uppercase tracking-tight">CSV Import</h1>
        <p className="mt-2 text-sm text-gray-600">Quản lý nhập dữ liệu sinh viên từ tệp CSV</p>
      </div>

      {/* Upload */}
      <Card className="rounded-none border">
        <CardHeader>
          <CardTitle>Tải Lên Tệp CSV</CardTitle>
          <CardDescription>Chọn tệp CSV chứa dữ liệu sinh viên (cột: student_id, name, email)</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-8 transition hover:border-gray-400">
            <Upload className="h-5 w-5 text-gray-600" />
            <span className="font-medium text-gray-700">
              {uploading ? 'Đang tải...' : 'Chọn tệp CSV'}
            </span>
            <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} className="hidden" />
          </label>
        </CardContent>
      </Card>

      {/* History with tabs */}
      <Card className="rounded-none border">
        <CardHeader>
          <CardTitle>Lịch Sử Nhập</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-5 w-5 animate-spin text-gray-600" />
            </div>
          ) : (
            <Tabs defaultValue="active">
              <TabsList className="mb-4">
                <TabsTrigger value="active">
                  Hoạt Động
                  {activeLogs.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-ink/10 px-1.5 py-0.5 text-[11px] font-medium">
                      {activeLogs.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="archived">
                  Lưu Trữ
                  {archivedLogs.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-ink/10 px-1.5 py-0.5 text-[11px] font-medium">
                      {archivedLogs.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-6">
                <LogsTable
                  logs={activeLogs}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  isArchived={false}
                />
                <ErrorDetailsCard
                  logs={activeLogs}
                  onDeleteError={handleDeleteError}
                  onClearErrors={handleClearErrors}
                />
              </TabsContent>

              <TabsContent value="archived" className="space-y-6">
                <LogsTable
                  logs={archivedLogs}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  isArchived={true}
                />
                <ErrorDetailsCard
                  logs={archivedLogs}
                  onDeleteError={handleDeleteError}
                  onClearErrors={handleClearErrors}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
