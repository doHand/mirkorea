'use client'
import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth.api'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    username:        '',
    email:           '',
    fullName:        '',
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
    if (form.password.length < 4) {
      toast.error('비밀번호는 4자 이상 입력해주세요')
      return
    }
    setLoading(true)
    try {
      await authApi.register({
        username: form.username,
        email:    form.email,
        fullName: form.fullName,
        password: form.password,
      })
      toast.success('가입이 완료되었습니다. 로그인해주세요')
      router.push('/login')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? '회원가입에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-[#ede5d8] dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9b99e] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5efe6] via-[#faf7f2] to-[#ede5d8] flex items-center justify-center p-4">
      <div className="bg-[#fefdfb] dark:bg-gray-800 rounded-2xl shadow-xl border border-[#ede5d8] w-full max-w-md p-8">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">비밀번호</label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={patch('password')}
              placeholder="4자 이상"
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
            className="w-full py-2.5 mt-1 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-brand-600 hover:underline font-medium">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
