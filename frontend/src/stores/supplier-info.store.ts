import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SupplierInfo {
  name: string
  businessNo: string
  phone: string
  fax: string
  ceo: string
  address: string
}

export const DEFAULT_SUPPLIER_INFO: SupplierInfo = {
  name: '미르코리아',
  businessNo: '104-34-69913',
  phone: '031-491-9374',
  fax: '031-965-2280',
  ceo: '손흥식',
  address: '경기도 파주시 탄현면 헤이리로 193번길 149',
}

interface SupplierInfoState {
  info: SupplierInfo
  update: (patch: Partial<SupplierInfo>) => void
  reset: () => void
}

export const useSupplierInfoStore = create<SupplierInfoState>()(
  persist(
    (set) => ({
      info: DEFAULT_SUPPLIER_INFO,
      update: (patch) => set((state) => ({ info: { ...state.info, ...patch } })),
      reset: () => set({ info: DEFAULT_SUPPLIER_INFO }),
    }),
    {
      name: 'wms-supplier-info',
      version: 1,
    },
  ),
)
