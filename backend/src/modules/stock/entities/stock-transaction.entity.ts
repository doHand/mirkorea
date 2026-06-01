import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm'
import { Product } from '../../products/entities/product.entity'
import { Location } from '../../warehouse/entities/location.entity'
import { User } from '../../users/entities/user.entity'

export type TxType =
  | 'INBOUND' | 'INBOUND_CANCEL'
  | 'OUTBOUND' | 'OUTBOUND_CANCEL'
  | 'ADJUST_INCREASE' | 'ADJUST_DECREASE'
  | 'MOVE_OUT' | 'MOVE_IN'
  | 'INITIAL'

@Entity('stock_transactions')
@Index(['productId', 'createdAt'])
@Index(['locationId', 'createdAt'])
@Index(['warehouseId', 'txType'])
@Index(['referenceId'])
export class StockTransaction {
  @PrimaryGeneratedColumn('uuid') id: string

  @Column({ name: 'txn_no', unique: true }) txnNo: string

  @Column({ name: 'product_id' })   productId: string
  @Column({ name: 'location_id' })  locationId: string
  @Column({ name: 'warehouse_id' }) warehouseId: string

  @Column({ type: 'int' })                      qty: number        // 양수=증가, 음수=감소
  @Column({ name: 'qty_before', type: 'int' })  qtyBefore: number
  @Column({ name: 'qty_after',  type: 'int' })  qtyAfter: number

  @Column({ name: 'tx_type' }) txType: TxType

  @Column({ name: 'reference_type', nullable: true }) referenceType: string | null
  @Column({ name: 'reference_id',   nullable: true }) referenceId: string | null

  @Column({ name: 'lot_number',    nullable: true }) lotNumber: string | null
  @Column({ name: 'expiry_date',   type: 'date', nullable: true }) expiryDate: string | null

  @Column({ nullable: true }) reason: string | null
  @Column({ nullable: true }) memo: string | null

  @Column({ name: 'barcode_scanned', nullable: true }) barcodeScanned: string | null

  @Column({ name: 'is_cancelled', default: false }) isCancelled: boolean
  @Column({ name: 'cancelled_by', nullable: true }) cancelledBy: string | null
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true }) cancelledAt: Date | null

  @Column({ name: 'created_by' }) createdBy: string

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date

  @ManyToOne(() => Product)  @JoinColumn({ name: 'product_id' })  product: Product
  @ManyToOne(() => Location) @JoinColumn({ name: 'location_id' }) location: Location
  @ManyToOne(() => User)     @JoinColumn({ name: 'created_by' })  user: User
}
