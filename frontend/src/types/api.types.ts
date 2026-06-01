export interface ApiResponse<T> {
  success: boolean
  data?: T
  code?: string
  message?: string
  detail?: unknown
}

export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'WORKER' | 'VIEWER'

export interface User {
  id: string
  username: string
  fullName: string
  role: UserRole
  warehouseId: string | null
}

export interface UserDetail extends User {
  email: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface Warehouse {
  id: string
  code: string
  name: string
  address?: string
  isActive: boolean
}

export interface Zone {
  id: string
  warehouseId: string
  code: string
  name: string
  type: 'STORAGE' | 'RECEIVING' | 'SHIPPING' | 'STAGING' | 'DAMAGED'
  isActive: boolean
}

export interface Location {
  id: string
  warehouseId: string
  zoneId: string
  code: string
  aisle?: string
  rack?: string
  shelf?: string
  bin?: string
  capacityUnit: number
  isActive: boolean
  zone?: Zone
}

export type SaleStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'
export type BarcodeUnitType = 'UNIT' | 'BOX' | 'INNER' | 'PALLET'

export interface Product {
  id: string
  code: string
  name: string
  category?: string
  brand?: string
  unit: string
  boxQty: number
  weightG?: number
  imageUrl?: string
  safetyStock: number
  reorderPoint: number
  costPrice?: number
  sellPrice?: number
  saleStatus: SaleStatus
  isLotManaged: boolean
  isExpiryManaged: boolean
  createdAt: string
  barcodes?: Barcode[]
}

export interface Barcode {
  id: string
  productId: string
  barcode: string
  type: BarcodeUnitType
  unitQty: number
  isPrimary: boolean
  isActive: boolean
}

export interface Inventory {
  id: string
  productId: string
  locationId: string
  warehouseId: string
  quantity: number
  reservedQty: number
  availableQty: number
  lotNumber?: string
  expireDate?: string
  product?: Product
  location?: Location
}

export type TxType =
  | 'INBOUND' | 'INBOUND_CANCEL'
  | 'OUTBOUND' | 'OUTBOUND_CANCEL'
  | 'ADJUST_INCREASE' | 'ADJUST_DECREASE'
  | 'MOVE_OUT' | 'MOVE_IN'
  | 'INITIAL'

export interface StockTransaction {
  id: string
  txnNo: string
  productId: string
  locationId: string
  warehouseId: string
  qty: number
  qtyBefore: number
  qtyAfter: number
  txType: TxType
  referenceType?: string
  referenceId?: string
  lotNumber?: string
  barcodeScanned?: string
  reason?: string
  memo?: string
  isCancelled: boolean
  cancelledAt?: string
  createdBy: string
  createdAt: string
  product?: Product
  location?: Location
  createdByUser?: User
}

export interface BarcodeResolveResult {
  product: Product
  unitType: BarcodeUnitType
  qtyPerScan: number
}
