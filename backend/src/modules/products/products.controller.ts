import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ProductsService } from './products.service'
import { CreateProductDto, UpdateProductDto, ProductFilterDto } from './dto/create-product.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { User } from '../users/entities/user.entity'
import { ApiResponse } from '../../common/dto/api-response.dto'

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private svc: ProductsService) {}

  @Get()
  async findAll(@Query() filter: ProductFilterDto) {
    const result = await this.svc.findAll(filter)
    return { success: true, data: result.items, pagination: result }
  }

  @Get('categories')
  async getCategories() { return ApiResponse.ok(await this.svc.getCategories()) }

  @Get(':id')
  async findOne(@Param('id') id: string) { return ApiResponse.ok(await this.svc.findOne(id)) }

  @Post()
  async create(@Body() dto: CreateProductDto, @CurrentUser() user: User) {
    return ApiResponse.ok(await this.svc.create(dto, user.id), '상품이 등록되었습니다')
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return ApiResponse.ok(await this.svc.update(id, dto), '상품이 수정되었습니다')
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.svc.remove(id)
    return ApiResponse.ok(null, '상품이 삭제되었습니다')
  }
}
