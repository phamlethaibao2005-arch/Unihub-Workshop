import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetDB,
  savePreload,
  getWorkshops,
  getTicketByQrCode,
  getTicketByRegistrationId,
  updateTicketCheckedIn,
  addPendingCheckin,
  getPendingCheckins,
  removePendingCheckin,
  getPendingCount,
  getHmacKey,
} from '../idb'
import type { WorkshopRecord, TicketRecord, PendingCheckinRecord } from '../idb'

const workshop1: WorkshopRecord = {
  id: 'ws-1',
  title: 'Intro to React',
  room: 'A101',
  startTime: '2024-01-01T09:00:00Z',
  endTime: '2024-01-01T11:00:00Z',
}

const ticket1: TicketRecord = {
  registrationId: 'reg-1',
  workshopId: 'ws-1',
  studentName: 'Alice',
  studentId: '22120001',
  qrCode: 'UNIHUB-reg-1-1715000000',
  qrSignature: 'abc123sig',
  checkedIn: false,
}

const ticket2: TicketRecord = {
  registrationId: 'reg-2',
  workshopId: 'ws-1',
  studentName: 'Bob',
  studentId: '22120002',
  qrCode: 'UNIHUB-reg-2-1715000001',
  qrSignature: 'def456sig',
  checkedIn: true,
}

beforeEach(async () => {
  resetDB()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('unihub-scan')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
})

describe('savePreload + getWorkshops', () => {
  it('returns saved workshops', async () => {
    await savePreload([workshop1], [ticket1], 'hmac-key-1')
    const ws = await getWorkshops()
    expect(ws).toHaveLength(1)
    expect(ws[0]).toEqual(workshop1)
  })

  it('clears old data on second preload', async () => {
    const ws2: WorkshopRecord = { id: 'ws-2', title: 'Vue Basics', room: 'B202', startTime: '2024-01-02T09:00:00Z', endTime: '2024-01-02T11:00:00Z' }
    await savePreload([workshop1], [ticket1], 'key-1')
    await savePreload([ws2], [ticket2], 'key-2')
    const ws = await getWorkshops()
    expect(ws).toHaveLength(1)
    expect(ws[0].id).toBe('ws-2')
  })
})

describe('getTicketByQrCode', () => {
  it('returns the matching ticket', async () => {
    await savePreload([workshop1], [ticket1, ticket2], 'hmac-key')
    const found = await getTicketByQrCode(ticket1.qrCode)
    expect(found).toEqual(ticket1)
  })

  it('returns undefined for unknown qr code', async () => {
    await savePreload([workshop1], [ticket1], 'hmac-key')
    expect(await getTicketByQrCode('UNKNOWN')).toBeUndefined()
  })
})

describe('getTicketByRegistrationId', () => {
  it('returns ticket by registration id', async () => {
    await savePreload([workshop1], [ticket1], 'hmac-key')
    const found = await getTicketByRegistrationId('reg-1')
    expect(found).toEqual(ticket1)
  })

  it('returns undefined for unknown id', async () => {
    await savePreload([workshop1], [], 'key')
    expect(await getTicketByRegistrationId('nonexistent')).toBeUndefined()
  })
})

describe('updateTicketCheckedIn', () => {
  it('marks a ticket as checked in', async () => {
    await savePreload([workshop1], [ticket1], 'key')
    await updateTicketCheckedIn('reg-1', true)
    const updated = await getTicketByRegistrationId('reg-1')
    expect(updated?.checkedIn).toBe(true)
  })

  it('does nothing for unknown registration id', async () => {
    await savePreload([workshop1], [ticket1], 'key')
    await expect(updateTicketCheckedIn('no-such-reg', true)).resolves.toBeUndefined()
  })
})

describe('pendingCheckins CRUD', () => {
  const pending: PendingCheckinRecord = {
    registrationId: 'reg-1',
    workshopId: 'ws-1',
    checkedInAt: '2024-01-01T10:00:00Z',
    deviceId: 'device-abc',
  }

  it('starts with zero pending', async () => {
    expect(await getPendingCount()).toBe(0)
  })

  it('addPendingCheckin increments count', async () => {
    await addPendingCheckin(pending)
    expect(await getPendingCount()).toBe(1)
  })

  it('getPendingCheckins returns added records', async () => {
    await addPendingCheckin(pending)
    const all = await getPendingCheckins()
    expect(all).toHaveLength(1)
    expect(all[0]).toEqual(pending)
  })

  it('removePendingCheckin decrements count', async () => {
    await addPendingCheckin(pending)
    await removePendingCheckin('reg-1')
    expect(await getPendingCount()).toBe(0)
  })

  it('adding same registrationId is idempotent (upsert)', async () => {
    await addPendingCheckin(pending)
    await addPendingCheckin({ ...pending, checkedInAt: '2024-01-01T11:00:00Z' })
    expect(await getPendingCount()).toBe(1)
  })
})

describe('getHmacKey', () => {
  it('returns undefined before preload', async () => {
    expect(await getHmacKey()).toBeUndefined()
  })

  it('returns the key after savePreload', async () => {
    await savePreload([workshop1], [ticket1], 'my-secret-key')
    expect(await getHmacKey()).toBe('my-secret-key')
  })
})
