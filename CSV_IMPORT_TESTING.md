# CSV Import Feature Testing Guide

## Overview
The CSV import feature allows administrators to bulk import student data into the UniHub Workshop system. It supports both automatic cron-based imports (daily at 2:00 AM) and manual uploads via the admin dashboard.

## Architecture

### Components
1. **BaseImportJob** (`modules/csv-import/application/BaseImportJob.ts`)
   - Abstract Template Method pattern implementation
   - Orchestrates: readRows → validateRow → processRow → emitLog
   - Handles per-row error catching and counting

2. **StudentCSVImportJob** (`modules/csv-import/application/StudentCSVImportJob.ts`)
   - Concrete implementation for student CSV data
   - Validates: student_id (8 digits), name (non-empty), email (valid format)
   - Batches upserts 100 rows per database transaction

3. **Routes**
   - `/api/cron/csv-import` - Vercel cron job (2:00 AM daily)
   - `/api/queue/csv-import` - QStash worker (processes enqueued jobs)
   - `/api/admin/csv-import` - Admin API (GET logs, POST file upload)
   - `/admin/csv-import` - Admin UI (file picker + history table)

### Database
- **CsvImportLog** table records import results
- Fields: id, filename, totalRows, successCount, errorCount, duplicateCount, errorDetails (JSON), status

## Testing the Feature

### Test 1: File Structure & Expected Data
A sample test file is provided at: `data/csv-import/incoming/sample.csv`

**File Contents:**
```csv
student_id,name,email
21520123,Nguyễn Văn A,nguyenvana@student.hcmus.edu.vn
21520124,Trần Thị B,tranthib@student.hcmus.edu.vn
21520125,Phạm Minh C,phamminhc@student.hcmus.edu.vn
21520126,Hoàng Quốc D,hoangquocd@student.hcmus.edu.vn
21520127,Vũ Kim E,vukime@student.hcmus.edu.vn
21520128,Lê Anh F,leanhf@student.hcmus.edu.vn
21520129,Bùi Ngọc G,buingocg@student.hcmus.edu.vn
21520130,Đặng Hương H,danghhuong@student.hcmus.edu.vn
21520131,Cao Văn I,caovani@student.hcmus.edu.vn
21520132,Võ Thị J,vothij@student.hcmus.edu.vn
2152013,Invalid K,invalidk@student.hcmus.edu.vn          # INVALID: Only 7 digits
21520133,,nonamestudent@student.hcmus.edu.vn              # INVALID: Empty name
```

**Expected Results:**
- totalRows: 12
- successCount: 10 (rows 1-10)
- errorCount: 2 (rows 11-12)
- duplicateCount: 0
- status: PARTIAL

### Test 2: Manual Admin Trigger

**Steps:**
1. Navigate to `/admin/csv-import` (requires ORGANIZER role)
2. Click file upload input
3. Select `sample.csv` from `data/csv-import/incoming/`
4. Observe upload status & automatic processing

**Expected Behavior:**
- File is received and moved to `processing/` folder
- Job is enqueued to QStash
- Import processes (should take <5 seconds in local dev)
- Results appear in the history table:
  - Filename: `{timestamp}_sample.csv`
  - Total: 12
  - Success: 10 (green text)
  - Error: 2 (red text)
  - Duplicate: 0 (amber text)
  - Status: PARTIAL badge
- File is moved to `processed/{date}_sample.csv`

### Test 3: Automatic Cron Trigger

**For local testing (emulate cron):**
```bash
# Manually call the cron endpoint
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/csv-import

# Response:
# {
#   "message": "CSV import jobs enqueued",
#   "filesProcessed": 1,
#   "jobs": [
#     {
#       "filename": "sample.csv",
#       "messageId": "msg_..."
#     }
#   ]
# }
```

**In Production:**
- Vercel automatically invokes at 2:00 AM UTC daily
- Set `CRON_SECRET` env var to enable verification

### Test 4: Database Verification

After successful import, verify students are in the database:

```sql
SELECT COUNT(*) FROM "User" 
WHERE role = 'STUDENT' 
  AND "studentId" IN ('21520123', '21520124', ..., '21520132');
-- Should return: 10

SELECT * FROM "User" 
WHERE "studentId" = '21520123';
-- Should show:
-- studentId: 21520123
-- name: Nguyễn Văn A
-- email: nguyenvana@student.hcmus.edu.vn
-- role: STUDENT
```

