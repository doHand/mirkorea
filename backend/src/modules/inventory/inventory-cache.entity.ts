import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Product } from '../products/entities/product.entity'
import { Location } from '../warehouse/entities/location.entity'

@Entity('inventory_cache')
export class InventoryCache {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ name: 'product_id' }) productId: string
  @Column({ name: 'location_id' }) locationId: string
  @Column({ name: 'warehouse_id' }) warehouseId: string
  @Column({ type: 'int', default: 0 }) qty: number
  @Column({ name: 'lot_number', nullable: true }) lotNumber: string
  @Column({ name: 'expiry_date', type: 'date', nullable: true }) expiryDate: string
  @Column({ name: 'last_tx_id', nullable: true }) lastTxId: string
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date

  @ManyToOne(() => Product)  @JoinColumn({ name: 'product_id' })  product: Product
  @ManyToOne(() => Location) @JoinColumn({ name: 'location_id' }) location: Location
}
