'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { userApi } from '@/api/user.api'
import { useAuthStore } from '@/stores/auth.store'
import { formatDate, formatDateTime, formatPhoneInput } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { UserRole } from '@/types/api.types'

const ROLE_META: Record<UserRole, { label: string; cls: string }> = {
  ADMIN:   { label: '관리자',      cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  MANAGER: { label: '창고 관리자', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  WORKER:  { label: '작업자',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  VIEWER:  { label: '조회 전용',   cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}

export default function ProfilePage() {
  const qc       = useQueryClient()
  const { user: authUser, setUser } = useAuthStore()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')

  const { data: me, isLoading } = useQuery({
    queryKey: ['users', 'me'],
    queryFn:  userApi.getMe,
  })

  useEffect(() => {
    if (me) {
      setFullName(me.fullName)
      setEmail(me.email)
      setPhone(me.phone ?? '')
    }
  }, [me])

  const updateMutation = useMutation({
    mutationFn: () => userApi.updateMe({
      fullName: fullName !== me?.fullName ? fullName : undefined,
      email: email !== me?.email ? email : undefined,
      phone: phone !== (me?.phone ?? '') ? phone : undefined,
      password: password || undefined,
    }),
    onSuccess: (updated) => {
      toast.success('계정 정보가 수정되었습니다')
      qc.invalidateQueries({ queryKey: ['users', 'me'] })
      if (authUser) setUser({ ...authUser, fullName: updated.fullName })
      setPassword('')
      setConfirm('')
    },
    onError: () => toast.error('수정 실패'),
  })

  const handleSave = () => {
    if (!fullName.trim()) { toast.error('이름을 입력하세요'); return }
    if (!email.trim()) { toast.error('이메일을 입력하세요'); return }
    if (password && password !== confirm) { toast.error('비밀번호가 일치하지 않습니다'); return }
    if (password && (password.length < 7 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))) { toast.error('비밀번호는 영문·숫자 포함 7자 이상이어야 합니다'); return }
    updateMutation.mutate()
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">로딩 중...</div>
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">내 계정</h2>
      </div>

      {/* 계정 정보 카드 */}
      <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-2xl shrink-0">
            {me?.fullName?.charAt(0) ?? 'U'}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-lg">{me?.fullName}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">@{me?.username}</p>
            <span className={cn('inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium', ROLE_META[me?.role ?? 'WORKER'].cls)}>
              {ROLE_META[me?.role ?? 'WORKER'].label}
            </span>
          </div>
        </div>

        {/* 읽기 전용 정보 */}
        <div className="space-y-3 mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-gray-500 dark:text-gray-400">아이디</span>
            <span className="font-mono text-gray-900 dark:text-gray-100">{me?.username}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-gray-500 dark:text-gray-400">입사일</span>
            <span className="text-gray-900 dark:text-gray-100">{me?.hireDate ? formatDate(me.hireDate) : '-'}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-gray-500 dark:text-gray-400">마지막 로그인</span>
            <span className="text-gray-900 dark:text-gray-100">
              {me?.lastLoginAt ? formatDateTime(me.lastLoginAt) : '-'}
            </span>
          </div>
        </div>

        {/* 수정 가능 필드 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              이름
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              연락처
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              inputMode="numeric"
              placeholder="010-0000-0000"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1">
              비밀번호 변경 (변경 시에만 입력)
            </p>
            <div className="space-y-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="영문·숫자 포함 7자 이상"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="새 비밀번호 확인"
                className={cn(
                  'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500',
                  confirm && password !== confirm
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-gray-200 dark:border-gray-600 focus:ring-brand-500'
                )}
              />
              {confirm && password !== confirm && (
                <p className="text-xs text-red-500">비밀번호가 일치하지 않습니다</p>
              )}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
              {updateMutation.isPending ? '저장 중...' : '변경 사항 저장'}
          </button>
        </div>
      </div>

      {/* 권한/보안 정보 */}
      <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">권한 정보</p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          역할은 관리자만 변경할 수 있습니다. 권한 변경이 필요하면 시스템 관리자에게 문의하세요.
        </p>
      </div>
    </div>
  )
}
