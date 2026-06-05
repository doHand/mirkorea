'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/auth.store'
import { authApi } from '@/api/auth.api'

const REMEMBER_KEY = 'wms-remember-id'

export default function LoginPage() {
  const router  = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm]           = useState({ username: '', password: '' })
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading]     = useState(false)

  // 저장된 아이디 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      setForm((p) => ({ ...p, username: saved }))
      setRememberMe(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.login(form.username, form.password)
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, form.username)
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }
      setAuth(res.user, res.accessToken, res.refreshToken)
      router.push('/')
    } catch {
      toast.error('아이디 또는 비밀번호를 확인해주세요')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-[#ede5d8] dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c9b99e] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5efe6] via-[#faf7f2] to-[#ede5d8] flex items-center justify-center p-4">
      <div className="bg-[#fefdfb] dark:bg-gray-800 rounded-2xl shadow-xl border border-[#ede5d8] w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MK WMS</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">창고 물류 관리 시스템</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">아이디</label>
            <input
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className={inputCls}
              placeholder="아이디를 입력하세요"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">비밀번호</label>
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className={inputCls}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          {/* 아이디 기억하기 */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded accent-[#c9b99e] cursor-pointer"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">아이디 기억하기</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#D2691E] text-white font-semibold rounded-lg hover:bg-[#b85a18] disabled:opacity-50 transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <Link href="/register" className="hover:text-[#D2691E] transition-colors">
            회원가입
          </Link>
          <Link href="/forgot-password" className="hover:text-[#D2691E] transition-colors">
            비밀번호 찾기
          </Link>
        </div>
      </div>
    </div>
  )
}
