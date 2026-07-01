'use client'

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Barcode,
  BookOpen,
  ClipboardCheck,
  FileSpreadsheet,
  Keyboard,
  Package,
  Printer,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type GuideSection = {
  title: string
  description: string
  icon: LucideIcon
  items: string[]
}

type Shortcut = {
  keys: string[]
  action: string
  scope: string
}

const workflowSections: GuideSection[] = [
  {
    title: '처음 확인할 것',
    description: '운영 전에 기준정보와 창고 위치를 먼저 맞춥니다.',
    icon: Settings,
    items: [
      '창고/위치에서 구역과 로케이션을 등록합니다.',
      '상품 마스터에서 상품·단위·거래처·기본 위치를 관리합니다.',
      '사용자 관리와 메뉴 권한에서 역할별 접근 범위를 확인합니다.',
    ],
  },
  {
    title: '입고 흐름',
    description: '발주 또는 수기 등록 후 입고 예정과 검수를 처리합니다.',
    icon: ArrowDownToLine,
    items: [
      '출력서류 관리에서 발주서를 만들고 입고 예정으로 전환합니다.',
      '입고 관리에서 수량·불량·입고 위치·LOT 정보를 입력합니다.',
      '입고 완료 후 재고와 거래 이력을 확인합니다.',
    ],
  },
  {
    title: '출고 흐름',
    description: '수집, 지시, 피킹, 출고 확정 순서로 처리합니다.',
    icon: ArrowUpFromLine,
    items: [
      '출고 관리에서 수집 주문을 등록하거나 외부 주문을 확인합니다.',
      '피킹 리스트를 출력하고 작업 완료 수량을 반영합니다.',
      '출고 확정 후 재고 차감과 이력이 정상 반영됐는지 확인합니다.',
    ],
  },
  {
    title: '재고 점검',
    description: '재고 조회, 이동, 실사로 현재 수량을 보정합니다.',
    icon: ClipboardCheck,
    items: [
      '상품 관리와 가격 재고현황에서 거래처별 재고를 확인합니다.',
      '창고/위치에서 위치별 재고 이동을 처리합니다.',
      '재고조사에서 실사 수량을 입력하고 차이를 확정합니다.',
    ],
  },
]

const screenSections: GuideSection[] = [
  {
    title: '상품 관리',
    description: '상품 기본정보, 바코드, 단위 환산, 거래처별 품목',
    icon: Package,
    items: ['상품 추가/수정', '바코드 관리', '엑셀 가져오기/내보내기', '안전재고 확인'],
  },
  {
    title: '바코드 스캔',
    description: '현장 스캔으로 입고·출고·조회·이동을 빠르게',
    icon: Barcode,
    items: ['스캔 모드 선택', '바코드 조회', '입출고 수량 입력', '위치 이동'],
  },
  {
    title: '창고/위치',
    description: '구역, 위치, 적치/피킹 우선순위, 위치별 재고',
    icon: Warehouse,
    items: ['구역 등록', '위치 일괄 생성', '재고 이동', '전략 설정'],
  },
  {
    title: '출력서류',
    description: '견적서, 거래명세서, 발주서, 피킹 문서 출력',
    icon: Printer,
    items: ['문서 작성', '출력 제목 선택', '거래처 자동 매칭', '일괄 출력'],
  },
  {
    title: '엑셀',
    description: '템플릿을 내려받아 대량으로 가져오거나 내보내기',
    icon: FileSpreadsheet,
    items: ['템플릿 다운로드', '대량 가져오기', '목록 내보내기', '오류 행 확인'],
  },
  {
    title: '권한',
    description: '역할에 따라 메뉴 접근과 관리 기능을 분리',
    icon: ShieldCheck,
    items: ['사용자 등록', '역할 색상 관리', '메뉴별 역할 설정', '감사 로그 확인'],
  },
]

