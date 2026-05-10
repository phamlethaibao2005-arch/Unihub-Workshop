import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { db } from "@/shared/infrastructure/PrismaClient"

export const auth = betterAuth({
  appName: "UniHub Workshop",
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  user: {
    modelName: "User",
    additionalFields: {
      role: { type: "string" },
    },
  },
  session: {
    modelName: "Session",
    expiresIn: 60 * 60 * 24 * 7,
  },
  account: {
    modelName: "Account",
  },
  verification: {
    modelName: "Verification",
  },
})
