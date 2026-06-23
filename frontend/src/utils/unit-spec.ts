import type { Product } from '@/types/api.types'

type PackageUnit = 'P' | 'BOX' | 'PL'

/** EA quantity represented by one package; accepts persisted data or the canonical spec text. */
export function getPackageUnitQty(
  product: Pick<Product, 'spec' | 'pUnitQty' | 'boxUnitQty' | 'plUnitQty'>,
  unit: PackageUnit,
): number | null {
  const stored = unit === 'P' ? product.pUnitQty : unit === 'BOX' ? product.boxUnitQty : product.plUnitQty
  if (stored && stored > 0) return stored
  const match = product.spec?.match(new RegExp(`(\\d+)\\s*${unit}\\b`, 'i'))
  const value = match ? Number(match[1]) : 0
  return value > 0 ? value : null
}

/** Canonical package specification, e.g. 4P/10BOX/1PL. EA is always the stock base. */
export function formatUnitSpec(product?: Pick<Product, 'spec' | 'pUnitQty' | 'boxUnitQty' | 'plUnitQty'>): string {
  if (!product) return '-'
  const numericParts = [
    getPackageUnitQty(product, 'P') ? `${getPackageUnitQty(product, 'P')}P` : undefined,
    getPackageUnitQty(product, 'BOX') ? `${getPackageUnitQty(product, 'BOX')}BOX` : undefined,
    getPackageUnitQty(product, 'PL') ? `${getPackageUnitQty(product, 'PL')}PL` : undefined,
  ].filter(Boolean)
  if (numericParts.length > 0) return numericParts.join('/')
  return product.spec?.trim() || '-'
}