const shortcuts: Shortcut[] = [
  { keys: ['Ctrl', 'S'], action: '그리드 저장', scope: '편집 그리드' },
  { keys: ['Ctrl', 'N'], action: '새 행 추가', scope: '편집 그리드' },
  { keys: ['Delete'], action: '선택 행 삭제', scope: '편집 그리드' },
  { keys: ['F2'], action: '셀 편집 시작', scope: '편집 그리드' },
  { keys: ['Esc'], action: '편집 취소 / 창 닫기', scope: '모달, 그리드' },
  { keys: ['Ctrl', 'Z'], action: '셀 편집 되돌리기', scope: 'AG Grid' },
  { keys: ['Ctrl', 'Y'], action: '셀 편집 다시 실행', scope: 'AG Grid' },
]

const tips = [
  '대시보드 바로가기는 로그인 역할에 맞춰 자주 쓰는 메뉴를 보여줍니다.',
  '목록 화면에서 조건 변경 후 검색 버튼을 눌러야 결과가 갱신됩니다.',
  '편집 그리드는 저장 버튼을 눌러야 서버에 반영됩니다.',
  '출력 버튼이 반응하지 않으면 브라우저 팝업 차단을 확인합니다.',
  '엑셀 가져오기는 템플릿의 헤더명을 그대로 유지해야 합니다.',
]

function Keycap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
      {children}
    </kbd>
  )
}

function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <Icon size={13} className="text-gray-400 dark:text-gray-500" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {children}
      </span>
    </div>
  )
}

function WorkflowCard({ section }: { section: GuideSection }) {
  const Icon = section.icon
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Icon size={14} />
        </span>
        <div>
          <h3 className="text-xs font-bold text-gray-900 dark:text-white">{section.title}</h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">{section.description}</p>
        </div>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {section.items.map((item) => (
          <li key={item} className="flex gap-1.5 text-[11px] leading-4 text-gray-600 dark:text-gray-400">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ScreenCard({ section }: { section: GuideSection }) {
  const Icon = section.icon
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
          <Icon size={13} />
        </span>
        <div>
          <h3 className="text-xs font-bold text-gray-900 dark:text-white">{section.title}</h3>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">{section.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {section.items.map((item) => (
          <span
            key={item}
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function HelpPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* 헤더 */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-2.5 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">사용 설명서</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">업무 흐름 · 주요 화면 · 단축키 & 팁</span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        {/* 업무 흐름: 4열 1행 */}
        <div className="shrink-0">
          <SectionLabel icon={RefreshCw}>업무 흐름</SectionLabel>
          <div className="grid grid-cols-4 gap-3">
            {workflowSections.map((s) => <WorkflowCard key={s.title} section={s} />)}
          </div>
        </div>

        {/* 하단: 운영 팁 + 주요 화면 + 단축키 */}
        <div className="flex min-h-0 flex-1 gap-3">
          {/* 운영 팁 (왼쪽) */}
          <div className="flex w-52 shrink-0 flex-col rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <Save size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">운영 팁</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {tips.map((tip) => (
                <li key={tip} className="flex gap-2 px-3 py-1.5 text-[11px] leading-4 text-gray-600 dark:text-gray-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 주요 화면: 3열 2행 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <SectionLabel icon={Search}>주요 화면</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              {screenSections.map((s) => <ScreenCard key={s.title} section={s} />)}
            </div>
          </div>

          {/* 단축키 (오른쪽) */}
          <div className="flex w-60 shrink-0 flex-col rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <Keyboard size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">단축키</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {shortcuts.map((s) => (
                <div key={`${s.keys.join('-')}-${s.action}`} className="flex items-center gap-2 px-3 py-1.5">
                  <div className="flex shrink-0 items-center gap-0.5">
                    {s.keys.map((key, i) => (
                      <span key={`${s.action}-${key}`} className="flex items-center gap-0.5">
                        {i > 0 && <span className="text-[10px] text-gray-300">+</span>}
                        <Keycap>{key}</Keycap>
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-gray-800 dark:text-gray-200">{s.action}</p>
                    <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">{s.scope}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
