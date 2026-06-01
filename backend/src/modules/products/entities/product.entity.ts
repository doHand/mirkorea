import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm'
import { Barcode } from '../../barcodes/barcode.entity'

export type SaleStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ unique: true }) code: string
  @Column() name: string
  @Column({ nullable: true }) description: string
  @Column({ nullable: true }) category: string
  @Column({ nullable: true }) brand: string
  @Column({ default: 'EA' }) unit: string
  @Column({ name: 'box_unit', default: 1 }) boxUnit: number
  @Column({ name: 'weight_g', nullable: true }) weightG: number
  @Column({ name: 'image_url', nullable: true }) imageUrl: string
  @Column({ name: 'safety_stock', default: 0 }) safetyStock: number
  @Column({ name: 'reorder_point', default: 0 }) reorderPoint: number
  @Column({ name: 'reorder_qty', default: 0 }) reorderQty: number
  @Column({ name: 'sale_status', default: 'ACTIVE' }) saleStatus: SaleStatus
  @Column({ name: 'cost_price', type: 'decimal', precision: 15, scale: 4, nullable: true }) costPrice: number
  @Column({ name: 'sell_price', type: 'decimal', precision: 15, scale: 4, nullable: true }) sellPrice: number
  @Column({ name: 'is_lot_managed', default: false }) isLotManaged: boolean
  @Column({ name: 'is_expiry_managed', default: false }) isExpiryManaged: boolean
  @Column({ name: 'created_by', nullable: true }) createdBy: string
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date
  @OneToMany(() => Barcode, b => b.product) barcodes: Barcode[]
}
