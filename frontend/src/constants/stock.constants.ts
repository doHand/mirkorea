import type { TxType } from '@/types/api.types'

export const TX_TYPE_LABEL: Record<TxType, string> = {
  INBOUND:         '입고',
  INBOUND_CANCEL:  '입고취소',
  OUTBOUND:        '출고',
  OUTBOUND_CANCEL: '출고취소',
  ADJUST_INCREASE: '재고증가조정',
  ADJUST_DECREASE: '재고감소조정',
  MOVE_OUT:        '위치이동(출)',
  MOVE_IN:         '위치이동(입)',
  INITIAL:         '초기재고',
}

export const TX_TYPE_COLOR: Record<TxType, string> = {
  INBOUND:         'text-green-700 bg-green-100',
  INBOUND_CANCEL:  'text-gray-600 bg-gray-100',
  OUTBOUND:        'text-red-700 bg-red-100',
  OUTBOUND_CANCEL: 'text-gray-600 bg-gray-100',
  ADJUST_INCREASE: 'text-blue-700 bg-blue-100',
  ADJUST_DECREASE: 'text-orange-700 bg-orange-100',
  MOVE_OUT:        'text-purple-700 bg-purple-100',
  MOVE_IN:         'text-purple-700 bg-purple-100',
  INITIAL:         'text-gray-700 bg-gray-100',
}

export const SCAN_MODES = ['INBOUND', 'OUTBOUND', 'INQUIRY', 'ADJUSTMENT', 'MOVE'] as const
export type ScanMode = (typeof SCAN_MODES)[number]

export const SCAN_MODE_LABEL: Record<ScanMode, string> = {
  INBOUND:    '입고',
  OUTBOUND:   '출고',
  INQUIRY:    '재고조회',
  ADJUSTMENT: '재고조정',
  MOVE:       '위치이동',
}

export const SALE_STATUS_LABEL = {
  ACTIVE:       '판매중',
  INACTIVE:     '판매중지',
  DISCONTINUED: '단종',
}

export const BARCODE_UNIT_LABEL = {
  UNIT:   '낱개',
  BOX:    '박스',
  INNER:  '이너박스',
  PALLET: '팔레트',
}
