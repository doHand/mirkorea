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
      '상품 마스터에서 상품, 단위, 거래처, 기본 위치를 관리합니다.',
      '사용자 관리와 메뉴 권한에서 역할별 접근 범위를 확인합니다.',
    ],
  },
  {
    title: '입고 흐름',
    description: '발주 또는 수기 등록 후 입고 예정과 검수를 처리합니다.',
    icon: ArrowDownToLine,
    items: [
      '출력서류 관리에서 발주서를 만들고 입고 예정으로 전환합니다.',
      '입고 관리에서 수량, 불량, 입고 위치, LOT 정보를 입력합니다.',
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
    description: '상품 기본정보, 바코드, 단위 환산, 거래처별 품목을 관리합니다.',
    icon: Package,
    items: ['상품 추가/수정', '바코드 관리', '엑셀 가져오기/내보내기', '안전재고 확인'],
  },
  {
    title: '바코드 스캔',
    description: '현장 스캔으로 입고, 출고, 조회, 이동 업무를 빠르게 처리합니다.',
    icon: Barcode,
    items: ['스캔 모드 선택', '바코드 조회', '입출고 수량 입력', '위치 이동'],
  },
  {
    title: '창고/위치',
    description: '구역, 위치, 적치/피킹 우선순위와 위치별 재고를 관리합니다.',
    icon: Warehouse,
    items: ['구역 등록', '위치 일괄 생성', '재고 이동', '전략 설정'],
  },
  {
    title: '출력서류',
    description: '견적서, 거래명세서, 발주서, 피킹 문서를 출력합니다.',
    icon: Printer,
    items: ['문서 작성', '출력 제목 선택', '거래처 자동 매칭', '일괄 출력'],
  },
  {
    title: '엑셀',
    description: '반복 입력은 템플릿을 내려받아 엑셀로 가져올 수 있습니다.',
    icon: FileSpreadsheet,
    items: ['템플릿 다운로드', '대량 가져오기', '목록 내보내기', '오류 행 확인'],
  },
  {
    title: '권한',
    description: '역할에 따라 메뉴 접근과 주요 관리 기능을 분리합니다.',
    icon: ShieldCheck,
    items: ['사용자 등록', '역할 색상 관리', '메뉴별 역할 설정', '감사 로그 확인'],
  },
]

const shortcuts: Shortcut[] = [
  { keys: ['Ctrl', 'S'], action: '현재 편집 중인 그리드 저장', scope: '상품 마스터 등 편집 그리드' },
  { keys: ['Ctrl', 'N'], action: '새 행 추가', scope: '상품 마스터 등 편집 그리드' },
  { keys: ['Delete'], action: '선택 행 삭제 또는 삭제 표시', scope: '편집 그리드' },
  { keys: ['F2'], action: '현재 셀 편집 시작', scope: '편집 그리드' },
  { keys: ['Esc'], action: '편집 취소 또는 열린 창 닫기', scope: '모달, 편집 그리드' },
  { keys: ['Ctrl', 'Z'], action: '셀 편집 되돌리기', scope: 'AG Grid 편집 화면' },
  { keys: ['Ctrl', 'Y'], action: '셀 편집 다시 실행', scope: 'AG Grid 편집 화면' },
  { keys: ['Ctrl', 'Shift', 'Z'], action: '셀 편집 다시 실행', scope: 'AG Grid 편집 화면' },
]

const tips = [
  '대시보드의 바로가기는 현재 로그인한 역할에 맞춰 자주 쓰는 메뉴를 보여줍니다.',
  '목록 화면에서 검색어, 상태, 날짜 조건을 바꾼 뒤 검색 버튼을 누르면 조건이 적용됩니다.',
  '삭제가 바로 반영되지 않는 편집 그리드는 저장 버튼을 눌러야 서버에 반영됩니다.',
  '출력 버튼이 반응하지 않으면 브라우저 팝업 차단 여부를 먼저 확인합니다.',
  '엑셀 가져오기는 템플릿의 헤더명을 유지해야 매핑 오류가 줄어듭니다.',
]

function Keycap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
      {children}
    </kbd>
  )
}

function GuideCard({ section }: { section: GuideSection }) {
  const Icon = section.icon
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{section.title}</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{section.description}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-200">
        {section.items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function HelpPage() {
  return (
    <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <BookOpen size={17} />
              <span>사용 설명서</span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">업무 흐름과 단축키</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              현장에서 자주 쓰는 화면, 처리 순서, 키보드 조작을 모았습니다.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <Keyboard size={16} />
            <span>편집 그리드 단축키 기준</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <RefreshCw size={16} className="text-gray-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">업무 흐름</h3>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {workflowSections.map((section) => <GuideCard key={section.title} section={section} />)}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Search size={16} className="text-gray-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">주요 화면</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {screenSections.map((section) => <GuideCard key={section.title} section={section} />)}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <Keyboard size={18} className="text-emerald-700 dark:text-emerald-300" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">단축키</h3>
              </div>
              <div className="mt-4 space-y-3">
                {shortcuts.map((shortcut) => (
                  <div key={`${shortcut.keys.join('-')}-${shortcut.action}`} className="rounded border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {shortcut.keys.map((key, index) => (
                        <span key={`${shortcut.action}-${key}`} className="inline-flex items-center gap-1.5">
                          {index > 0 && <span className="text-xs text-gray-400">+</span>}
                          <Keycap>{key}</Keycap>
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{shortcut.action}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{shortcut.scope}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <Save size={18} className="text-emerald-700 dark:text-emerald-300" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">운영 팁</h3>
              </div>
              <ul className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
                {tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
