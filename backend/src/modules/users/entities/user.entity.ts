import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export type UserRole = 'ADMIN' | 'MANAGER' | 'WORKER' | 'VIEWER'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ unique: true }) username: string
  @Column({ unique: true }) email: string
  @Column({ name: 'password_hash' }) passwordHash: string
  @Column({ name: 'full_name' }) fullName: string
  @Column({ default: 'WORKER' }) role: UserRole
  @Column({ name: 'warehouse_id', nullable: true }) warehouseId: string
  @Column({ name: 'is_active', default: true }) isActive: boolean
  @Column({ name: 'last_login_at', nullable: true }) lastLoginAt: Date
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date
}
