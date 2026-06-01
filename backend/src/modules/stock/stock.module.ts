import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StockTransaction } from './entities/stock-transaction.entity'
import { Inventory } from '../inventory/inventory.entity'
import { StockService } from './stock.service'
import { StockController } from './stock.controller'
import { TxnNoGenerator } from './domain/txn-no-generator'

@Module({
  imports: [TypeOrmModule.forFeature([StockTransaction, Inventory])],
  controllers: [StockController],
  providers: [StockService, TxnNoGenerator],
  exports: [StockService, TxnNoGenerator],
})
export class StockModule {}
