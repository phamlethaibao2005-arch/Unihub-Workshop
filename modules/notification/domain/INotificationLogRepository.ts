export interface LogEntry {
  userId: string
  channel: string
  type: string
  status: 'SENT' | 'FAILED'
  errorMessage?: string
}

export interface INotificationLogRepository {
  log(entry: LogEntry): Promise<void>
}
