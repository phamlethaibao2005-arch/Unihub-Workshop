import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHash, createHmac } from "crypto";
import { hashPassword } from "@better-auth/utils/password";

const db = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL!),
});

const SEED_PASSWORD = "password123";

function makeEmail(name: string) {
  return `${name.toLowerCase().replace(/ /g, ".")}@unihub.edu.vn`;
}

// Derive a stable cuid-like id from a string so re-runs are idempotent
function stableId(seed: string) {
  return "c" + createHash("md5").update(seed).digest("hex").slice(0, 24);
}

function generateQR(registrationId: string): { qrCode: string; qrSignature: string } {
  const secret = process.env.QR_HMAC_SECRET!;
  // Use a fixed timestamp so the seed is idempotent
  const ts = 1000000000000;
  const qrCode = `UNIHUB-${registrationId}-${ts}`;
  const qrSignature = createHmac("sha256", secret).update(qrCode).digest("hex");
  return { qrCode, qrSignature };
}

async function main() {
  console.log("Seeding database...");
  const passwordHash = await hashPassword(SEED_PASSWORD);

  // ─── Users ─────────────────────────────────────────────────────────────────
  const users = [
    { name: "Admin Organizer", role: "ORGANIZER" as const, studentId: null },
    { name: "Staff One", role: "CHECKIN_STAFF" as const, studentId: null },
    { name: "Staff Two", role: "CHECKIN_STAFF" as const, studentId: null },
    { name: "Nguyen Van A", role: "STUDENT" as const, studentId: "22000001" },
    { name: "Tran Thi B", role: "STUDENT" as const, studentId: "22000002" },
    { name: "Le Van C", role: "STUDENT" as const, studentId: "22000003" },
    { name: "Pham Thi D", role: "STUDENT" as const, studentId: "22000004" },
    { name: "Hoang Van E", role: "STUDENT" as const, studentId: "22000005" },
  ];

  for (const u of users) {
    const id = stableId(`user:${u.name}`);
    const email = makeEmail(u.name);

    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        id,
        email,
        name: u.name,
        emailVerified: true,
        role: u.role,
        studentId: u.studentId ?? undefined,
      },
    });

    // Create password account so Better-Auth can authenticate
    await db.account.upsert({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: email,
        },
      },
      update: {
        password: passwordHash,
      },
      create: {
        id: stableId(`account:${u.name}`),
        accountId: email,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });
  }

  console.log(`Created ${users.length} users`);

  // ─── Workshops ─────────────────────────────────────────────────────────────
  const organizer = await db.user.findFirst({ where: { role: "ORGANIZER" } });
  if (!organizer) throw new Error("Organizer not found");

  const now = new Date();
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d;
  };
  const time = (base: Date, hour: number, minute = 0) => {
    const d = new Date(base);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const workshops = [
    // ── Free workshops ──────────────────────────────────────────────────────
    {
      title: "Next-Gen AI Pipelines",
      description:
        "Khám phá cách xây dựng pipeline AI hiện đại với LLM, vector DB, và RAG từ đầu đến cuối.",
      speaker: "Dr. Trần Minh Quân",
      room: "Hall A / Innovation Lab",
      date: day(1),
      startTime: time(day(1), 9, 0),
      endTime: time(day(1), 11, 0),
      maxCapacity: 60,
      price: 0,
      cover:
        "https://images.unsplash.com/photo-1491895200222-0fc4a4c35e18?w=800&q=80",
    },
    {
      title: "Clean Architecture trong Thực Tế",
      description:
        "Từ domain model đến REST API — áp dụng Clean Architecture trong dự án Next.js thực tế.",
      speaker: "Lê Hữu Phong",
      room: "Room B2 / Engineering Block",
      date: day(2),
      startTime: time(day(2), 14, 0),
      endTime: time(day(2), 16, 30),
      maxCapacity: 40,
      price: 0,
      cover:
        "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&q=80",
    },
    {
      title: "UX Research cho Sinh Viên",
      description:
        "Phương pháp nghiên cứu người dùng và usability testing dành cho các nhóm product nhỏ.",
      speaker: "Nguyễn Hà Linh",
      room: "Design Studio / Floor 3",
      date: day(3),
      startTime: time(day(3), 13, 0),
      endTime: time(day(3), 15, 0),
      maxCapacity: 30,
      price: 0,
      cover:
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80",
    },
    // ── Paid workshops ──────────────────────────────────────────────────────
    {
      title: "System Design Interview Masterclass",
      description:
        "Luyện tập thiết kế hệ thống quy mô lớn — từ rate limiting đến distributed caching.",
      speaker: "Vũ Quốc Anh (Ex-Meta)",
      room: "Auditorium / Main Building",
      date: day(4),
      startTime: time(day(4), 9, 0),
      endTime: time(day(4), 12, 0),
      maxCapacity: 80,
      price: 150000,
      cover:
        "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80",
    },
    {
      title: "Fullstack với Supabase & Next.js 16",
      description:
        "Workshop thực hành: xây dựng SaaS MVP trong 3 giờ với Supabase, Drizzle, và shadcn/ui.",
      speaker: "Phạm Thị Ngọc",
      room: "Lab 201 / Tech Hub",
      date: day(5),
      startTime: time(day(5), 14, 0),
      endTime: time(day(5), 17, 0),
      maxCapacity: 25,
      price: 200000,
      cover:
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
    },
    {
      title: "Blockchain & Web3 cho Developers",
      description:
        "Solidity từ cơ bản đến nâng cao — viết và deploy smart contract trên Ethereum testnet.",
      speaker: "Đặng Minh Khoa",
      room: "Room C5 / Innovation Hub",
      date: day(6),
      startTime: time(day(6), 10, 0),
      endTime: time(day(6), 13, 0),
      maxCapacity: 35,
      price: 100000,
      cover:
        "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80",
    },
  ];

  for (const w of workshops) {
    const id = stableId(`workshop:${w.title}`);
    await db.workshop.upsert({
      where: { id },
      update: {},
      create: {
        id,
        title: w.title,
        description: w.description,
        speaker: w.speaker,
        room: w.room,
        date: w.date,
        startTime: w.startTime,
        endTime: w.endTime,
        maxCapacity: w.maxCapacity,
        price: w.price,
        status: "ACTIVE",
        createdBy: organizer.id,
      },
    });
  }

  console.log(`✅  Created ${workshops.length} workshops (3 free, 3 paid)`);

  // ─── Today's workshops for check-in testing ─────────────────────────────────
  // Use update:{} so dates stay pinned to "today" on each re-run.
  const todayWorkshops = [
    {
      title: "Thiết Kế Giao Diện với Figma",
      description: "Từ wireframe đến prototype — kỹ năng Figma thực chiến cho developer và designer.",
      speaker: "Trương Ngọc Hân",
      room: "Room B101 / Design Studio",
      startHour: 8, endHour: 10,
      maxCapacity: 40,
      price: 0,
    },
    {
      title: "DevOps & CI/CD Thực Hành",
      description: "Dựng pipeline GitHub Actions, Docker, và deploy lên VPS trong 2.5 giờ thực hành.",
      speaker: "Ngô Quốc Hùng",
      room: "Room C201 / Server Lab",
      startHour: 13, endHour: 16,
      maxCapacity: 35,
      price: 0,
    },
    {
      title: "API Design & OpenAPI 3.0",
      description: "Thiết kế RESTful API chuẩn — contract-first với OpenAPI, Zod, và type-safe clients.",
      speaker: "Đinh Thị Mai",
      room: "Room D301 / Tech Hub",
      startHour: 16, endHour: 18,
      maxCapacity: 30,
      price: 0,
    },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayIds: string[] = [];
  for (const w of todayWorkshops) {
    const id = stableId(`workshop:${w.title}`);
    todayIds.push(id);
    const startTime = new Date(today);
    startTime.setHours(w.startHour, 0, 0, 0);
    const endTime = new Date(today);
    endTime.setHours(w.endHour, 0, 0, 0);
    await db.workshop.upsert({
      where: { id },
      // Re-pin the date every seed run so it stays "today"
      update: { date: today, startTime, endTime },
      create: {
        id,
        title: w.title,
        description: w.description,
        speaker: w.speaker,
        room: w.room,
        date: today,
        startTime,
        endTime,
        maxCapacity: w.maxCapacity,
        price: w.price,
        status: "ACTIVE",
        createdBy: organizer.id,
      },
    });
  }

  console.log(`✅  Created/updated ${todayWorkshops.length} today's workshops`);

  // ─── Seed registrations with QR codes ───────────────────────────────────────
  // Give every student a CONFIRMED registration (with QR) for each today's workshop
  // so staff can scan them immediately after seeding.
  const students = await db.user.findMany({ where: { role: "STUDENT" } });

  let regCount = 0;
  for (const workshopId of todayIds) {
    let registered = 0;
    for (const student of students) {
      const regId = stableId(`reg:${student.id}:${workshopId}`);
      const { qrCode, qrSignature } = generateQR(regId);

      const existing = await db.registration.findFirst({
        where: { userId: student.id, workshopId },
      });
      if (!existing) {
        await db.registration.create({
          data: {
            id: regId,
            userId: student.id,
            workshopId,
            status: "CONFIRMED",
            qrCode,
            qrSignature,
          },
        });
        registered++;
        regCount++;
      }
    }
    // Keep currentRegistrations in sync
    if (registered > 0) {
      await db.workshop.update({
        where: { id: workshopId },
        data: { currentRegistrations: { increment: registered } },
      });
    }
  }

  console.log(`✅  Created ${regCount} student registrations with QR codes`);
  console.log("🎉  Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
