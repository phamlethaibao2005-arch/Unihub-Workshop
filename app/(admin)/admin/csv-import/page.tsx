'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, FileText, AlertCircle, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface CsvImportLog {
  id: string;
  filename: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  errorDetails: Array<{
    row: number;
    error: string;
    data?: Record<string, string>;
  }> | null;
  status: string;
  processedAt: string;
}

const PAGE_SIZE = 20

export default function CSVImportPage() {
  const [logs, setLogs] = useState<CsvImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorPage, setErrorPage] = useState(0);

  const allErrors = useMemo(
    () =>
      logs.flatMap((log) =>
        (log.errorDetails ?? []).map((error, idx) => ({
          ...error,
          filename: log.filename,
          logId: log.id,
          localIdx: idx,
        }))
      ),
    [logs]
  );

  const totalErrorPages = Math.ceil(allErrors.length / PAGE_SIZE);
  const pageErrors = allErrors.slice(errorPage * PAGE_SIZE, (errorPage + 1) * PAGE_SIZE);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/csv-import');
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchLogs();
    }, 5000); // Refresh every 5s

    const initial = setTimeout(() => {
      void fetchLogs();
    }, 0);

    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [fetchLogs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/csv-import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      toast.success('CSV file uploaded. Processing started...');
      e.currentTarget.value = ''; // Reset input
      setErrorPage(0);
      fetchLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge className="bg-emerald-600">Success</Badge>;
      case 'PARTIAL':
        return <Badge className="bg-amber-600">Partial</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-600">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-5xl uppercase tracking-tight">CSV Import</h1>
        <p className="mt-2 text-sm text-gray-600">
          Quản lý nhập dữ liệu sinh viên từ tệp CSV
        </p>
      </div>

      {/* Upload Card */}
      <Card className="rounded-none border">
        <CardHeader>
          <CardTitle>Tải Lên Tệp CSV</CardTitle>
          <CardDescription>
            Chọn tệp CSV chứa dữ liệu sinh viên (cột: student_id, name, email)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-8 transition hover:border-gray-400">
            <Upload className="h-5 w-5 text-gray-600" />
            <span className="font-medium text-gray-700">
              {uploading ? 'Đang tải...' : 'Chọn tệp CSV'}
            </span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card className="rounded-none border">
        <CardHeader>
          <CardTitle>Lịch Sử Nhập</CardTitle>
          <CardDescription>
            {logs.length > 0 ? `${logs.length} bản ghi nhập` : 'Chưa có nhập nào'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-5 w-5 animate-spin text-gray-600" />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-gray-600">Chưa có lịch sử nhập</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-4 text-left font-semibold">Tệp</th>
                    <th className="py-3 px-4 text-center font-semibold">Tổng Hàng</th>
                    <th className="py-3 px-4 text-center font-semibold">Thành Công</th>
                    <th className="py-3 px-4 text-center font-semibold">Lỗi</th>
                    <th className="py-3 px-4 text-center font-semibold">Trùng</th>
                    <th className="py-3 px-4 text-center font-semibold">Trạng Thái</th>
                    <th className="py-3 px-4 text-left font-semibold">Thời Gian</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="truncate">{log.filename}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-semibold">{log.totalRows}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-semibold text-emerald-600">
                          {log.successCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-semibold text-red-600">
                          {log.errorCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-semibold text-amber-600">
                          {log.duplicateCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(log.status)}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {new Date(log.processedAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Details */}
      {allErrors.length > 0 && (
        <Card className="rounded-none border border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              Chi Tiết Lỗi
              <span className="ml-auto font-mono text-sm font-normal text-red-700">
                {allErrors.length} lỗi
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pageErrors.map((error) => (
                <div
                  key={`${error.logId}-${error.localIdx}`}
                  className="rounded bg-white p-3 font-mono text-xs"
                >
                  <div className="font-semibold text-red-600">
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

            {totalErrorPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-red-200 pt-4">
                <button
                  onClick={() => setErrorPage((p) => Math.max(0, p - 1))}
                  disabled={errorPage === 0}
                  className="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <span className="font-mono text-xs text-red-700">
                  {errorPage * PAGE_SIZE + 1}–{Math.min((errorPage + 1) * PAGE_SIZE, allErrors.length)} / {allErrors.length}
                </span>
                <button
                  onClick={() => setErrorPage((p) => Math.min(totalErrorPages - 1, p + 1))}
                  disabled={errorPage === totalErrorPages - 1}
                  className="flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
