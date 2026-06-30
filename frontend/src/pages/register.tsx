'use client'
import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth.api'
import { formatPhoneInput } from '@/utils/format'
import { getApiErrorMessage } from '@/utils/error'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    username:        '',
    email:           '',
    fullName:        '',
    phone:           '',
    password:        '',
    confirmPassword: '',
  })

  const patch = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다')
      return
    }
    if (form.password.length < 7 || !/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      toast.error('비밀번호는 영문·숫자 포함 7자 이상 입력해주세요')
      return
    }
    setLoading(true)
    try {
      await authApi.register({
        username: form.username,
        email:    form.email,
        fullName: form.fullName,
        phone:    form.phone || undefined,
        password: form.password,
      })
      toast.success('가입이 완료되었습니다. 로그인해주세요')
      router.push('/login')
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '회원가입에 실패했습니다'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-[#ede5d8] dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm'

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
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/30 w-full max-w-md p-8">
        <div className="text-center mb-7">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MK WMS</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">계정 만들기</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">아이디</label>
            <input
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={patch('username')}
              placeholder="영문/숫자, 4자 이상"
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이메일</label>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={patch('email')}
              placeholder="example@company.com"
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름</label>
            <input
              type="text"
              autoComplete="name"
              value={form.fullName}
              onChange={patch('fullName')}
              placeholder="실명을 입력해주세요"
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">연락처</label>
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))}
              inputMode="numeric"
              placeholder="010-0000-0000"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">비밀번호</label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={patch('password')}
              placeholder="영문·숫자 포함 7자 이상"
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">비밀번호 확인</label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={patch('confirmPassword')}
              placeholder="비밀번호를 다시 입력하세요"
              className={inputCls}
              required
            />
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-1 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-[var(--color-primary)] hover:underline font-medium">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
