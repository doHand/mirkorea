import type { Product } from '@/types/api.types'

type PackageUnit = 'IN' | 'OUT'

/** EA quantity represented by one package; accepts persisted data or the canonical spec text. */
export function getPackageUnitQty(
  product: Pick<Product, 'spec' | 'inUnitQty' | 'outUnitQty'>,
  unit: PackageUnit,
): number | null {
  const stored = unit === 'IN' ? product.inUnitQty : product.outUnitQty
  if (stored && stored > 0) return stored
  const match = product.spec?.match(new RegExp(`(\\d+)\\s*${unit}\\b`, 'i'))
  const value = match ? Number(match[1]) : 0
  return value > 0 ? value : null
}

/** Canonical package specification, e.g. 12IN / 100OUT. EA is always the stock base. */
export function formatUnitSpec(product?: Pick<Product, 'spec' | 'inUnitQty' | 'outUnitQty'>): string {
  if (!product) return '-'
  const inQty  = getPackageUnitQty(product, 'IN')
  const outQty = getPackageUnitQty(product, 'OUT')
  if (inQty && outQty) return `${inQty}IN / ${outQty}OUT`
  return product.spec?.trim() || '-'
}
