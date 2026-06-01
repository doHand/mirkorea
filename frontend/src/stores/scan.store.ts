import { create } from 'zustand'
import type { BarcodeResolveResult, Location } from '@/types/api.types'
import type { ScanMode } from '@/constants/stock.constants'

export interface ScanCartItem {
  productId:   string
  productCode: string
  productName: string
  locationId:  string
  locationCode: string
  quantity:    number
  barcodeUsed: string
  unitType:    string
  qtyPerScan:  number
  lotNumber?:  string
  expireDate?: string
}

interface ScanState {
  mode:         ScanMode
  cart:         ScanCartItem[]
  lastResult:   BarcodeResolveResult | null
  selectedLocation: Location | null

  setMode:            (mode: ScanMode) => void
  setLastResult:      (r: BarcodeResolveResult | null) => void
  setSelectedLocation:(loc: Location | null) => void
  addToCart:          (item: ScanCartItem) => void
  removeFromCart:     (idx: number) => void
  updateCartQty:      (idx: number, qty: number) => void
  clearCart:          () => void
}

export const useScanStore = create<ScanState>((set) => ({
  mode:              'INBOUND',
  cart:              [],
  lastResult:        null,
  selectedLocation:  null,

  setMode:            (mode) => set({ mode, cart: [], lastResult: null }),
  setLastResult:      (lastResult) => set({ lastResult }),
  setSelectedLocation:(selectedLocation) => set({ selectedLocation }),

  addToCart: (item) => set((s) => {
    const existing = s.cart.findIndex(
      (c) => c.productId === item.productId && c.locationId === item.locationId && c.lotNumber === item.lotNumber
    )
    if (existing >= 0) {
      const cart = [...s.cart]
      cart[existing] = { ...cart[existing], quantity: cart[existing].quantity + item.quantity }
      return { cart }
    }
    return { cart: [...s.cart, item] }
  }),

  removeFromCart: (idx) => set((s) => ({
    cart: s.cart.filter((_, i) => i !== idx)
  })),

  updateCartQty: (idx, qty) => set((s) => {
    const cart = [...s.cart]
    cart[idx] = { ...cart[idx], quantity: qty }
    return { cart }
  }),

  clearCart: () => set({ cart: [], lastResult: null }),
}))