### Test 5: Error Handling Scenarios

#### Scenario A: Duplicate Student ID (Update)
1. Create a second CSV with same student_id but different name/email
2. Upload both files
3. Second import should UPDATE the existing student (increment successCount, not duplicateCount)
4. Verify only 1 student record exists in DB

#### Scenario B: Missing Header Column
1. Create CSV without `student_id` column
2. Upload
3. Import should FAIL with status: FAILED
4. Error message: "Missing required columns: student_id"

#### Scenario C: Empty File
1. Create empty CSV with only headers
2. Upload
3. Import should succeed with totalRows=0, successCount=0, status=FAILED

#### Scenario D: Large File (100+ rows)
1. Create CSV with 1000+ valid rows
2. Upload
3. Job should batch process (100 rows per DB call)
4. Should complete in <60 seconds

### Test 6: Concurrent Import Prevention

**Expected Behavior:**
- If an import is running and another job is enqueued
- Second job should receive 200 response immediately (queued state)
- Job executes only when lock releases (10 minute TTL or after first job completes)

**To Test:**
1. Upload large CSV (1000+ rows)
2. While processing, upload another CSV
3. Check QStash logs - second job should complete after first

### Test 7: File Movement

**Expected Directory States:**

**Before Import:**
```
data/csv-import/
├── incoming/
│   └── sample.csv  ← User/cron places file here
├── processing/
└── processed/
```

**During Import:**
```
data/csv-import/
├── incoming/       ← Empty
├── processing/
│   └── sample.csv  ← Cron/API moves here
└── processed/
```

**After Import:**
```
data/csv-import/
├── incoming/
├── processing/     ← Empty
└── processed/
    └── 2024-01-15_sample.csv  ← Worker moves here with timestamp prefix
```

## Acceptance Criteria Verification

| Criterion | Test | Expected Result |
|-----------|------|-----------------|
| Cron runs at 2:00 AM | Setup & wait OR manually trigger | Files in incoming/ are processed |
| No file → no error | Place no CSV in incoming/ | Log info only, system stable |
| Valid CSV → upsert | Upload 10 valid rows | All 10 students in DB, can register |
| Duplicate ID → update | Upload same student ID twice | 1 DB record, name/email updated |
| Invalid rows → skip | Upload 10 valid + 2 invalid | Success=10, error=2, partial status |
| Bad header → fail | Upload CSV missing column | status=FAILED, import stops |
| Empty file → fail | Upload 0 data rows | totalRows=0, status=FAILED |
| Concurrent runs → serial | Upload 2 files <5s apart | Both complete, no race condition |
| Admin dashboard shows logs | Login as ORGANIZER, visit /admin/csv-import | All imports visible with badges |
| File moved to processed | Check directory after import | File in processed/ with timestamp |

## Environment Variables

Required for testing:
```env
DATABASE_URL=postgresql://...
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...
CRON_SECRET=your-cron-secret  # Optional, for cron auth
NEXT_PUBLIC_APP_URL=http://localhost:3000  # For local QStash URL routing
```

## Debugging

### Check Job Status
```bash
# View import logs in database
SELECT * FROM "CsvImportLog" 
ORDER BY "processedAt" DESC 
LIMIT 5;
```

### View Server Logs
- Docker/CLI: `npm run dev` outputs all console.log from API routes
- Look for: `[CSV Import Cron]`, `[CSV Import Queue]`, `[CSV Import API]` prefixes

### Verify QStash Integration
- Visit [Upstash Console](https://console.upstash.com)
- Check QStash logs tab for job delivery confirmations

### Test Locally Without QStash
For development, you can test the job classes directly:
```typescript
import { StudentCSVImportJob } from '@/modules/csv-import/application/StudentCSVImportJob';

const job = new StudentCSVImportJob();
const result = await job.run('sample.csv');
console.log(result);
```

## Notes for Production

1. **Timezone**: Cron schedule "0 2 * * *" is in UTC. Adjust if needed.
2. **Rate Limiting**: Job runs sequentially (lock prevents concurrent execution)
3. **Error Recovery**: Failed rows are logged but don't block other rows
4. **Audit Trail**: Every import creates a CsvImportLog record for compliance
5. **Data Validation**: Email and student_id are final; duplicates update existing records
