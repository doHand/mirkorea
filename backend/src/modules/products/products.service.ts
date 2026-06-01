import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, ILike } from 'typeorm'
import { Product } from './entities/product.entity'
import { CreateProductDto, UpdateProductDto, ProductFilterDto } from './dto/create-product.dto'

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private repo: Repository<Product>) {}

  async findAll(filter: ProductFilterDto) {
    const { page = 1, limit = 50, search, category, saleStatus } = filter
    const where: any = {}
    if (search) where.name = ILike(`%${search}%`)
    if (category) where.category = category
    if (saleStatus) where.saleStatus = saleStatus

    const [items, total] = await this.repo.findAndCount({
      where,
      relations: ['barcodes'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    })
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const p = await this.repo.findOne({ where: { id }, relations: ['barcodes'] })
    if (!p) throw new NotFoundException('상품을 찾을 수 없습니다')
    return p
  }

  async create(dto: CreateProductDto, userId: string) {
    const exists = await this.repo.findOne({ where: { code: dto.code } })
    if (exists) throw new ConflictException(`상품코드 '${dto.code}' 가 이미 존재합니다`)
    const product = this.repo.create({ ...dto, createdBy: userId })
    return this.repo.save(product)
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findOne(id)
    Object.assign(product, dto)
    return this.repo.save(product)
  }

  async remove(id: string) {
    const product = await this.findOne(id)
    product.saleStatus = 'DISCONTINUED'
    await this.repo.save(product)
  }

  async getCategories() {
    const result = await this.repo
      .createQueryBuilder('p')
      .select('DISTINCT p.category', 'category')
      .where('p.category IS NOT NULL')
      .getRawMany()
    return result.map(r => r.category)
  }
}
