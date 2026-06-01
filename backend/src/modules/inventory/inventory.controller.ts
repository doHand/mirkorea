import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { InventoryService, InventoryFilter } from './inventory.service'

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get()
  findAll(@Query() filter: InventoryFilter) {
    return this.service.findAll(filter)
  }

  @Get('low-stock')
  getLowStock(@Query('warehouseId') warehouseId: string) {
    return this.service.getLowStock(warehouseId)
  }

  @Get('summary')
  getSummary(@Query('warehouseId') warehouseId: string) {
    return this.service.getSummary(warehouseId)
  }

  @Get('by-product/:productId')
  findByProduct(
    @Param('productId') productId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.service.findByProduct(productId, warehouseId)
  }
}
