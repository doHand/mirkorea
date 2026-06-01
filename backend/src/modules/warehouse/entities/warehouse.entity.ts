import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm'
import { Zone } from './zone.entity'
import { Location } from './location.entity'

@Entity('warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ unique: true }) code: string
  @Column() name: string
  @Column({ nullable: true }) address: string
  @Column({ name: 'is_active', default: true }) isActive: boolean
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date
  @OneToMany(() => Zone, z => z.warehouse) zones: Zone[]
  @OneToMany(() => Location, l => l.warehouse) locations: Location[]
}
