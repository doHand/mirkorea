import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Warehouse } from './warehouse.entity'
import { Zone } from './zone.entity'

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ name: 'warehouse_id' }) warehouseId: string
  @Column({ name: 'zone_id' }) zoneId: string
  @Column({ unique: true }) code: string
  @Column({ nullable: true }) aisle: string
  @Column({ nullable: true }) rack: string
  @Column({ nullable: true }) shelf: string
  @Column({ nullable: true }) bin: string
  @Column({ nullable: true, unique: true }) barcode: string
  @Column({ name: 'capacity_unit', default: 9999 }) capacityUnit: number
  @Column({ name: 'is_active', default: true }) isActive: boolean
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date
  @ManyToOne(() => Warehouse, w => w.locations) @JoinColumn({ name: 'warehouse_id' }) warehouse: Warehouse
  @ManyToOne(() => Zone, z => z.locations) @JoinColumn({ name: 'zone_id' }) zone: Zone
}
