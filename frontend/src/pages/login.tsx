'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/stores/auth.store'
import { authApi } from '@/api/auth.api'

const REMEMBER_KEY = 'wms-remember-id'
const loginSchema = z.object({
  username: z.string().trim().min(1, '아이디를 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router  = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [rememberMe, setRememberMe] = useState(false)
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  // 저장된 아이디 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      setValue('username', saved)
      setRememberMe(true)
    }
  }, [setValue])

  const onSubmit = async (form: LoginForm) => {
    try {
      const res = await authApi.login(form.username, form.password)
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, form.username)
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }
      setAuth(res.user)
      router.push('/')
    } catch {
      toast.error('아이디 또는 비밀번호를 확인해주세요')
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-[#ede5d8] dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500'

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url('/login-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* 배경 어둠 오버레이 */}
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/30 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-green-800 dark:text-white">MIRKOREA WMS</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">창고 물류 관리 시스템</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">아이디</label>
            <input
              type="text"
              autoComplete="username"
              {...register('username')}
              className={inputCls}
              placeholder="아이디를 입력하세요"
              required
            />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">비밀번호</label>
            <input
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className={inputCls}
              placeholder="비밀번호를 입력하세요"
              required
            />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>

          {/* 아이디 기억하기 */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">아이디 기억하기</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <Link href="/register" className="hover:text-[var(--color-primary)] transition-colors">
            회원가입
          </Link>
          <Link href="/forgot-password" className="hover:text-[var(--color-primary)] transition-colors">
            비밀번호 찾기
          </Link>
        </div>
      </div>
    </div>
  )
}
