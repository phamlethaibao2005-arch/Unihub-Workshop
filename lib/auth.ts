import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { customSession } from "better-auth/plugins"
import { db } from "@/shared/infrastructure/PrismaClient"
import type { Role } from "@/modules/auth/domain/Role"

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
      role: {
        type: "string",
        defaultValue: "STUDENT",
        input: false,
      },
      studentId: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },

  session: {
    modelName: "Session",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },

  account: {
    modelName: "Account",
  },

  verification: {
    modelName: "Verification",
  },

  advanced: {
    cookies: {
      sessionToken: {
        attributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        },
      },
    },
  },

  plugins: [
    customSession(async (session) => {
      const u = session.user as typeof session.user & {
        role?: string
        studentId?: string | null
      }
      return {
        ...session,
        user: {
          ...session.user,
          role: (u.role ?? "STUDENT") as Role,
          studentId: (u.studentId ?? null) as string | null,
        },
      }
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
