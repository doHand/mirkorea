import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Product } from '../products/entities/product.entity'

export type BarcodeType = 'UNIT' | 'BOX' | 'PALLET' | 'INNER'

@Entity('barcodes')
export class Barcode {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ name: 'product_id' }) productId: string
  @Column({ unique: true }) barcode: string
  @Column({ default: 'UNIT' }) type: BarcodeType
  @Column({ name: 'unit_qty', default: 1 }) unitQty: number
  @Column({ name: 'is_primary', default: false }) isPrimary: boolean
  @Column({ name: 'is_active', default: true }) isActive: boolean
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date
  @ManyToOne(() => Product, p => p.barcodes) @JoinColumn({ name: 'product_id' }) product: Product
}
