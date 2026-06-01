import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { BarcodesService, CreateBarcodeDto } from './barcodes.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ApiResponse } from '../../common/dto/api-response.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class BarcodesController {
  constructor(private svc: BarcodesService) {}

  // GET /barcodes/lookup/:barcode — 스캔 시 상품 조회
  @Get('barcodes/lookup/:barcode')
  async lookup(@Param('barcode') barcode: string) {
    return ApiResponse.ok(await this.svc.lookupByBarcode(barcode))
  }

  // GET /products/:id/barcodes
  @Get('products/:id/barcodes')
  async findByProduct(@Param('id') id: string) {
    return ApiResponse.ok(await this.svc.findByProduct(id))
  }

  // POST /products/:id/barcodes
  @Post('products/:id/barcodes')
  async addBarcode(@Param('id') id: string, @Body() dto: CreateBarcodeDto) {
    return ApiResponse.ok(await this.svc.addToProduct(id, dto), '바코드가 등록되었습니다')
  }

  // DELETE /barcodes/:id
  @Delete('barcodes/:id')
  async remove(@Param('id') id: string) {
    await this.svc.remove(id)
    return ApiResponse.ok(null, '바코드가 삭제되었습니다')
  }
}
