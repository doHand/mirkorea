import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm'
import { Product } from '../products/entities/product.entity'
import { Location } from '../warehouse/entities/location.entity'
import { Warehouse } from '../warehouse/entities/warehouse.entity'

@Entity('inventory')
@Index(['productId', 'locationId', 'lotNumber'], { unique: true })
@Index(['warehouseId'])
@Index(['productId'])
export class Inventory {
  @PrimaryGeneratedColumn('uuid') id: string

  @Column({ name: 'product_id' }) productId: string
  @Column({ name: 'location_id' }) locationId: string
  @Column({ name: 'warehouse_id' }) warehouseId: string

  @Column({ type: 'int', default: 0 }) quantity: number
  @Column({ name: 'reserved_qty', type: 'int', default: 0 }) reservedQty: number

  @Column({ name: 'lot_number', nullable: true }) lotNumber: string | null
  @Column({ name: 'expire_date', type: 'date', nullable: true }) expireDate: string | null

  // version for optimistic lock fallback
  @Column({ type: 'int', default: 1 }) version: number

  @Column({ name: 'last_synced_at', type: 'timestamptz', default: () => 'now()' }) lastSyncedAt: Date

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date

  @ManyToOne(() => Product) @JoinColumn({ name: 'product_id' }) product: Product
  @ManyToOne(() => Location) @JoinColumn({ name: 'location_id' }) location: Location
  @ManyToOne(() => Warehouse) @JoinColumn({ name: 'warehouse_id' }) warehouse: Warehouse

  get availableQty(): number {
    return this.quantity - this.reservedQty
  }
}
