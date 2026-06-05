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
export type BarcodeUnitType = 'UNIT' | 'CXD' | 'CXD_BOX'

export interface Product {
  id: string
  code: string
  name: string
  category?: string
  clientId?: string
  client?: Pick<Client, 'id' | 'name' | 'phone' | 'email'>
  locationId?: string
  defaultLocation?: Location
  unit: string
  optionName?: string
  spec?: string
  materialNo?: string
  boxQty: number
  weightG?: number
  imageUrl?: string
  safetyStock: number
  reorderPoint: number
  costPrice?: number
  sellPrice?: number
  priceA?: number
  priceB?: number
  priceC?: number
  retailPrice?: number
  memo?: string
  saleStatus: SaleStatus
  isLotManaged: boolean
  isExpiryManaged: boolean
  stockQty?: number
  createdAt: string
  barcodes?: Barcode[]
}

export interface ProductUnit {
  id: string
  code: string
  label: string
  description?: string
  sortOrder: number
  isActive: boolean
  createdAt: string
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
  createdByUser?: Pick<User, 'id' | 'username' | 'fullName' | 'role'>
}

export interface BarcodeResolveResult {
  product: Product
  unitType: BarcodeUnitType
  qtyPerScan: number
}

export type InboundStatus = 'PENDING' | 'RECEIVING' | 'INSPECTING' | 'COMPLETED' | 'CANCELLED'

export interface InboundOrderItem {
  id: string
  orderId?: string
  productId: string
  expectedQty: number
  receivedQty: number
  passedQty: number
  defectQty: number
  lotNumber?: string
  expireDate?: string
  locationId?: string
  defectLocationId?: string
  barcodeScanned?: string
  note?: string
  product?: Product
  location?: Location
}

export interface InboundOrder {
  id: string
  orderNo: string
  warehouseId: string
  supplier?: string
  expectedDate?: string
  status: InboundStatus
  memo?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  items: InboundOrderItem[]
}

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'CONVERTED' | 'CANCELLED'

export interface PurchaseOrderItem {
  id: string
  productId: string
  quantity: number
  boxCount: number
  capSize?: string
  unitPrice: number
  sortOrder: number
  product?: Product
}

export interface PurchaseOrder {
  id: string
  orderNo: string
  warehouseId: string
  supplier?: string
  orderDate: string
  expectedDate?: string
  manager?: string
  phone?: string
  fax?: string
  status: PurchaseOrderStatus
  memo?: string
  inboundOrderId?: string
  createdAt: string
  items: PurchaseOrderItem[]
}

export interface Client {
  id: string
  name: string
  businessNo?: string
  address?: string
  industry?: string
  sector?: string
  email?: string
  phone?: string
  fax?: string
  customerType?: string
  salesperson?: string
  mobile?: string
  ceoName?: string
  postalCode?: string
  addressDetail?: string
  contactName?: string
  honorific?: string
  managerName?: string
  managerTitle?: string
  website?: string
  employeeCount?: number
  pricePolicy?: string
  taxType?: string
  discountRate?: number
  initialReceivable?: number
  unpaidOnly?: boolean
  registrationDate?: string
  managementNo?: string
  memo?: string
  isActive: boolean
  createdAt: string
}

export interface QuoteItem {
  id: string
  productId?: string
  productCode?: string
  productName?: string
  unit?: string
  qty: number
  unitPrice: number
  amount: number
  sortOrder: number
}

export interface Quote {
  id: string
  docNo: string
  docType: 'STATEMENT' | 'QUOTE'
  clientId?: string
  clientName?: string
  docDate: string
  memo?: string
  totalAmount: number
  status: 'DRAFT' | 'CONFIRMED'
  createdBy: string
  createdAt: string
  items: QuoteItem[]
}

export interface ProductPricing {
  id: string
  code: string
  name: string
  category?: string
  clientId?: string
  clientName?: string
  unit: string
  boxQty: number
  costPrice?: number
  sellPrice?: number
  safetyStock: number
  saleStatus: SaleStatus
  totalStock: number
}
