import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { StockService } from './stock.service'
import {
  CreateInboundDto, CreateOutboundDto,
  CreateAdjustmentDto, CreateMoveDto,
  CancelTxnDto, StockTxnQueryDto,
} from './dto/create-inbound.dto'

@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly service: StockService) {}

  @Post('inbound')
  inbound(@Body() dto: CreateInboundDto, @CurrentUser() user: any) {
    return this.service.inbound(dto, user.id)
  }

  @Post('inbound/:id/cancel')
  cancelInbound(@Param('id') id: string, @Body() dto: CancelTxnDto, @CurrentUser() user: any) {
    return this.service.cancelInbound(id, dto, user.id)
  }

  @Post('outbound')
  outbound(@Body() dto: CreateOutboundDto, @CurrentUser() user: any) {
    return this.service.outbound(dto, user.id)
  }

  @Post('outbound/:id/cancel')
  cancelOutbound(@Param('id') id: string, @Body() dto: CancelTxnDto, @CurrentUser() user: any) {
    return this.service.cancelOutbound(id, dto, user.id)
  }

  @Post('adjustment')
  adjust(@Body() dto: CreateAdjustmentDto, @CurrentUser() user: any) {
    return this.service.adjust(dto, user.id)
  }

  @Post('move')
  move(@Body() dto: CreateMoveDto, @CurrentUser() user: any) {
    return this.service.move(dto, user.id)
  }

  @Get('transactions')
  findTransactions(@Query() q: StockTxnQueryDto) {
    return this.service.findTransactions(q)
  }
}
