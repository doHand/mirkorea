import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, EntityManager } from 'typeorm'
import { StockTransaction, TxType } from './entities/stock-transaction.entity'
import { Inventory } from '../inventory/inventory.entity'
import { StockValidator } from './domain/stock-validator'
import { TxnNoGenerator } from './domain/txn-no-generator'
import {
  CreateInboundDto, CreateOutboundDto,
  CreateAdjustmentDto, CreateMoveDto,
  CancelTxnDto, StockTxnQueryDto,
} from './dto/create-inbound.dto'

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockTransaction) private txnRepo: Repository<StockTransaction>,
    @InjectRepository(Inventory) private invRepo: Repository<Inventory>,
    private dataSource: DataSource,
    private txnNoGen: TxnNoGenerator,
  ) {}

  // ────────────────────────────────────────
  // 입고
  // ────────────────────────────────────────
  async inbound(dto: CreateInboundDto, userId: string) {
    return this.dataSource.transaction(async (em) => {
      const inventory = await this.lockInventory(em, dto.productId, dto.locationId, dto.lotNumber)

      const beforeQty = inventory?.quantity ?? 0
      const afterQty  = beforeQty + dto.quantity
      StockValidator.assertNotNegative(afterQty, 'inbound')

      await this.upsertInventory(em, dto, afterQty, inventory)

      return this.saveTxn(em, {
        txType:      'INBOUND',
        qty:         dto.quantity,
        qtyBefore:   beforeQty,
        qtyAfter:    afterQty,
        productId:   dto.productId,
        locationId:  dto.locationId,
        warehouseId: dto.warehouseId,
        barcodeScanned: dto.barcodeUsed,
        lotNumber:   dto.lotNumber,
        expiryDate:  dto.expireDate,
        reason:      dto.reason,
        createdBy:   userId,
      })
    })
  }

  // ────────────────────────────────────────
  // 출고
  // ────────────────────────────────────────
  async outbound(dto: CreateOutboundDto, userId: string) {
    return this.dataSource.transaction(async (em) => {
      const inventory = await this.lockInventory(em, dto.productId, dto.locationId, dto.lotNumber)

      StockValidator.assertExists(inventory)
      StockValidator.assertSufficient(inventory, dto.quantity)

      const beforeQty = inventory.quantity
      const afterQty  = beforeQty - dto.quantity
      StockValidator.assertNotNegative(afterQty, 'outbound')

      await em.update(Inventory, inventory.id, {
        quantity: afterQty,
        version:  () => 'version + 1',
        lastSyncedAt: new Date(),
      })

      return this.saveTxn(em, {
        txType:      'OUTBOUND',
        qty:         -dto.quantity,
        qtyBefore:   beforeQty,
        qtyAfter:    afterQty,
        productId:   dto.productId,
        locationId:  dto.locationId,
        warehouseId: dto.warehouseId,
        barcodeScanned: dto.barcodeUsed,
        lotNumber:   dto.lotNumber,
        reason:      dto.reason,
        createdBy:   userId,
      })
    })
  }

  // ────────────────────────────────────────
  // 재고 조정
  // ────────────────────────────────────────
  async adjust(dto: CreateAdjustmentDto, userId: string) {
    return this.dataSource.transaction(async (em) => {
      const inventory = await this.lockInventory(em, dto.productId, dto.locationId, dto.lotNumber)

      const beforeQty = inventory?.quantity ?? 0
      const delta     = dto.adjustedQty - beforeQty
      StockValidator.assertNotNegative(dto.adjustedQty, 'adjustment')

      const txType: TxType = delta >= 0 ? 'ADJUST_INCREASE' : 'ADJUST_DECREASE'

      if (inventory) {
        await em.update(Inventory, inventory.id, {
          quantity: dto.adjustedQty,
          version:  () => 'version + 1',
          lastSyncedAt: new Date(),
        })
      } else {
        await em.insert(Inventory, {
          productId:   dto.productId,
          locationId:  dto.locationId,
          warehouseId: dto.warehouseId,
          quantity:    dto.adjustedQty,
          lotNumber:   dto.lotNumber ?? null,
        })
      }

      return this.saveTxn(em, {
        txType,
        qty:         delta,
        qtyBefore:   beforeQty,
        qtyAfter:    dto.adjustedQty,
        productId:   dto.productId,
        locationId:  dto.locationId,
        warehouseId: dto.warehouseId,
        reason:      dto.reason,
        createdBy:   userId,
      })
    })
  }

  // ────────────────────────────────────────
  // 위치 이동
  // ────────────────────────────────────────
  async move(dto: CreateMoveDto, userId: string) {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException('출발지와 목적지가 동일합니다')
    }

    return this.dataSource.transaction(async (em) => {
      // 데드락 방지: location_id 오름차순으로 락 획득
      const [firstId, secondId] = [dto.fromLocationId, dto.toLocationId].sort()
      const [inv1, inv2] = await Promise.all([
        this.lockInventory(em, dto.productId, firstId,  dto.lotNumber),
        this.lockInventory(em, dto.productId, secondId, dto.lotNumber),
      ])

      const fromInv = firstId === dto.fromLocationId ? inv1 : inv2
      const toInv   = firstId === dto.toLocationId   ? inv1 : inv2

      StockValidator.assertExists(fromInv)
      StockValidator.assertSufficient(fromInv, dto.quantity)

      const fromBefore = fromInv.quantity
      const fromAfter  = fromBefore - dto.quantity
      const toBefore   = toInv?.quantity ?? 0
      const toAfter    = toBefore + dto.quantity

      await em.update(Inventory, fromInv.id, { quantity: fromAfter, version: () => 'version + 1' })

      if (toInv) {
        await em.update(Inventory, toInv.id, { quantity: toAfter, version: () => 'version + 1' })
      } else {
        await em.insert(Inventory, {
          productId:   dto.productId,
          locationId:  dto.toLocationId,
          warehouseId: dto.warehouseId,
          quantity:    dto.quantity,
          lotNumber:   dto.lotNumber ?? null,
        })
      }

      const moveOutTxn = await this.saveTxn(em, {
        txType:      'MOVE_OUT',
        qty:         -dto.quantity,
        qtyBefore:   fromBefore,
        qtyAfter:    fromAfter,
        productId:   dto.productId,
        locationId:  dto.fromLocationId,
        warehouseId: dto.warehouseId,
        reason:      dto.reason,
        createdBy:   userId,
      })

      await this.saveTxn(em, {
        txType:          'MOVE_IN',
        qty:             dto.quantity,
        qtyBefore:       toBefore,
        qtyAfter:        toAfter,
        productId:       dto.productId,
        locationId:      dto.toLocationId,
        warehouseId:     dto.warehouseId,
        reason:          dto.reason,
        referenceId:     moveOutTxn.id,
        referenceType:   'MOVE_OUT',
        createdBy:       userId,
      })

      return { moveOutTxnId: moveOutTxn.id, fromAfter, toAfter }
    })
  }

  // ────────────────────────────────────────
  // 입고 취소
  // ────────────────────────────────────────
  async cancelInbound(txnId: string, dto: CancelTxnDto, userId: string) {
    return this.dataSource.transaction(async (em) => {
      const original = await em.findOne(StockTransaction, {
        where: { id: txnId },
        lock:  { mode: 'pessimistic_write' },
      })
      if (!original) throw new NotFoundException('거래를 찾을 수 없습니다')
      StockValidator.assertNotCancelled(original.isCancelled)
      if (original.txType !== 'INBOUND') {
        throw new BadRequestException('입고 거래만 취소할 수 있습니다')
      }

      const inventory = await this.lockInventory(em, original.productId, original.locationId, original.lotNumber)
      StockValidator.assertExists(inventory)

      const cancelQty = original.qty  // 원거래 수량 (양수)
      if (inventory.quantity < cancelQty) {
        throw new BadRequestException({
          code:        'CANNOT_CANCEL',
          message:     '이미 출고된 수량이 있어 입고 취소가 불가합니다',
          currentQty:  inventory.quantity,
          cancelQty,
        })
      }

      const beforeQty = inventory.quantity
      const afterQty  = beforeQty - cancelQty
      StockValidator.assertNotNegative(afterQty, 'cancel inbound')

      await em.update(Inventory, inventory.id, { quantity: afterQty, version: () => 'version + 1' })
      await em.update(StockTransaction, txnId, {
        isCancelled: true,
        cancelledBy: userId,
        cancelledAt: new Date(),
      })

      return this.saveTxn(em, {
        txType:        'INBOUND_CANCEL',
        qty:           -cancelQty,
        qtyBefore:     beforeQty,
        qtyAfter:      afterQty,
        productId:     original.productId,
        locationId:    original.locationId,
        warehouseId:   original.warehouseId,
        referenceId:   txnId,
        referenceType: 'INBOUND',
        reason:        dto.reason,
        createdBy:     userId,
      })
    })
  }

  // ────────────────────────────────────────
  // 출고 취소
  // ────────────────────────────────────────
  async cancelOutbound(txnId: string, dto: CancelTxnDto, userId: string) {
    return this.dataSource.transaction(async (em) => {
      const original = await em.findOne(StockTransaction, {
        where: { id: txnId },
        lock:  { mode: 'pessimistic_write' },
      })
      if (!original) throw new NotFoundException('거래를 찾을 수 없습니다')
      StockValidator.assertNotCancelled(original.isCancelled)
      if (original.txType !== 'OUTBOUND') {
        throw new BadRequestException('출고 거래만 취소할 수 있습니다')
      }

      const inventory = await this.lockInventory(em, original.productId, original.locationId, original.lotNumber)

      const cancelQty = Math.abs(original.qty)
      const beforeQty = inventory?.quantity ?? 0
      const afterQty  = beforeQty + cancelQty

      await this.upsertInventory(em, {
        productId:   original.productId,
        locationId:  original.locationId,
        warehouseId: original.warehouseId,
        quantity:    afterQty,
        lotNumber:   original.lotNumber,
      }, afterQty, inventory)

      await em.update(StockTransaction, txnId, {
        isCancelled: true,
        cancelledBy: userId,
        cancelledAt: new Date(),
      })

      return this.saveTxn(em, {
        txType:        'OUTBOUND_CANCEL',
        qty:           cancelQty,
        qtyBefore:     beforeQty,
        qtyAfter:      afterQty,
        productId:     original.productId,
        locationId:    original.locationId,
        warehouseId:   original.warehouseId,
        referenceId:   txnId,
        referenceType: 'OUTBOUND',
        reason:        dto.reason,
        createdBy:     userId,
      })
    })
  }

  // ────────────────────────────────────────
  // 거래 내역 조회
  // ────────────────────────────────────────
  async findTransactions(q: StockTxnQueryDto) {
    const { productId, locationId, warehouseId, txType, from, to, performedBy, page = 1, limit = 100 } = q

    const qb = this.txnRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.product', 'p')
      .leftJoinAndSelect('t.location', 'loc')
      .leftJoinAndSelect('t.user', 'u')
      .orderBy('t.createdAt', 'DESC')

    if (productId)   qb.andWhere('t.productId = :productId', { productId })
    if (locationId)  qb.andWhere('t.locationId = :locationId', { locationId })
    if (warehouseId) qb.andWhere('t.warehouseId = :warehouseId', { warehouseId })
    if (txType)      qb.andWhere('t.txType = :txType', { txType })
    if (performedBy) qb.andWhere('t.createdBy = :performedBy', { performedBy })
    if (from)        qb.andWhere('t.createdAt >= :from', { from: new Date(from) })
    if (to)          qb.andWhere('t.createdAt <= :to', { to: new Date(to + 'T23:59:59Z') })

    const [items, total] = await qb.take(limit).skip((page - 1) * limit).getManyAndCount()
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // ────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────
  private async lockInventory(
    em: EntityManager,
    productId: string,
    locationId: string,
    lotNumber?: string,
  ): Promise<Inventory | null> {
    const qb = em
      .createQueryBuilder(Inventory, 'inv')
      .setLock('pessimistic_write')
      .where('inv.product_id = :productId AND inv.location_id = :locationId', { productId, locationId })

    if (lotNumber) {
      qb.andWhere('inv.lot_number = :lotNumber', { lotNumber })
    } else {
      qb.andWhere('inv.lot_number IS NULL')
    }

    return qb.getOne()
  }

  private async upsertInventory(
    em: EntityManager,
    dto: { productId: string; locationId: string; warehouseId: string; lotNumber?: string; expireDate?: string; quantity?: number },
    newQty: number,
    existing: Inventory | null,
  ) {
    if (existing) {
      await em.update(Inventory, existing.id, {
        quantity:    newQty,
        version:     () => 'version + 1',
        lastSyncedAt: new Date(),
      })
    } else {
      await em.insert(Inventory, {
        productId:   dto.productId,
        locationId:  dto.locationId,
        warehouseId: dto.warehouseId,
        quantity:    newQty,
        lotNumber:   dto.lotNumber ?? null,
        expireDate:  (dto as any).expireDate ?? null,
      })
    }
  }

  private async saveTxn(em: EntityManager, data: Partial<StockTransaction> & { txType: TxType }): Promise<StockTransaction> {
    const txnNo = await this.txnNoGen.generate('TXN')
    StockValidator.assertIntegrity(data.qtyBefore!, data.qty!, data.qtyAfter!)
    return em.save(StockTransaction, { ...data, txnNo } as StockTransaction)
  }
}
