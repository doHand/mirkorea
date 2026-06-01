import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { Inventory } from './inventory.entity'

export interface InventoryFilter {
  warehouseId?: string
  locationId?: string
  productId?: string
  zone?: string
  search?: string
  belowSafety?: boolean
  page?: number
  limit?: number
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory) private repo: Repository<Inventory>,
    private dataSource: DataSource,
  ) {}

  async findAll(filter: InventoryFilter) {
    const { warehouseId, locationId, productId, zone, search, belowSafety, page = 1, limit = 100 } = filter

    const qb = this.repo
      .createQueryBuilder('inv')
      .innerJoinAndSelect('inv.product', 'p')
      .innerJoinAndSelect('inv.location', 'loc')
      .innerJoinAndSelect('loc.zone', 'z')
      .where('inv.quantity > 0 OR inv.reserved_qty > 0')

    if (warehouseId) qb.andWhere('inv.warehouse_id = :warehouseId', { warehouseId })
    if (locationId)  qb.andWhere('inv.location_id = :locationId', { locationId })
    if (productId)   qb.andWhere('inv.product_id = :productId', { productId })
    if (zone)        qb.andWhere('z.code = :zone', { zone })
    if (search)      qb.andWhere('(p.name ILIKE :s OR p.code ILIKE :s)', { s: `%${search}%` })
    if (belowSafety) qb.andWhere('inv.quantity <= p.safety_stock')

    qb.orderBy('p.name', 'ASC').addOrderBy('loc.code', 'ASC')

    const [items, total] = await qb
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount()

    return { items: items.map(i => this.toResponse(i)), total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findByProduct(productId: string, warehouseId?: string) {
    const qb = this.repo
      .createQueryBuilder('inv')
      .innerJoinAndSelect('inv.location', 'loc')
      .where('inv.product_id = :productId', { productId })
      .andWhere('inv.quantity > 0')

    if (warehouseId) qb.andWhere('inv.warehouse_id = :warehouseId', { warehouseId })

    const items = await qb.orderBy('inv.quantity', 'DESC').getMany()
    return items.map(i => this.toResponse(i))
  }

  async getSummary(warehouseId: string) {
    const result = await this.dataSource.query(`
      SELECT
        COUNT(DISTINCT i.product_id)::int  AS total_skus,
        SUM(i.quantity)::int               AS total_qty,
        COUNT(DISTINCT CASE WHEN i.quantity <= p.safety_stock THEN i.product_id END)::int AS below_safety_count,
        COUNT(DISTINCT CASE WHEN i.quantity = 0 THEN i.product_id END)::int              AS out_of_stock_count
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.warehouse_id = $1
    `, [warehouseId])
    return result[0]
  }

  async getLowStock(warehouseId: string) {
    return this.repo
      .createQueryBuilder('inv')
      .innerJoinAndSelect('inv.product', 'p')
      .innerJoinAndSelect('inv.location', 'loc')
      .where('inv.warehouse_id = :warehouseId', { warehouseId })
      .andWhere('inv.quantity <= p.safety_stock')
      .andWhere('p.safety_stock > 0')
      .orderBy('inv.quantity', 'ASC')
      .getMany()
  }

  private toResponse(inv: Inventory) {
    return {
      id: inv.id,
      productId: inv.productId,
      productCode: inv.product?.code,
      productName: inv.product?.name,
      locationId: inv.locationId,
      locationCode: inv.location?.code,
      zone: (inv.location as any)?.zone?.code,
      warehouseId: inv.warehouseId,
      quantity: inv.quantity,
      reservedQty: inv.reservedQty,
      availableQty: inv.quantity - inv.reservedQty,
      safetyStock: inv.product?.safetyStock ?? 0,
      isBelowSafety: inv.quantity <= (inv.product?.safetyStock ?? 0),
      lotNumber: inv.lotNumber,
      expireDate: inv.expireDate,
      lastSyncedAt: inv.lastSyncedAt,
    }
  }
}
