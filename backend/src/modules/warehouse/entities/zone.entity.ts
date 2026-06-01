import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm'
import { Warehouse } from './warehouse.entity'
import { Location } from './location.entity'

export type ZoneType = 'STORAGE' | 'RECEIVING' | 'SHIPPING' | 'STAGING' | 'DAMAGED'

@Entity('zones')
export class Zone {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ name: 'warehouse_id' }) warehouseId: string
  @Column() code: string
  @Column() name: string
  @Column({ default: 'STORAGE' }) type: ZoneType
  @Column({ name: 'is_active', default: true }) isActive: boolean
  @ManyToOne(() => Warehouse, w => w.zones) @JoinColumn({ name: 'warehouse_id' }) warehouse: Warehouse
  @OneToMany(() => Location, l => l.zone) locations: Location[]
}
