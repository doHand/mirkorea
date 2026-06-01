import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Warehouse } from './entities/warehouse.entity'
import { Zone } from './entities/zone.entity'
import { Location } from './entities/location.entity'

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(Warehouse) private warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Zone)      private zoneRepo: Repository<Zone>,
    @InjectRepository(Location)  private locationRepo: Repository<Location>,
  ) {}

  findAllWarehouses() {
    return this.warehouseRepo.find({ where: { isActive: true }, order: { name: 'ASC' } })
  }

  async findWarehouse(id: string) {
    const w = await this.warehouseRepo.findOne({ where: { id }, relations: ['zones'] })
    if (!w) throw new NotFoundException('창고를 찾을 수 없습니다')
    return w
  }

  async createWarehouse(dto: { code: string; name: string; address?: string }) {
    const exists = await this.warehouseRepo.findOne({ where: { code: dto.code } })
    if (exists) throw new ConflictException(`창고코드 '${dto.code}'가 이미 존재합니다`)
    return this.warehouseRepo.save(this.warehouseRepo.create(dto))
  }

  findZones(warehouseId: string) {
    return this.zoneRepo.find({ where: { warehouseId, isActive: true }, order: { code: 'ASC' } })
  }

  async createZone(dto: { warehouseId: string; code: string; name: string; type?: any }) {
    return this.zoneRepo.save(this.zoneRepo.create(dto))
  }

  findLocations(warehouseId: string, zoneId?: string) {
    const where: any = { warehouseId, isActive: true }
    if (zoneId) where.zoneId = zoneId
    return this.locationRepo.find({ where, relations: ['zone'], order: { code: 'ASC' } })
  }

  async findLocation(id: string) {
    const loc = await this.locationRepo.findOne({ where: { id }, relations: ['zone', 'warehouse'] })
    if (!loc) throw new NotFoundException('위치를 찾을 수 없습니다')
    return loc
  }

  async createLocation(dto: {
    warehouseId: string; zoneId: string; code: string
    aisle?: string; rack?: string; shelf?: string; bin?: string; capacityUnit?: number
  }) {
    const exists = await this.locationRepo.findOne({ where: { code: dto.code } })
    if (exists) throw new ConflictException(`위치코드 '${dto.code}'가 이미 존재합니다`)
    return this.locationRepo.save(this.locationRepo.create(dto))
  }

  async updateLocation(id: string, dto: Partial<{ code: string; isActive: boolean; capacityUnit: number }>) {
    const loc = await this.findLocation(id)
    Object.assign(loc, dto)
    return this.locationRepo.save(loc)
  }

  async deactivateLocation(id: string) {
    await this.locationRepo.update(id, { isActive: false })
  }
}
