export const QUERY_KEYS = {
  products:     (filters?: object) => ['products', filters],
  product:      (id: string)       => ['product', id],
  barcodes:     (productId: string) => ['barcodes', productId],

  inventory:    (filters?: object) => ['inventory', filters],
  lowStock:     (warehouseId: string) => ['inventory', 'low-stock', warehouseId],
  invSummary:   (warehouseId: string) => ['inventory', 'summary', warehouseId],

  warehouses:   () => ['warehouses'],
  warehouse:    (id: string) => ['warehouse', id],
  zones:        (warehouseId: string) => ['zones', warehouseId],
  locations:    (warehouseId: string, zoneId?: string) => ['locations', warehouseId, zoneId],

  transactions: (filters?: object) => ['transactions', filters],

  barcode:      (value: string) => ['barcode', value],

  inboundOrders: (filters?: object) => ['inbound', filters],
  inboundOrder:  (id: string)       => ['inbound', id],
  purchaseOrders: (filters?: object) => ['purchase-orders', filters],
} as const
