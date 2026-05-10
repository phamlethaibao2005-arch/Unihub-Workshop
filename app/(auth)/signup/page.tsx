'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { PillButton } from '@/components/PillButton'
import { signIn, signUp } from '@/lib/auth-client'

const schema = z.object({
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
})

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'github' | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = schema.safeParse({ name, email, password })
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      setErrors({
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      })
      return
    }
    setErrors({})
    setLoading(true)

    const { error } = await signUp.email({ name, email, password })
    if (error) {
      toast.error(error.message ?? 'Đăng ký thất bại')
      setLoading(false)
      return
    }

    router.push('/workshops')
  }

  const onSocial = async (provider: 'google' | 'github') => {
    setSocialLoading(provider)
    const { data, error } = await signIn.social({
      provider,
      callbackURL: '/workshops',
      newUserCallbackURL: '/workshops',
      errorCallbackURL: '/signup',
    })

    if (error) {
      toast.error(error.message ?? 'Đăng ký thất bại')
      setSocialLoading(null)
      return
    }

    if (data?.url) {
      window.location.href = data.url
      return
    }

    setSocialLoading(null)
  }

  return (
    <div className="py-12 px-2">
      <p className="text-[11px] uppercase tracking-[0.25em] text-ink/50 mb-4">
        UNIHUB / JOIN
      </p>

      <h1 className="font-display text-[48px] uppercase leading-[0.9] tracking-[-0.02em] text-ink mb-10">
        Tạo Tài Khoản
      </h1>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor="name">Họ và tên</FieldLabel>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-hairline rounded-[24px]"
            aria-invalid={!!errors.name}
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="email@sinh.vien.edu.vn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-hairline rounded-[24px]"
            aria-invalid={!!errors.email}
          />
          {errors.email && <FieldError>{errors.email}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Mật khẩu</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-hairline rounded-[24px]"
            aria-invalid={!!errors.password}
          />
          {errors.password && <FieldError>{errors.password}</FieldError>}
        </Field>

        <PillButton
          type="submit"
          variant="primary"
          disabled={loading}
          className="mt-2 w-full justify-center"
        >
          {loading ? 'Đang xử lý…' : 'Tạo Tài Khoản'} <ArrowRight className="w-4 h-4" />
        </PillButton>
      </form>

      <p className="mt-6 text-[13px] text-[#707072]">
        Đã có tài khoản?{' '}
        <Link href="/login" className="text-ink underline underline-offset-2">
          Đăng nhập
        </Link>
      </p>

      <div className="mt-8 flex items-center gap-4">
        <div className="flex-1 h-px bg-hairline" />
        <span className="text-[11px] uppercase tracking-[0.15em] text-[#9e9ea0]">hoặc</span>
        <div className="flex-1 h-px bg-hairline" />
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onSocial('google')}
          disabled={!!socialLoading}
          className="pill-ghost"
          aria-busy={socialLoading === 'google'}
        >
          <GoogleMark /> Google
        </button>
        <button
          type="button"
          onClick={() => onSocial('github')}
          disabled={!!socialLoading}
          className="pill-ghost"
          aria-busy={socialLoading === 'github'}
        >
          <GitHubMark /> GitHub
        </button>
      </div>
    </div>
  )
}
