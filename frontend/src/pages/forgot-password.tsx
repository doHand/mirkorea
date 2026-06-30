'use client'
import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth.api'
import { getApiErrorMessage } from '@/utils/error'

export default function ForgotPasswordPage() {
  const router  = useRouter()
  const [step, setStep]       = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [identity, setIdentity] = useState({ username: '', email: '' })
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' })

  const patchIdentity = (key: keyof typeof identity) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setIdentity((p) => ({ ...p, [key]: e.target.value }))
  const patchPasswords = (key: keyof typeof passwords) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setPasswords((p) => ({ ...p, [key]: e.target.value }))

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (!identity.username.trim() || !identity.email.trim()) {
      toast.error('아이디와 이메일을 입력해주세요')
      return
    }
    setStep(2)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다')
      return
    }
    if (passwords.newPassword.length < 7 || !/[a-zA-Z]/.test(passwords.newPassword) || !/[0-9]/.test(passwords.newPassword)) {
      toast.error('비밀번호는 영문·숫자 포함 7자 이상 입력해주세요')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword({
        username:    identity.username,
        email:       identity.email,
        newPassword: passwords.newPassword,
      })
      toast.success('비밀번호가 재설정되었습니다')
      router.push('/login')
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, '비밀번호 재설정에 실패했습니다')
      if (msg.includes('인증') || msg.includes('올바르지')) {
        toast.error('아이디 또는 이메일이 일치하지 않습니다')
        setStep(1)
      } else {
        toast.error(msg)
      }
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">비밀번호 찾기</p>
        </div>

        {/* 단계 표시 */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map((n) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                step >= n
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
              }`}>
                {n}
              </div>
              <span className={`text-xs ${step >= n ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                {n === 1 ? '본인 확인' : '비밀번호 변경'}
              </span>
              {n < 2 && <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* 1단계: 본인 확인 */}
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              가입 시 등록한 아이디와 이메일을 입력하세요.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">아이디</label>
              <input
                type="text"
                value={identity.username}
                onChange={patchIdentity('username')}
                placeholder="아이디를 입력하세요"
                className={inputCls}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이메일</label>
              <input
                type="email"
                value={identity.email}
                onChange={patchIdentity('email')}
                placeholder="가입 시 이메일을 입력하세요"
                className={inputCls}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 mt-1 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              다음
            </button>
          </form>
        )}

        {/* 2단계: 새 비밀번호 */}
        {step === 2 && (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              사용할 새 비밀번호를 입력하세요.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">새 비밀번호</label>
              <input
                type="password"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={patchPasswords('newPassword')}
                placeholder="영문·숫자 포함 7자 이상"
                className={inputCls}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">비밀번호 확인</label>
              <input
                type="password"
                autoComplete="new-password"
                value={passwords.confirmPassword}
                onChange={patchPasswords('confirmPassword')}
                placeholder="비밀번호를 다시 입력하세요"
                className={inputCls}
                required
              />
              {passwords.confirmPassword && passwords.newPassword !== passwords.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다</p>
              )}
            </div>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => { setStep(1); setPasswords({ newPassword: '', confirmPassword: '' }) }}
                className="flex-1 py-2.5 border border-[#ede5d8] dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors text-sm"
              >
                {loading ? '처리 중...' : '비밀번호 재설정'}
              </button>
            </div>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          <Link href="/login" className="text-[var(--color-primary)] hover:underline font-medium">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  )
}
