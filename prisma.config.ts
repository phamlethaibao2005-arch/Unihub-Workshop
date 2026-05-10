import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  // DIRECT_URL bypasses the Neon pooler — required for Prisma Migrate DDL
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
