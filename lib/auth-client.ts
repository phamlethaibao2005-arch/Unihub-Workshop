import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient()

// Gọi khi bấm nút đăng nhập bằng Google
export const loginWithGoogle = async () => {
  await signIn.social({
    provider: "google",
    callbackURL: "/dashboard" // Redirect về trang này sau khi đăng nhập thành công
  })
}

// Gọi khi bấm nút đăng nhập bằng GitHub
export const loginWithGithub = async () => {
  await signIn.social({
    provider: "github",
    callbackURL: "/dashboard"
  })
}

export const { signIn, signUp, signOut, useSession } = authClient
