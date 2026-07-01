'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth.api'
import { getApiErrorMessage } from '@/utils/error'

type Step = 'username' | 'answer' | 'done'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep]             = useState<Step>('username')
  const [username, setUsername]     = useState('')
  const [question, setQuestion]     = useState('')
  const [answer, setAnswer]         = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]       = useState(false)

  const inputCls = 'w-full px-3 py-2 border border-[#ede5d8] dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm'

  const handleFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const q = await authApi.getSecurityQuestion(username.trim())
      setQuestion(q)
      setStep('answer')
    } catch {
      toast.error('아이디 또는 비밀번호를 확인해주세요')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다')
      return
    }
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('비밀번호는 영문·숫자 포함 8자 이상 입력해주세요')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPasswordByAnswer({ username: username.trim(), answer: answer.trim(), newPassword })
      setStep('done')
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '답변이 올바르지 않습니다'))
    } finally {
      setLoading(false)
    }
  }

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

        {step === 'username' && (
          <form onSubmit={handleFetchQuestion} className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              가입 시 등록한 아이디를 입력하면 보안 질문을 확인할 수 있습니다.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">아이디</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                className={inputCls}
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-1 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {loading ? '확인 중...' : '다음'}
            </button>
          </form>
        )}

        {step === 'answer' && (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">보안 질문</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{question}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">답변</label>
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="가입 시 등록한 답변을 입력하세요"
                className={inputCls}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">새 비밀번호</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="영문·숫자 포함 8자 이상"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">새 비밀번호 확인</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                className={inputCls}
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('username')}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors text-sm"
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">비밀번호가 변경되었습니다</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">새 비밀번호로 로그인해주세요</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-2.5 bg-[var(--color-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors text-sm"
            >
              로그인하러 가기
            </button>
          </div>
        )}

        {step !== 'done' && (
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            <Link href="/login" className="text-[var(--color-primary)] hover:underline font-medium">
              로그인으로 돌아가기
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
