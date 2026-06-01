import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Product } from './entities/product.entity'
import { Barcode } from '../barcodes/barcode.entity'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { BarcodesController } from '../barcodes/barcodes.controller'
import { BarcodesService } from '../barcodes/barcodes.service'

@Module({
  imports: [TypeOrmModule.forFeature([Product, Barcode])],
  controllers: [ProductsController, BarcodesController],
  providers: [ProductsService, BarcodesService],
  exports: [ProductsService, BarcodesService],
})
export class ProductsModule {}
