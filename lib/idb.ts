import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

// ── Record types (also used by the scan page) ──────────────────────────────────

export interface WorkshopRecord {
  id: string
  title: string
  room: string
  startTime: string
  endTime: string
}

export interface TicketRecord {
  registrationId: string
  workshopId: string
  studentName: string
  studentId: string | null
  qrCode: string
  qrSignature: string | null
  checkedIn: boolean
}

export interface PendingCheckinRecord {
  registrationId: string // keyPath
  workshopId: string
  checkedInAt: string // ISO-8601
  deviceId: string
}

interface ConfigRecord {
  key: string
  value: string
}

// ── DB schema ──────────────────────────────────────────────────────────────────

interface ScanDB extends DBSchema {
  workshops: { key: string; value: WorkshopRecord }
  tickets: {
    key: string
    value: TicketRecord
    indexes: { 'by-qrCode': string }
  }
  pendingCheckins: { key: string; value: PendingCheckinRecord }
  config: { key: string; value: ConfigRecord }
}

// ── Singleton connection ───────────────────────────────────────────────────────

let _db: IDBPDatabase<ScanDB> | null = null

async function getDB(): Promise<IDBPDatabase<ScanDB>> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB not available')
  if (!_db) {
    _db = await openDB<ScanDB>('unihub-scan', 1, {
      upgrade(db) {
        db.createObjectStore('workshops', { keyPath: 'id' })
        const ticketStore = db.createObjectStore('tickets', { keyPath: 'registrationId' })
        ticketStore.createIndex('by-qrCode', 'qrCode', { unique: true })
        db.createObjectStore('pendingCheckins', { keyPath: 'registrationId' })
        db.createObjectStore('config', { keyPath: 'key' })
      },
    })
  }
  return _db
}

// Reset connection — used in tests to get a clean state between runs.
export function resetDB(): void {
  _db?.close()
  _db = null
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function savePreload(
  workshops: WorkshopRecord[],
  tickets: TicketRecord[],
  hmacKey: string,
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['workshops', 'tickets', 'config'], 'readwrite')
  const ws = tx.objectStore('workshops')
  const tk = tx.objectStore('tickets')
  const cfg = tx.objectStore('config')
  await ws.clear()
  await tk.clear()
  for (const w of workshops) await ws.put(w)
  for (const t of tickets) await tk.put(t)
  await cfg.put({ key: 'hmacKey', value: hmacKey })
  await tx.done
}

export async function getWorkshops(): Promise<WorkshopRecord[]> {
  return (await getDB()).getAll('workshops')
}

export async function getTicketByQrCode(qrCode: string): Promise<TicketRecord | undefined> {
  return (await getDB()).getFromIndex('tickets', 'by-qrCode', qrCode)
}

export async function getTicketByRegistrationId(id: string): Promise<TicketRecord | undefined> {
  return (await getDB()).get('tickets', id)
}

export async function updateTicketCheckedIn(
  registrationId: string,
  checkedIn: boolean,
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('tickets', 'readwrite')
  const ticket = await tx.store.get(registrationId)
  if (ticket) {
    ticket.checkedIn = checkedIn
    await tx.store.put(ticket)
  }
  await tx.done
}

export async function addPendingCheckin(record: PendingCheckinRecord): Promise<void> {
  await (await getDB()).put('pendingCheckins', record)
}

export async function getPendingCheckins(): Promise<PendingCheckinRecord[]> {
  return (await getDB()).getAll('pendingCheckins')
}

export async function removePendingCheckin(registrationId: string): Promise<void> {
  await (await getDB()).delete('pendingCheckins', registrationId)
}

export async function getPendingCount(): Promise<number> {
  return (await getDB()).count('pendingCheckins')
}

export async function getHmacKey(): Promise<string | undefined> {
  return (await (await getDB()).get('config', 'hmacKey'))?.value
}
