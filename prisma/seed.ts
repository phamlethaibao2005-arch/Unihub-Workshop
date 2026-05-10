import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const db = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL!),
});

// Bcrypt-compatible hash for "password123" using Better-Auth's default cost 10.
// We pre-compute a real bcrypt hash to avoid importing bcrypt in the seed.
// Generated with: bcrypt.hashSync("password123", 10)
const PASSWORD_HASH =
  "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.";

function makeEmail(name: string) {
  return `${name.toLowerCase().replace(/ /g, ".")}@unihub.edu.vn`;
}

// Derive a stable cuid-like id from a string so re-runs are idempotent
function stableId(seed: string) {
  return "c" + createHash("md5").update(seed).digest("hex").slice(0, 24);
}

async function main() {
  console.log("Seeding database...");

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
      update: {},
      create: {
        id: stableId(`account:${u.name}`),
        accountId: email,
        providerId: "credential",
        userId: user.id,
        password: PASSWORD_HASH,
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
  console.log("🎉  Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
