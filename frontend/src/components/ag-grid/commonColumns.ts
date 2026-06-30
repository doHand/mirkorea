import type { ColDef } from 'ag-grid-community'
import type { SaleStatus } from '@/types/api.types'

type WithSaleStatus = { saleStatus?: SaleStatus }
type WithCreatedAt = { createdAt?: string }

const SALE_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'DISCONTINUED'] satisfies SaleStatus[]

const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  ACTIVE: '활성',
  INACTIVE: '비활성',
  DISCONTINUED: '단종',
}

function createSaleStatusColumn<T extends WithSaleStatus>(): ColDef<T> {
  return {
    headerName: '상태',
    field: 'saleStatus' as ColDef<T>['field'],
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: SALE_STATUS_VALUES },
    valueFormatter: (p) => (p.value ? (SALE_STATUS_LABEL[p.value as SaleStatus] ?? p.value) : '-'),
    width: 80,
  }
}

function createCreatedAtColumn<T extends WithCreatedAt>(): ColDef<T> {
  return {
    headerName: '등록일',
    field: 'createdAt' as ColDef<T>['field'],
    valueFormatter: (p) => p.value ? new Date(p.value).toLocaleDateString('ko-KR') : '-',
    width: 110,
  }
}

export function createStatusCreatedAtColumns<T extends WithSaleStatus & WithCreatedAt>(): ColDef<T>[] {
  return [
    createSaleStatusColumn<T>(),
    createCreatedAtColumn<T>(),
  ]
}
