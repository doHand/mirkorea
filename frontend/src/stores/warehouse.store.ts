import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Warehouse } from '@/types/api.types'

interface WarehouseState {
  selectedWarehouse: Warehouse | null
  setWarehouse: (w: Warehouse) => void
}

export const useWarehouseStore = create<WarehouseState>()(
  persist(
    (set) => ({
      selectedWarehouse: null,
      setWarehouse: (w) => set({ selectedWarehouse: w }),
    }),
    { name: 'wms-warehouse' }
  )
)
