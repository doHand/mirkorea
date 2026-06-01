import { ConflictException, NotFoundException } from '@nestjs/common'
import { Inventory } from '../../inventory/inventory.entity'

export class StockValidator {
  static assertExists(inventory: Inventory | null, locationCode?: string): asserts inventory is Inventory {
    if (!inventory) {
      throw new NotFoundException(
        locationCode
          ? `위치 '${locationCode}'에 해당 상품의 재고가 없습니다`
          : '해당 위치에 재고가 없습니다'
      )
    }
  }

  static assertSufficient(inventory: Inventory, requestedQty: number) {
    const available = inventory.quantity - inventory.reservedQty
    if (available < requestedQty) {
      throw new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: '출고 가능 재고가 부족합니다',
        available,
        requested: requestedQty,
        locationId: inventory.locationId,
      })
    }
  }

  static assertNotNegative(qty: number, context = '') {
    if (qty < 0) {
      throw new ConflictException(`재고 음수 방지: ${context}`)
    }
  }

  static assertIntegrity(before: number, delta: number, after: number) {
    if (before + delta !== after) {
      throw new Error(
        `재고 정합성 오류: before(${before}) + delta(${delta}) ≠ after(${after})`
      )
    }
  }

  static assertNotCancelled(isCancelled: boolean) {
    if (isCancelled) {
      throw new ConflictException('이미 취소된 거래입니다')
    }
  }
}
