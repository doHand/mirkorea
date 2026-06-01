import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Barcode } from './barcode.entity'

export class CreateBarcodeDto {
  barcode: string
  type: 'UNIT' | 'BOX' | 'PALLET' | 'INNER'
  unitQty: number
  isPrimary?: boolean
}

@Injectable()
export class BarcodesService {
  constructor(@InjectRepository(Barcode) private repo: Repository<Barcode>) {}

  // 바코드로 상품 조회 — 스캔 시 핵심 API
  async lookupByBarcode(barcode: string) {
    const bc = await this.repo.findOne({
      where: { barcode, isActive: true },
      relations: ['product'],
    })
    if (!bc) throw new NotFoundException('등록되지 않은 바코드입니다')
    return bc
  }

  async findByProduct(productId: string) {
    return this.repo.find({ where: { productId, isActive: true } })
  }

  async addToProduct(productId: string, dto: CreateBarcodeDto) {
    const bc = this.repo.create({ ...dto, productId })
    return this.repo.save(bc)
  }

  async remove(id: string) {
    const bc = await this.repo.findOne({ where: { id } })
    if (!bc) throw new NotFoundException()
    bc.isActive = false
    await this.repo.save(bc)
  }
}
